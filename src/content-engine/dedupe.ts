/**
 * Duplicate detection (spec §48).
 *
 * The same paper routinely appears on half a dozen URLs: a board site, an
 * academic portal, a state mirror. StudyOS keeps ONE canonical record and
 * records the others as alternate references — it never auto-deletes anything.
 *
 * Four signals, strongest first:
 *   1. file hash          → the identical PDF at a different URL
 *   2. canonical URL      → tracking parameters and fragments stripped
 *   3. normalised title    → same paper, renamed by a mirror
 *   4. text similarity     → "close enough to be the same paper"
 *
 * Pure module: async only because SHA-256 is async in both Deno and the
 * browser. No dependencies, no `@/` aliases.
 */

/* -------------------------------------------------------------------------- */
/* Canonical URLs                                                             */
/* -------------------------------------------------------------------------- */

/** Query parameters that never change the identity of a document. */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
])

/** Reduce a URL to its stable identity. Never throws — bad URLs stay strings. */
export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim())
    url.hash = ''
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase()

    const params = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))

    url.search = ''
    for (const [key, value] of params) url.searchParams.append(key, value)

    let out = url.toString()
    if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1)
    return out
  } catch {
    return raw.trim().toLowerCase()
  }
}

/* -------------------------------------------------------------------------- */
/* Titles                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Normalise a document title for comparison: case, punctuation, spacing and
 * the decorative markers publishers add ("***** FINAL *****").
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Titles are the same when one contains the other after normalisation. */
export function titlesMatch(a: string, b: string): boolean {
  const left = normalizeTitle(a)
  const right = normalizeTitle(b)
  if (!left || !right) return false
  if (left === right) return true
  const [short, long] = left.length <= right.length ? [left, right] : [right, left]
  return long.includes(short) && short.split(' ').length >= 3
}

/* -------------------------------------------------------------------------- */
/* Text similarity                                                            */
/* -------------------------------------------------------------------------- */

function tokens(value: string): Set<string> {
  return new Set(
    normalizeTitle(value)
      .split(' ')
      .filter((word) => word.length > 2),
  )
}

/** Jaccard similarity over title/content tokens, 0–1. */
export function similarity(a: string, b: string): number {
  const left = tokens(a)
  const right = tokens(b)
  if (!left.size || !right.size) return 0

  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / (left.size + right.size - shared)
}

/** Above this a pair of documents is treated as the same paper. */
export const SIMILARITY_THRESHOLD = 0.82

/* -------------------------------------------------------------------------- */
/* Hashing                                                                    */
/* -------------------------------------------------------------------------- */

/** SHA-256 hex digest — available in Deno and every modern browser. */
export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data)

  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/* -------------------------------------------------------------------------- */
/* Classification                                                             */
/* -------------------------------------------------------------------------- */

export type DuplicateKind =
  | 'unique'
  | 'exact'
  | 'same_file_different_url'
  | 'updated_version'
  | 'similar_paper'

export const DUPLICATE_LABELS: Record<DuplicateKind, string> = {
  unique: 'New document',
  exact: 'Exact duplicate',
  same_file_different_url: 'Same file, different URL',
  updated_version: 'Updated version',
  similar_paper: 'Similar paper',
}

export interface DocumentFingerprint {
  canonicalUrl: string
  title: string
  fileHash?: string | null
  sizeBytes?: number | null
  /** Session/year, when known — a 2023 and a 2024 paper are NOT duplicates. */
  academicSession?: string | null
  year?: number | null
}

export interface DuplicateDecision {
  kind: DuplicateKind
  /** The row that should remain canonical, when `kind !== 'unique'`. */
  canonicalId?: string
  confidence: number
  reason: string
}

/**
 * Compare a candidate document against the ones already known.
 *
 * Returns the strongest match it can prove. Session/year always wins over
 * title similarity — two years of "Sample Paper Set 1" are different papers.
 */
export function classifyDuplicate(
  candidate: DocumentFingerprint,
  existing: Array<DocumentFingerprint & { id: string }>,
): DuplicateDecision {
  const sameSession = (other: DocumentFingerprint): boolean => {
    if (candidate.year && other.year) return candidate.year === other.year
    if (candidate.academicSession && other.academicSession) {
      return candidate.academicSession === other.academicSession
    }
    return true // unknown on both sides — do not use this to *confirm*
  }

  for (const other of existing) {
    if (candidate.fileHash && other.fileHash && candidate.fileHash === other.fileHash) {
      return {
        kind: candidate.canonicalUrl === other.canonicalUrl ? 'exact' : 'same_file_different_url',
        canonicalId: other.id,
        confidence: 1,
        reason: 'Identical SHA-256 content hash.',
      }
    }
  }

  for (const other of existing) {
    if (candidate.canonicalUrl === other.canonicalUrl) {
      return {
        kind: 'exact',
        canonicalId: other.id,
        confidence: 1,
        reason: 'Same canonical URL.',
      }
    }
  }

  for (const other of existing) {
    if (!sameSession(other)) continue
    if (titlesMatch(candidate.title, other.title)) {
      return {
        kind: 'similar_paper',
        canonicalId: other.id,
        confidence: 0.9,
        reason: 'Normalised titles match for the same academic session.',
      }
    }
  }

  for (const other of existing) {
    if (!sameSession(other)) continue
    const score = similarity(candidate.title, other.title)
    if (score >= SIMILARITY_THRESHOLD) {
      return {
        kind: 'similar_paper',
        canonicalId: other.id,
        confidence: Number(score.toFixed(2)),
        reason: `Title similarity ${(score * 100).toFixed(0)}% for the same session.`,
      }
    }
  }

  /* A re-fetch of a known document whose bytes changed is a new *version*,
     not a duplicate — the caller records it on `source_versions`. */
  if (candidate.fileHash) {
    const changed = existing.find(
      (other) => other.canonicalUrl === candidate.canonicalUrl && other.fileHash !== candidate.fileHash,
    )
    if (changed) {
      return {
        kind: 'updated_version',
        canonicalId: changed.id,
        confidence: 1,
        reason: 'Same URL, different content hash.',
      }
    }
  }

  return { kind: 'unique', confidence: 0, reason: 'No match found.' }
}

/**
 * Deterministic key for a document, used as the unique index that stops the
 * same paper being imported twice from two different crawl runs.
 */
export function documentContentKey(fingerprint: DocumentFingerprint): string {
  if (fingerprint.fileHash) return `sha256:${fingerprint.fileHash}`
  return `url:${canonicalizeUrl(fingerprint.canonicalUrl)}|t:${normalizeTitle(fingerprint.title)}`
}
