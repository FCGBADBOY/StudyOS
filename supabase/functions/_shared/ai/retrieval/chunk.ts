/**
 * Academic document chunker (pure — no Deno/DB imports, unit-tested).
 *
 * The rule from the spec: do NOT blindly split every N characters. We split on
 * *logical* boundaries that exist in study material:
 *
 *   heading / subtopic → paragraph → definition → formula → example →
 *   question → solution
 *
 * Small pieces are then merged back together (never across a heading, never
 * splitting a formula) up to MAX_TOKENS, so retrieval gets chunks that are
 * both semantically whole and big enough to be useful.
 *
 * Every chunk carries the metadata it was created with (board, class, subject,
 * chapter, resource, section, page) — that is what citations are built from.
 */

export type ContentKind =
  | 'heading'
  | 'subtopic'
  | 'paragraph'
  | 'definition'
  | 'formula'
  | 'example'
  | 'question'
  | 'solution'
  | 'chapter_description'

export interface ChunkMetadata {
  board?: string | null
  className?: string | null
  subject?: string | null
  chapter?: string | null
  resource?: string | null
  resourceType?: string | null
  section?: string | null
  page?: number | null
  [key: string]: unknown
}

export interface Chunk {
  content: string
  chunkIndex: number
  tokenCount: number
  sectionTitle: string | null
  contentKind: ContentKind
  metadata: ChunkMetadata
}

export interface ChunkOptions {
  /** Hard cap per chunk (default 420 ≈ a screen of revision notes). */
  maxTokens?: number
  /** Stop making chunks bigger than this many characters. */
  maxChars?: number
  metadata?: ChunkMetadata
  /** Treat \f (PDF page breaks) as page boundaries (default true). */
  pageBreaks?: boolean
}

export const DEFAULT_MAX_TOKENS = 420
const DEFAULT_MAX_CHARS = 2400

/** Cheap, deterministic token estimate (~4 characters per token for prose). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.trim().length / 4))
}

/* ---------------------------- boundary detection --------------------------- */

const HEADING_PATTERNS: RegExp[] = [
  /^#{1,6}\s+(.+)$/, // markdown headings
  /^(\d+(?:\.\d+)+)[\s.)]+\s*(\S.*)$/, // 1.2 Electrostatic Potential
  /^chapter\s+\d+\b[:.\s-]*(.*)$/i,
  /^unit\s+\d+\b[:.\s-]*(.*)$/i,
  /^[A-Z][A-Za-z0-9 ,/&()'–—-]{2,70}$/, // Title Case / ALL CAPS line
]

const KIND_PATTERNS: Array<{ kind: ContentKind; test: RegExp }> = [
  /* `\b` cannot follow `[.)]` (both non-word), so the marker must end the
     string or be followed by whitespace — otherwise "Q1. Solve…" never
     matches and the question merges into the surrounding prose. */
  {
    kind: 'question',
    test: /^(q\d+[.)]|question\s*\d*[.)]?|solve the following|answer the following)(\s|$)/i,
  },
  { kind: 'question', test: /\?\s*$/ },
  { kind: 'solution', test: /^(solution|ans\.?|answer)\s*[:.-]/i },
  { kind: 'example', test: /^(example|e\.g\.?|for example|practice)\b/i },
  { kind: 'definition', test: /^(definition\b|.*\bis defined as\b|.*\brefers to\b)/i },
  {
    kind: 'formula',
    test: /^[\s(]*[A-Za-zΔΣθμΩεπ∂√±−–-][^=]{0,40}=\s*\S/,
  },
]

/** Is this single line a section heading? */
function headingOf(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 90) return null
  for (const pattern of HEADING_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const title = (match[2] ?? match[1] ?? trimmed).trim()
      /* Avoid swallowing normal sentences that happen to start capitalised. */
      if (title.length > 2 && title.split(/\s+/).length <= 9) return title
    }
  }
  return null
}

function kindOf(block: string): ContentKind {
  const firstLine = block.split('\n').find((line) => line.trim())?.trim() ?? ''
  for (const { kind, test } of KIND_PATTERNS) {
    if (test.test(firstLine)) return kind
  }
  return 'paragraph'
}

/* --------------------------------- chunking -------------------------------- */

interface Segment {
  text: string
  kind: ContentKind
  section: string | null
  page: number | null
}

