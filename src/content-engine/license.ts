/**
 * Licence policy — the single place StudyOS decides whether it may *keep* a
 * copy of something it found on the internet.
 *
 * The rule this file exists to enforce (spec §2):
 *
 *   "available publicly"  ≠  "free to redistribute"
 *
 * So every decision is explicit and auditable:
 *
 *   store         → download into Supabase Storage, with attribution retained
 *   metadata_only → keep title + canonical URL + provenance, show "View Source"
 *   block         → record that it exists, never fetch or store the file
 *
 * The crawler calls `decideStorage()` before writing a single byte; the admin
 * UI calls `licenseTone()` / `describeStorageDecision()` so an editor always
 * sees *why* a document is a link instead of a download.
 *
 * Pure: no imports, no I/O. Shared by the browser and the edge worker.
 */
import type { AccessMethod, LicenseStatus, SourceType } from './types'

/* -------------------------------------------------------------------------- */
/* The decision                                                               */
/* -------------------------------------------------------------------------- */

export type StorageDecision = 'store' | 'metadata_only' | 'block'

/**
 * Categories StudyOS may store files for, in priority order.
 *
 * Kept in sync with `content_engine_settings.storable_licenses` — the database
 * row is the runtime override, this constant is the safe default when no row
 * exists yet (and the floor an admin cannot lower below `restricted`).
 */
export const DEFAULT_STORABLE_LICENSES: readonly LicenseStatus[] = [
  'official',
  'open_license',
  'public_domain',
  'permission_granted',
]

export const DEFAULT_METADATA_ONLY_LICENSES: readonly LicenseStatus[] = ['unknown']

export const DEFAULT_BLOCKED_LICENSES: readonly LicenseStatus[] = ['restricted']

export interface LicensePolicy {
  storable: readonly LicenseStatus[]
  metadataOnly: readonly LicenseStatus[]
  blocked: readonly LicenseStatus[]
}

export const DEFAULT_LICENSE_POLICY: LicensePolicy = {
  storable: DEFAULT_STORABLE_LICENSES,
  metadataOnly: DEFAULT_METADATA_ONLY_LICENSES,
  blocked: DEFAULT_BLOCKED_LICENSES,
}

export interface StorageContext {
  license: LicenseStatus
  /** How StudyOS can reach it: a public URL, a link we only reference, or manual. */
  accessMethod?: AccessMethod
  /** Source classes we never store on behalf of, regardless of claimed licence. */
  sourceType?: SourceType
  policy?: LicensePolicy
}

/**
 * May StudyOS keep a file?
 *
 * Order matters: `restricted` blocks before anything can widen it, an unknown
 * licence falls through to metadata-only (never to "store"), and only the four
 * positive states allow a copy. The result never depends on whether a URL
 * happens to be directly downloadable — a signed CDN link is not a licence.
 */
export function decideStorage(context: StorageContext): StorageDecision {
  const policy = context.policy ?? DEFAULT_LICENSE_POLICY

  /* 1. Explicitly restricted material is never stored, never mirrored. */
  if (context.license === 'restricted' || policy.blocked.includes(context.license)) {
    return 'block'
  }

  /* 2. Manual / link-only access means we reference, we do not copy. */
  if (context.accessMethod && context.accessMethod !== 'public') {
    return 'metadata_only'
  }

  /* 3. Only the positive licence categories allow a copy. Note that a
        `community` source claiming an open licence still passes through the
        `verifySource` step first — an adapter's claim is not evidence. */
  if (policy.storable.includes(context.license)) {
    return 'store'
  }

  /* 4. Unknown → metadata + canonical URL + a "View Source" link. */
  return 'metadata_only'
}

/** `unknown` and `restricted` are the two states that never store a file. */
export function canStore(license: LicenseStatus, policy?: LicensePolicy): boolean {
  return decideStorage({ license, policy }) === 'store'
}

/* -------------------------------------------------------------------------- */
/* Labels + presentation                                                      */
/* -------------------------------------------------------------------------- */

export type LicenseTone = 'success' | 'info' | 'warning' | 'danger'

export function licenseTone(license: LicenseStatus): LicenseTone {
  switch (license) {
    case 'official':
    case 'open_license':
    case 'public_domain':
    case 'permission_granted':
      return 'success'
    case 'unknown':
      return 'warning'
    case 'restricted':
      return 'danger'
    default:
      return 'info'
  }
}

