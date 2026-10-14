/**
 * Student-facing content labels (spec §52).
 *
 * The label answers one question honestly: *what kind of thing is this?*
 * An official board question paper, a source-archive copy, a third-party
 * practice set, an unverified upload and AI-generated practice are five
 * different things, and they are never allowed to blur into "PYQ".
 *
 * Derivation lives in `labelForDocument()` so the same input always produces
 * the same words whether it is rendered here, in the admin console or in a
 * PDF header.
 */
import { Badge } from '@/components/ui'
import { CONTENT_LABELS, type ContentLabelKey } from '@/content-engine/license'
import type { OfficialStatus } from '@/content-engine/types'

const TONE: Record<ContentLabelKey, 'success' | 'brand' | 'warning' | 'neutral' | 'outline'> = {
  officialSamplePaper: 'success',
  officialQuestionPaper: 'success',
  verifiedPyq: 'success',
  sourceArchivePyq: 'brand',
  thirdPartyPaper: 'warning',
  unverifiedPaper: 'warning',
  aiPractice: 'outline',
  aiNotes: 'outline',
  studyosOriginal: 'brand',
  externalResource: 'neutral',
}

/** Authenticity wording that always travels with a paper. */
export const OFFICIAL_SHORT: Record<OfficialStatus, string> = {
  verified_official: 'Verified official',
  verified_source_archive: 'Verified source archive',
  third_party: 'Third party',
  unverified: 'Unverified',
}

/**
 * The precise badge. `uppercase` mirrors the existing AI practice marker so
 * generated material is visually distinct at a glance.
 */
export function ContentLabel({
  labelKey,
  uppercase = false,
}: {
  labelKey: ContentLabelKey
  uppercase?: boolean
}) {
  return (
    <Badge variant={TONE[labelKey] ?? 'neutral'} uppercase={uppercase}>
      {CONTENT_LABELS[labelKey]}
    </Badge>
  )
}

/**
 * Label derived straight from a document, for rows that have not been
 * resolved into a `ContentLabelKey` yet.
 */
export function ContentLabelFor({
  docKind,
  officialStatus,
  generationSource,
  uppercase = false,
}: {
  docKind: string
  officialStatus?: OfficialStatus | null
  generationSource?: string | null
  uppercase?: boolean
}) {
  const key = resolveLabel(docKind, officialStatus, generationSource)
  return <ContentLabel labelKey={key} uppercase={uppercase} />
}

/**
 * Mirrors `labelForDocument()` for the cases the student UI needs, without
 * pulling the whole module into the bundle.
 */
function resolveLabel(
  docKind: string,
  officialStatus?: OfficialStatus | null,
  generationSource?: string | null,
): ContentLabelKey {
  if (generationSource === 'ai') return 'aiNotes'
  if (generationSource === 'manual') return 'studyosOriginal'

  if (docKind === 'sample_paper') {
    return officialStatus === 'verified_official' ? 'officialSamplePaper' : 'unverifiedPaper'
  }
  if (docKind === 'question_paper' || docKind === 'pyq') {
    if (officialStatus === 'verified_official') return 'officialQuestionPaper'
    if (officialStatus === 'verified_source_archive') return 'sourceArchivePyq'
    if (officialStatus === 'third_party') return 'thirdPartyPaper'
    return 'unverifiedPaper'
  }
  if (docKind === 'ai_practice' || docKind === 'practice_paper') return 'aiPractice'
  return 'externalResource'
}