/** Split raw text into heading/paragraph/formula segments. */
function segment(text: string, pageBreaks: boolean): Segment[] {
  const normalized = text.replace(/\r\n?/g, '\n')
  const pages = pageBreaks ? normalized.split('\f') : [normalized]
  const segments: Segment[] = []
  let section: string | null = null
  let pageIndex: number | null = pageBreaks ? (pages.length > 1 ? 1 : null) : null

  for (const pageText of pages) {
    /* Group the page into blocks: headings open a new block, blank lines end one. */
    const lines = pageText.split('\n')
    let buffer: string[] = []
    let pendingHeading: string | null = null

    const flush = () => {
      const block = buffer.join('\n').trim()
      buffer = []
      if (!block) return
      /* A block that is a formula cluster → formula kind. */
      const kind = kindOf(block)
      segments.push({ text: block, kind, section, page: pageIndex })
    }

    for (const line of lines) {
      const heading = headingOf(line)
      if (heading) {
        flush()
        section = heading
        pendingHeading = null
        segments.push({ text: heading, kind: 'heading', section: heading, page: pageIndex })
        continue
      }
      if (!line.trim()) {
        flush()
        continue
      }

      /* A question and its solution must never share a segment — the chunker
         would otherwise bury the answer inside a chunk labelled "question",
         and a retrieval hit would cite the wrong half. */
      const lineKind = kindOf(line)
      const bufferedKind = buffer.length ? kindOf(buffer.join('\n')) : null
      if (
        buffer.length > 0 &&
        ((lineKind === 'solution' && bufferedKind !== 'solution') ||
          (lineKind === 'question' && bufferedKind !== 'question'))
      ) {
        flush()
      }

      buffer.push(line)
      /* Formula/example lines stand alone so they never merge into prose. */
      const preview = buffer.join('\n').trim()
      const kind = kindOf(preview)
      if (kind === 'formula' || kind === 'example') {
        if (buffer.length >= 1) flush()
      }
      pendingHeading = null
    }
    flush()

    if (pageIndex !== null) pageIndex += 1
  }

  return segments
}

/** Merge segments into chunks ≤ maxTokens, never crossing a heading. */
export function chunkDocument(rawText: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const baseMetadata: ChunkMetadata = { ...(options.metadata ?? {}) }
  const text = (rawText ?? '').trim()
  if (!text) return []

  const segments = segment(text, options.pageBreaks !== false).filter(
    (entry) => entry.text.trim().length > 0,
  )
  if (!segments.length) return []

  const chunks: Chunk[] = []
  let current: { parts: string[]; kind: ContentKind; section: string | null; page: number | null } | null = null
  let index = 0

  const pushCurrent = () => {
    if (!current) return
    const content = current.parts.join('\n\n').trim()
    if (!content) {
      current = null
      return
    }
    const metadata: ChunkMetadata = { ...baseMetadata }
    if (current.section) metadata.section = current.section
    if (current.page !== null && current.page !== undefined) metadata.page = current.page

    chunks.push({
      content,
      chunkIndex: index,
      tokenCount: estimateTokens(content),
      sectionTitle: current.section,
      contentKind: current.kind,
      metadata,
    })
    index += 1
    current = null
  }

  for (const entry of segments) {
    const isHeading = entry.kind === 'heading'
    const standalone = entry.kind === 'formula' || entry.kind === 'question' || entry.kind === 'solution'

    /* Headings always close the current chunk — they title the next one. */
    if (isHeading) {
      pushCurrent()
      continue
    }

    const entryTokens = estimateTokens(entry.text)
    const currentTokens = current ? estimateTokens(current.parts.join('\n\n')) : 0

    if (
      current &&
      !standalone &&
      currentTokens + entryTokens <= maxTokens &&
      current.parts.join('\n\n').length + entry.text.length <= maxChars &&
      current.section === entry.section &&
      /* Never merge across a PDF page break: the chunk's page number would
         mislabel the citation. */
      current.page === entry.page
    ) {
      current.parts.push(entry.text)
      continue
    }

    pushCurrent()
    current = { parts: [entry.text], kind: entry.kind, section: entry.section, page: entry.page }
    if (entry.kind === 'question' || entry.kind === 'solution' || entry.kind === 'definition') {
      current.kind = entry.kind
    }
    /* Oversized single segment: split on sentence boundaries. */
    if (entryTokens > maxTokens) {
      const sentences = entry.text.split(/(?<=[.!?])\s+|\n{2,}/)
      const buckets: string[] = []
      let bucket = ''
      for (const sentence of sentences) {
        if (estimateTokens(`${bucket} ${sentence}`) > maxTokens && bucket) {
          buckets.push(bucket.trim())
          bucket = sentence
        } else {
          bucket = `${bucket} ${sentence}`
        }
      }
      if (bucket.trim()) buckets.push(bucket.trim())
      current.parts = buckets.slice(0, 1)
      for (const extra of buckets.slice(1)) {
        pushCurrent()
        current = { parts: [extra], kind: entry.kind, section: entry.section, page: entry.page }
      }
    }
  }

  pushCurrent()

  /* Final pass: drop noise (single short words) but keep at least one chunk. */
  const cleaned = chunks.filter((chunk) => chunk.content.length >= 12)
  return cleaned.length ? cleaned : chunks.slice(0, 1)
}