/** Short, precise wording for a badge. Never overstates what was verified. */
export function licenseBadge(license: LicenseStatus): string {
  switch (license) {
    case 'official':
      return 'Official'
    case 'open_license':
      return 'Open licence'
    case 'public_domain':
      return 'Public domain'
    case 'permission_granted':
      return 'Permission granted'
    case 'unknown':
      return 'Licence unknown'
    case 'restricted':
      return 'No redistribution'
    default:
      return 'Unknown'
  }
}

/**
 * The sentence shown to an admin (and, in shorter form, to a student) so a
 * licence decision is never a silent default.
 */
export function describeStorageDecision(decision: StorageDecision, license: LicenseStatus): string {
  switch (decision) {
    case 'store':
      return `Stored in StudyOS (${licenseBadge(license).toLowerCase()}). Attribution is retained on every view.`
    case 'metadata_only':
      return `Publicly reachable but redistribution rights are unclear (${licenseBadge(
        license,
      ).toLowerCase()}) — only the title, source and canonical URL are kept. Students see a "View Source" link.`
    case 'block':
      return `Redistribution is prohibited (${licenseBadge(
        license,
      ).toLowerCase()}) — the file is never downloaded, uploaded or mirrored.`
    default:
      return ''
  }
}

/* -------------------------------------------------------------------------- */
/* Attribution (spec §51)                                                      */
/* -------------------------------------------------------------------------- */

export interface AttributionFields {
  source_name: string
  source_url?: string | null
  domain?: string | null
  publisher?: string | null
  retrieved_at?: string | null
  license_status: LicenseStatus
  redistribution_allowed: boolean
  official_status?: string | null
}

/**
 * The exact "Source / Original URL / Retrieved / Official / Redistribution"
 * block shown to students. Returns ordered rows so the UI renders the same
 * information everywhere without re-deciding what is safe to show.
 */
export function attributionRows(fields: AttributionFields): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Source', value: fields.publisher || fields.source_name },
  ]

  if (fields.source_url) rows.push({ label: 'Original URL', value: fields.source_url })
  if (fields.retrieved_at) {
    rows.push({ label: 'Retrieved', value: formatDate(fields.retrieved_at) })
  }
  if (fields.official_status) {
    rows.push({
      label: 'Official',
      value:
        fields.official_status === 'verified_official'
          ? 'Yes — verified against the issuing body'
          : fields.official_status === 'verified_source_archive'
            ? 'Archive copy, source verified'
            : fields.official_status === 'third_party'
              ? 'No — third-party publication'
              : 'Not verified',
    })
  }

  rows.push({
    label: 'Redistribution',
    value: fields.redistribution_allowed
      ? 'Allowed — stored with attribution'
      : fields.license_status === 'restricted'
        ? 'Not permitted — not stored'
        : 'Not stored — link only',
  })

  if (fields.license_status === 'open_license') {
    rows.push({ label: 'Licence', value: 'Open licence (see original)' })
  } else if (fields.license_status === 'public_domain') {
    rows.push({ label: 'Licence', value: 'Public domain' })
  }

  return rows
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* -------------------------------------------------------------------------- */
/* Student-facing labels (spec §52)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Precise labels. Official papers, verified PYQs, third-party material and
 * AI-generated practice are different things and must never blur together.
 */
export const CONTENT_LABELS = {
  officialSamplePaper: 'Official Sample Paper',
  officialQuestionPaper: 'Official Question Paper',
  verifiedPyq: 'Verified PYQ',
  sourceArchivePyq: 'Source Archive PYQ',
  thirdPartyPaper: 'Third-Party Practice Paper',
  unverifiedPaper: 'Unverified Paper',
  aiPractice: 'AI-Generated Practice',
  aiNotes: 'AI-Generated Notes',
  studyosOriginal: 'StudyOS Original Notes',
  externalResource: 'External Resource',
} as const

export type ContentLabelKey = keyof typeof CONTENT_LABELS

/**
 * The honest label for a document, derived from what we actually verified.
 * An unverified upload is never called a PYQ.
 */
export function labelForDocument(input: {
  doc_kind: string
  official_status?: string | null
  generation_source?: string | null
}): ContentLabelKey {
  if (input.generation_source === 'ai') return 'aiNotes'
  if (input.generation_source === 'manual') return 'studyosOriginal'

  switch (input.official_status) {
    case 'verified_official':
      return input.doc_kind === 'sample_paper' ? 'officialSamplePaper' : 'officialQuestionPaper'
    case 'verified_source_archive':
      return 'sourceArchivePyq'
    case 'third_party':
      return 'thirdPartyPaper'
    default:
      return 'unverifiedPaper'
  }
}
