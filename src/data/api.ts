/**
 * ---------------------------------------------------------------------------
 * Mock service layer (the future backend seam).
 * ---------------------------------------------------------------------------
 * Every screen talks to `api.*` instead of importing data files directly, so
 * connecting a real backend later only means changing this file:
 *
 *   const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/subjects`)
 *   return res.json()
 *
 * Today every method resolves local mock data after a short, realistic latency.
 */
import type {
  Mistake,
  ProgressReport,
  PyqOverview,
  PyqQuestion,
  Resource,
  SearchCategory,
  SearchResult,
  Subject,
} from '@/types'
import { SUBJECTS, findChapterBySlug, getChapter, getSubject } from './subjects'
import { EXAMS } from './exams'
import { MISTAKES } from './mistakes'
import { PROGRESS_REPORT } from './progress'
import { PYQ_OVERVIEW, questionsForSubject, getPaper, papersForSubject } from './pyq'
import { FORMULAS, searchFormulas } from './formulas'
import { REACTIONS } from './reactions'
import { TODAY_SESSIONS, WEEK_PLAN } from './planner'
import { SEARCH_INDEX, searchIndex } from './search'
import { PROFILE } from './profile'
import { NOTIFICATIONS } from './notifications'
import {
  buildChapterResources,
  buildSubjectResources,
} from './resources'
import { buildTutorReply, type TutorMode, type TutorReply } from './tutor'
import type { Chapter, Exam, PyqPaper, StudySession, WeeklyPlanDay } from '@/types'

/** Simulated network latency (ms). */
function delay(ms = 220): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export const api = {
  /* ----------------------------- academics ------------------------------ */
  async getSubjects(): Promise<Subject[]> {
    await delay(160)
    return SUBJECTS
  },

  async getSubject(id?: string): Promise<Subject | undefined> {
    await delay(140)
    return getSubject(id)
  },

  async getChapter(subjectId?: string, chapterSlug?: string) {
    await delay(150)
    return getChapter(subjectId, chapterSlug)
  },

  async findChapter(chapterSlug: string) {
    await delay(120)
    return findChapterBySlug(chapterSlug)
  },

  /* ------------------------------ content ------------------------------- */
  async getChapterResources(subjectId: string, chapterSlug: string): Promise<Resource[]> {
    await delay(200)
    const match = getChapter(subjectId, chapterSlug)
    if (!match) return []
    return buildChapterResources(match.subject, match.chapter)
  },

  async getSubjectResources(subjectId?: string): Promise<Resource[]> {
    await delay(180)
    const subject = getSubject(subjectId)
    return subject ? buildSubjectResources(subject) : []
  },

  async getExams(): Promise<Exam[]> {
    await delay(120)
    return EXAMS
  },

  async getNotifications() {
    await delay(100)
    return NOTIFICATIONS
  },

  /* -------------------------------- PYQ --------------------------------- */
  async getPyqOverview(): Promise<PyqOverview> {
    await delay(260)
    return PYQ_OVERVIEW
  },

  async getPyqQuestions(subjectId?: string): Promise<PyqQuestion[]> {
    await delay(200)
    return questionsForSubject(subjectId)
  },

  async getPyqPapers(subjectId?: string): Promise<PyqPaper[]> {
    await delay(180)
    return papersForSubject(subjectId)
  },

  async getPaper(slug?: string): Promise<PyqPaper | undefined> {
    await delay(160)
    return getPaper(slug)
  },

  /* ----------------------------- progress -------------------------------- */
  async getProgress(): Promise<ProgressReport> {
    await delay(240)
    return PROGRESS_REPORT
  },

  async getMistakes(): Promise<Mistake[]> {
    await delay(200)
    return MISTAKES
  },

  async getPlanner(): Promise<{ today: StudySession[]; week: WeeklyPlanDay[] }> {
    await delay(180)
    return { today: TODAY_SESSIONS, week: WEEK_PLAN }
  },

  async getFormulas(query = ''): Promise<typeof FORMULAS> {
    await delay(160)
    return query ? searchFormulas(query) : FORMULAS
  },

  async getReactions() {
    await delay(140)
    return REACTIONS
  },

  async getProfile() {
    await delay(120)
    return PROFILE
  },

  /* ------------------------------ search --------------------------------- */
  async search(query: string, category: SearchCategory = 'All'): Promise<SearchResult[]> {
    await delay(240)
    if (!query.trim()) return SEARCH_INDEX.slice(0, 6)
    return searchIndex(query, category)
  },

  /* ----------------------------- AI tutor -------------------------------- */
  async askTutor(prompt: string, mode: TutorMode = 'explain'): Promise<TutorReply> {
    await delay(900)
    return buildTutorReply(prompt, mode)
  },
}

export type Api = typeof api
