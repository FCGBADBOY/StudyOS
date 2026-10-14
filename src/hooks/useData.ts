/**
 * Data hooks — one per domain, all built on `useQuery`.
 *
 * Components never touch Supabase directly: they call these hooks, which call
 * the service layer. Every hook returns the same `{ data, loading, error,
 * refetch }` contract so loading / empty / error states look identical
 * everywhere.
 */
import { useQuery } from './useQuery'
import { getBoards, getClasses, getStreams, getSubjects, getSubject, getChapterEntry } from '@/services/academic.service'
import { getChapterResources, getResources, getSubjectResources } from '@/services/resource.service'
import { getPaper, getPyqOverview, getPyqPapers, getPyqQuestions } from '@/services/pyq.service'
import { getProgress, getSnapshot, getWeakChapters } from '@/services/progress.service'
import { getMistakes } from '@/services/mistakebook.service'
import { getPlanner, getTodaySessions, getWeek } from '@/services/planner.service'
import { getBookmarkedKeys } from '@/services/bookmark.service'
import { getExams, getUpcomingExams } from '@/services/exam.service'
import { getProfile } from '@/services/profile.service'
import { getChapterProvenance } from '@/services/provenance.service'
import { getDashboard } from '@/services/dashboard.service'
import type { MistakeFilter, MistakeRowType } from '@/types/mistakes'
import type { PyqFilter } from '@/types/pyq'
import type { SubjectFilter } from '@/types/academic'
import type { ResourceFilter } from '@/types/resources'

/* -------------------------------- academics ------------------------------- */

export function useBoards() {
  return useQuery('boards', getBoards)
}

export function useClasses() {
  return useQuery('classes', getClasses)
}

export function useStreams() {
  return useQuery('streams', getStreams)
}

export function useSubjects(filter: SubjectFilter = {}, enabled = true) {
  const key = `subjects:${filter.board ?? ''}:${filter.classId ?? ''}:${filter.streamId ?? ''}`
  return useQuery(key, () => getSubjects(filter), { enabled })
}

export function useSubject(subjectId?: string, filter: SubjectFilter = {}) {
  const key = subjectId ? `subject:${subjectId}:${filter.classId ?? ''}:${filter.streamId ?? ''}` : null
  return useQuery(key, () => getSubject(subjectId, filter), { enabled: Boolean(subjectId) })
}

export function useChapter(subjectId?: string, chapterSlug?: string, filter: SubjectFilter = {}) {
  const key =
    subjectId && chapterSlug ? `chapter:${subjectId}:${chapterSlug}:${filter.classId ?? ''}` : null
  return useQuery(key, () => getChapterEntry(subjectId, chapterSlug, filter), {
    enabled: Boolean(subjectId && chapterSlug),
  })
}

/* -------------------------------- resources ------------------------------- */

export function useResources(filter: ResourceFilter = {}, enabled = true) {
  const key = `resources:${filter.chapterSlug ?? ''}:${filter.subjectSlug ?? ''}:${filter.type ?? ''}`
  return useQuery(key, () => getResources(filter), { enabled })
}

export function useChapterResources(subjectId?: string, chapterSlug?: string) {
  const key = subjectId && chapterSlug ? `resources:chapter:${subjectId}:${chapterSlug}` : null
  return useQuery(key, () => getChapterResources(subjectId as string, chapterSlug as string), {
    enabled: Boolean(subjectId && chapterSlug),
  })
}

export function useSubjectResources(subjectId?: string) {
  const key = subjectId ? `resources:subject:${subjectId}` : null
  return useQuery(key, () => getSubjectResources(subjectId), { enabled: Boolean(subjectId) })
}

/** Attribution records for one chapter's published material (spec §51). */
export function useChapterProvenance(chapterId?: string) {
  const key = chapterId ? `provenance:chapter:${chapterId}` : null
  return useQuery(key, () => getChapterProvenance(chapterId as string), { enabled: Boolean(chapterId) })
}

/* ----------------------------------- PYQ ---------------------------------- */

export function usePyqOverview() {
  return useQuery('pyq:overview:ui', getPyqOverview)
}

export function usePyqQuestions(filter: PyqFilter = {}) {
  const key = `pyq:q:${filter.subjectSlug ?? ''}:${filter.chapterSlug ?? ''}:${filter.year ?? ''}:${filter.marks ?? ''}:${filter.difficulty ?? ''}:${filter.important ? 'i' : ''}`
  return useQuery(key, () => getPyqQuestions(filter))
}

export function usePyqPapers(subjectId?: string) {
  return useQuery(`pyq:papers:${subjectId ?? 'all'}`, () => getPyqPapers(subjectId))
}

export function usePaper(slug?: string) {
  return useQuery(slug ? `pyq:paper:${slug}` : null, () => getPaper(slug), { enabled: Boolean(slug) })
}

/* --------------------------------- progress -------------------------------- */

export function useProgress() {
  return useQuery('progress:report', getProgress)
}

export function useSnapshot() {
  return useQuery('progress:snapshot', getSnapshot)
}

export function useWeakChapters(limit = 4) {
  return useQuery(`progress:weak:${limit}`, () => getWeakChapters(limit))
}

/* ------------------------------- mistake book ------------------------------ */

export function useMistakes(filter: MistakeFilter = {}) {
  const key = `mistakes:${filter.subjectSlug ?? ''}:${filter.chapterSlug ?? ''}:${filter.type ?? ''}:${filter.resolved ?? ''}`
  return useQuery(key, () => getMistakes(filter))
}

export type { MistakeFilter, MistakeRowType }

/* --------------------------------- planner --------------------------------- */

export function usePlanner() {
  return useQuery('planner:week', getPlanner)
}

export function useTodaySessions() {
  return useQuery('planner:today', getTodaySessions)
}

export function useWeek() {
  return useQuery('planner:weekdays', getWeek)
}

/* ------------------------ bookmarks · exams · profile ---------------------- */

export function useBookmarks() {
  return useQuery('bookmarks', getBookmarkedKeys)
}

export function useExams() {
  return useQuery('exams:upcoming', getExams)
}

export function useUpcomingExams(limit = 5) {
  return useQuery(`exams:next:${limit}`, () => getUpcomingExams(limit))
}

export function useProfile() {
  return useQuery('profile', getProfile)
}

export function useDashboard() {
  return useQuery('dashboard', getDashboard)
}
