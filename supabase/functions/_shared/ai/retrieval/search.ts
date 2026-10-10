/**
 * Hybrid retrieval: pgvector similarity + keyword rank + academic filters,
 * executed through the `search_document_chunks` / `search_pyq_questions` RPCs
 * (which run `security invoker`, so RLS still decides what is visible).
 *
 * Vector leg is optional: when no embedding provider is configured — or the
 * embedding call fails — the same query runs keyword-only instead of failing.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { RetrievedChunk, RetrievedPyq, RetrievalFilters, Source } from '../types.ts'
import type { AiProvider } from '../providers/provider.interface.ts'
import { embedText } from './embed.ts'
import { describeFilters } from './filters.ts'
import { log } from '../../logging.ts'

export interface HybridSearchArgs {
  db: SupabaseClient
  query: string
  filters: RetrievalFilters
  limit?: number
  embeddingProvider?: AiProvider | null
}

export interface HybridSearchResult {
  chunks: RetrievedChunk[]
  usedVector: boolean
  filteredBy: string
}

interface ChunkRow {
  id: string
  content: string
  chunk_index: number
  token_count: number
  section_title: string | null
  content_kind: string
  resource_id: string | null
  chapter_id: string | null
  subject_id: string | null
  board_id: string | null
  class_id: string | null
  resource_type: string | null
  chapter_name: string | null
  subject_name: string | null
  resource_title: string | null
  metadata: Record<string, unknown> | null
  score: number
}

export async function hybridSearch(args: HybridSearchArgs): Promise<HybridSearchResult> {
  const limit = Math.min(Math.max(args.limit ?? 6, 1), 20)
  const filteredBy = describeFilters(args.filters)

  let embedding: number[] | null = null
  if (args.embeddingProvider) {
    embedding = await embedText(args.embeddingProvider, args.query)
  }

  const { data, error } = await args.db.rpc('search_document_chunks', {
    p_query: args.query,
    p_embedding: embedding ? `[${embedding.join(',')}]` : null,
    p_board_id: args.filters.boardId ?? null,
    p_class_id: args.filters.classId ?? null,
    p_subject_id: args.filters.subjectId ?? null,
    p_chapter_id: args.filters.chapterId ?? null,
    p_resource_type: args.filters.resourceType ?? null,
    p_limit: limit,
  })

  if (error) {
    /* Keyword-only fallback: the vector leg may be unavailable (pgvector
       missing, wrong dimension). Never fail a request because of retrieval. */
    log('warn', 'ai.retrieval_rpc_failed', { error: error.message, filteredBy })
    return { chunks: [], usedVector: false, filteredBy }
  }

  const rows = (data ?? []) as ChunkRow[]
  const chunks: RetrievedChunk[] = rows.map((row) => ({
    id: row.id,
    content: row.content,
    chunkIndex: row.chunk_index,
    sectionTitle: row.section_title,
    contentKind: row.content_kind,
    resourceId: row.resource_id,
    chapterId: row.chapter_id,
    subjectId: row.subject_id,
    chapterName: row.chapter_name,
    subjectName: row.subject_name,
    resourceTitle: row.resource_title,
    resourceType: row.resource_type,
    metadata: row.metadata ?? {},
    score: Number(row.score ?? 0),
  }))

  log('info', 'ai.retrieval_completed', {
    count: chunks.length,
    usedVector: embedding !== null,
    filteredBy,
  })

  return { chunks, usedVector: embedding !== null, filteredBy }
}

export interface PyqSearchArgs {
  db: SupabaseClient
  query: string
  filters: RetrievalFilters
  limit?: number
  year?: number | null
  marks?: number | null
}

interface PyqRow {
  id: string
  year: number
  exam_type: string
  question_text: string
  question_type: string
  paper_set: string
  marks: number
  difficulty: string
  concepts: string[] | null
  chapter_id: string | null
  chapter_name: string | null
  subject_id: string | null
  subject_name: string | null
  board_id: string | null
}

/** Real archive rows only — never generated text. */
export async function searchPyqs(args: PyqSearchArgs): Promise<RetrievedPyq[]> {
  const { data, error } = await args.db.rpc('search_pyq_questions', {
    p_query: args.query,
    p_board_id: args.filters.boardId ?? null,
    p_class_id: args.filters.classId ?? null,
    p_subject_id: args.filters.subjectId ?? null,
    p_chapter_id: args.filters.chapterId ?? null,
    p_year: args.year ?? null,
    p_marks: args.marks ?? null,
    p_limit: Math.min(Math.max(args.limit ?? 8, 1), 50),
  })

  if (error) {
    log('warn', 'ai.pyq_search_failed', { error: error.message })
    return []
  }

  return ((data ?? []) as PyqRow[]).map((row) => ({
    id: row.id,
    year: row.year,
    examType: row.exam_type,
    questionText: row.question_text,
    questionType: row.question_type,
    paperSet: row.paper_set,
    marks: row.marks,
    difficulty: row.difficulty,
    concepts: row.concepts ?? [],
    chapterId: row.chapter_id,
    chapterName: row.chapter_name,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
  }))
}

/* --------------------------------- sources -------------------------------- */

function libraryHref(meta: Record<string, unknown>): string | null {
  const { boardSlug, classSlug, subjectSlug, chapterSlug } = meta as {
    boardSlug?: string
    classSlug?: string
    subjectSlug?: string
    chapterSlug?: string
  }
  if (!boardSlug || !classSlug || !subjectSlug || !chapterSlug) return null
  return `/library/${boardSlug}/${classSlug}/${subjectSlug}/${chapterSlug}`
}

/** Build the citation card for a retrieved chunk (page/section only if real). */
export function chunkToSource(chunk: RetrievedChunk): Source {
  const meta = chunk.metadata ?? {}
  return {
    id: chunk.resourceId ?? chunk.id,
    kind: (chunk.resourceType as Source['kind']) ?? 'notes',
    title: chunk.resourceTitle ?? meta.resourceTitle?.toString() ?? 'StudyOS notes',
    chapter: chunk.chapterName ?? null,
    chapterSlug: typeof meta.chapterSlug === 'string' ? meta.chapterSlug : null,
    subject: chunk.subjectName ?? null,
    subjectSlug: typeof meta.subjectSlug === 'string' ? meta.subjectSlug : null,
    board: typeof meta.board === 'string' ? meta.board : null,
    className: typeof meta.className === 'string' ? meta.className : null,
    page: typeof meta.page === 'number' ? meta.page : null,
    section: chunk.sectionTitle,
    excerpt: chunk.content.slice(0, 240),
    score: chunk.score,
    href: libraryHref(meta),
    generated: false,
  }
}

export function pyqToSource(pyq: RetrievedPyq): Source {
  return {
    id: pyq.id,
    kind: 'pyq',
    title: `PYQ · ${pyq.year}${pyq.subjectName ? ` · ${pyq.subjectName}` : ''}`,
    chapter: pyq.chapterName,
    subject: pyq.subjectName,
    subjectSlug: null,
    year: pyq.year,
    marks: pyq.marks,
    excerpt: pyq.questionText.slice(0, 240),
    href: '/pyq',
    generated: false,
  }
}

/** De-duplicate sources by id (same resource can surface in several chunks). */
export function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>()
  const out: Source[] = []
  for (const source of sources) {
    const key = `${source.kind}:${source.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(source)
  }
  return out
}
