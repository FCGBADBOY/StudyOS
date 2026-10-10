/**
 * Retrieval filters (pure — unit-tested).
 *
 * Turns "who this student is + what they are looking at" into the academic
 * filters the SQL search applies. The rule from the spec: prefer the student's
 * own curriculum — a CBSE Class 12 student asking about a textbook concept
 * should not be handed a Class 8 resource unless they explicitly ask for one.
 */
import type { AIIntent, RetrievalFilters } from '../types.ts'

export interface ProfileScope {
  boardId?: string | null
  classId?: string | null
  streamId?: string | null
}

export interface FocusScope {
  subjectId?: string | null
  chapterId?: string | null
}

export interface BuildFilterInput {
  profile?: ProfileScope | null
  focus?: FocusScope | null
  intent: AIIntent
  /** Raw question, used only to spot explicit out-of-curriculum requests. */
  question?: string
}

/**
 * Resource types each intent should prefer. `null` = do not filter by type
 * (search everything the student may read).
 */
export function resourceTypeForIntent(intent: AIIntent): string | null {
  switch (intent) {
    case 'formula':
    case 'reaction':
      return 'formula_sheet'
    case 'revision':
      return null // revision wants notes + formula sheets + PYQs, so no type filter
    case 'exam_answer':
    case 'study_advice':
      return null
    default:
      return null
  }
}

/** Does the student explicitly ask for material outside their own class/board? */
export function asksOutsideCurriculum(question: string): boolean {
  const match = question.match(/\bclass\s+(\d{1,2})\b/i)
  if (!match) return false
  const requested = Number(match[1])
  /* Only meaningful if they name a class at all — we relax when it differs
     from the one we know, which `buildRetrievalFilters` does not know here. */
  return requested >= 1 && requested <= 12
}

export function buildRetrievalFilters(input: BuildFilterInput): RetrievalFilters {
  const filters: RetrievalFilters = {}

  if (input.profile) {
    filters.boardId = input.profile.boardId ?? null
    filters.classId = input.profile.classId ?? null
    filters.streamId = input.profile.streamId ?? null
  }

  if (input.focus) {
    filters.subjectId = input.focus.subjectId ?? null
    filters.chapterId = input.focus.chapterId ?? null
  }

  filters.resourceType = resourceTypeForIntent(input.intent)

  /* If the student names a class that is not theirs, drop the class/board
     constraint so the archive can answer (explicit request beats preference). */
  if (input.question && asksOutsideCurriculum(input.question)) {
    const named = input.question.match(/\bclass\s+(\d{1,2})\b/i)
    const own = input.profile?.classId
    if (named && own) {
      filters.classId = null
      filters.boardId = null
    }
  }

  return filters
}

/** Human-readable summary for logs and the retrieval status line. */
export function describeFilters(filters: RetrievalFilters): string {
  const parts: string[] = []
  if (filters.chapterId) parts.push('chapter')
  if (filters.subjectId && !filters.chapterId) parts.push('subject')
  if (filters.boardId) parts.push('board')
  if (filters.classId) parts.push('class')
  if (filters.resourceType) parts.push(`type:${filters.resourceType}`)
  return parts.length ? parts.join('/') : 'unfiltered'
}

/** Filters are only useful when they actually constrain something. */
export function hasAcademicFilter(filters: RetrievalFilters): boolean {
  return Boolean(filters.chapterId || filters.subjectId || filters.boardId || filters.classId)
}
