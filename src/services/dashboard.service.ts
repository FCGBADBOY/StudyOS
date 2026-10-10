/**
 * Dashboard composition + the rule-based "recommended study session".
 *
 * Everything on the home screen comes from here (one round of queries), and
 * the recommendation stays deliberately explainable — no ML in this phase:
 *
 *   score(chapter) =
 *       weak chapter (low recent accuracy)          +40
 *     + subject has an exam within 14 days          +25
 *     + no activity in the last 48 hours            +15
 *     + syllabus progress below 50%                 +10
 *     + frequently asked in the PYQ archive         +0…15
 *
 * The highest scoring chapter becomes "Today's study"; the reason string shown
 * to the student is composed from the same signals.
 */
import type {
  ContinueItem,
  Exam,
  HistoryEntry,
  ProgressSnapshot,
  QuickAction,
  TodayFocus,
} from '@/types'
import {
  CONTINUE_STUDYING as DEMO_CONTINUE,
  PROGRESS_SNAPSHOT as DEMO_SNAPSHOT,
  QUICK_ACTIONS,
  TODAY_FOCUS as DEMO_FOCUS,
  getWeakChapters as demoWeak,
} from '@/data/dashboard'
import { EXAMS as DEMO_EXAMS } from '@/data/exams'
import { PROFILE as DEMO_PROFILE } from '@/data/profile'
import { MISTAKES as DEMO_MISTAKES } from '@/data/mistakes'
import { readLocal } from '@/utils/storage'
import { dayKey, isDemo } from './shared'
import { getWeakChapters, loadActivity, getSnapshot, getHistory, type WeakChapter } from './progress.service'
import { getExams } from './exam.service'
import { getMistakes } from './mistakebook.service'

export interface DashboardData {
  snapshot: ProgressSnapshot
  focus: TodayFocus | null
  continueStudying: ContinueItem[]
  weakChapters: WeakChapter[]
  exams: Exam[]
  recent: HistoryEntry[]
  quickActions: QuickAction[]
  syllabus: { completed: number; total: number; percent: number }
  todayMinutes: number
  goalMinutes: number
}

/* ------------------------------ recommendations --------------------------- */

interface FocusCandidate {
  chapterId: string
  chapter: string
  slug: string
  subjectId: string
  subjectName: string
  progress: number
  accuracy: number
  pyqCount: number
  lastStudied: string | null
  score: number
  reasons: string[]
}

/**
 * Rule-based study priority. Pure function — unit-testable and easy to swap
 * for a smarter model in a later phase.
 */
export function rankFocusCandidates(input: {
  weakChapters: WeakChapter[]
  chapters: { id: string; name: string; slug: string; subjectSlug: string; subjectName: string; progress: number }[]
  accuracyByChapter: Map<string, number>
  pyqByChapter: Map<string, number>
  lastStudiedByChapter: Map<string, string>
  examSubjects: Set<string>
  examSoon: boolean
  now?: Date
}): FocusCandidate[] {
  const now = input.now ?? new Date()
  const weakIds = new Set(input.weakChapters.map((row) => row.id))

  return input.chapters
    .map<FocusCandidate>((chapter) => {
      const accuracy = input.accuracyByChapter.get(chapter.id)
      const lastStudied = input.lastStudiedByChapter.get(chapter.id) ?? null
      const pyqCount = input.pyqByChapter.get(chapter.id) ?? 0
      const reasons: string[] = []
      let score = 0

      if (weakIds.has(chapter.id) || (accuracy !== undefined && accuracy < 55)) {
        score += 40
        reasons.push('a weak chapter for you')
      }
      if (input.examSoon && input.examSubjects.has(chapter.subjectSlug)) {
        score += 25
        reasons.push('an exam is coming up')
      }
      const idleFor = lastStudied ? (now.getTime() - new Date(lastStudied).getTime()) / 3_600_000 : Infinity
      if (idleFor > 48) {
        score += 15
        reasons.push(lastStudied ? 'you have not touched it in a while' : 'you have not started it yet')
      }
      if (chapter.progress < 50) {
        score += 10
      }
      if (pyqCount > 0) {
        score += Math.min(15, pyqCount)
        reasons.push(`asked ${pyqCount} time${pyqCount === 1 ? '' : 's'} in the archive`)
      }

      return {
        chapterId: chapter.id,
        chapter: chapter.name,
        slug: chapter.slug,
        subjectId: chapter.subjectSlug,
        subjectName: chapter.subjectName,
        progress: chapter.progress,
        accuracy: accuracy ?? 0,
        pyqCount,
        lastStudied,
        score,
        reasons,
      }
    })
    .sort((a, b) => b.score - a.score)
}

function toFocus(candidate: FocusCandidate): TodayFocus {
  const reason = candidate.reasons.length
    ? `Recommended because ${candidate.reasons.slice(0, 2).join(' and ')}.`
    : 'A good next step in your syllabus.'

  return {
    id: `focus-${candidate.chapterId}`,
    title: candidate.chapter,
    subjectId: candidate.subjectId as TodayFocus['subjectId'],
    subjectName: candidate.subjectName,
    minutes: candidate.progress < 50 ? 45 : 30,
    difficulty: candidate.accuracy < 45 ? 'Hard' : candidate.accuracy < 70 ? 'Moderate' : 'Easy',
    progress: candidate.progress,
    reason,
  }
}

/* --------------------------------- loading -------------------------------- */

async function goalMinutes(): Promise<number> {
  const local = readLocal<{ dailyGoalMinutes?: number }>('onboarding', { dailyGoalMinutes: 120 })
  return local.dailyGoalMinutes ?? 120
}

export async function getDashboard(): Promise<DashboardData> {
  if (isDemo) {
    const weak = demoWeak(4)
    const openMistakes = DEMO_MISTAKES.filter((entry) => !entry.reviewed).length
    const totalChapters = 58
    const completedChapters = DEMO_PROFILE.chaptersCompleted

    return {
      snapshot: DEMO_SNAPSHOT,
      focus: DEMO_FOCUS,
      continueStudying: DEMO_CONTINUE,
      weakChapters: weak,
      exams: DEMO_EXAMS.filter((exam) => exam.date >= dayKey(new Date().toISOString())),
      recent: DEMO_PROFILE.history,
      quickActions: QUICK_ACTIONS.map((action) =>
        action.id === 'mistakes'
          ? { ...action, hint: `${openMistakes} to revise` }
          : action.id === 'pyq'
            ? { ...action, hint: `${DEMO_PROFILE.questionsSolved.toLocaleString('en-IN')} solved` }
            : action,
      ),
      syllabus: {
        completed: completedChapters,
        total: totalChapters,
        percent: Math.round((completedChapters / totalChapters) * 100),
      },
      todayMinutes: 74,
      goalMinutes: await goalMinutes(),
    }
  }

  const [snapshot, activity, weakChapters, exams, history, mistakes] = await Promise.all([
    getSnapshot(),
    loadActivity(),
    getWeakChapters(4),
    getExams(),
    getHistory(4),
    getMistakes(),
  ])

  const chapterById = new Map(activity.chapters.map((row) => [row.id, row]))
  const subjectById = new Map(activity.subjects.map((row) => [row.id, row]))
  const progressById = new Map(activity.progress.map((row) => [row.chapter_id, row]))

  const accuracyByChapter = new Map<string, number>()
  activity.byChapter.forEach((agg, chapterId) => {
    if (agg.attempts > 0) accuracyByChapter.set(chapterId, Math.round((agg.correct / agg.attempts) * 100))
  })

  const examSoon = exams.some((exam) => {
    const days = (new Date(`${exam.date}T00:00:00`).getTime() - Date.now()) / 86_400_000
    return days >= 0 && days <= 14
  })
  const examSubjects = new Set(exams.flatMap((exam) => exam.subjects.map((subject) => String(subject))))

  const chapters = activity.chapters.map((chapter) => {
    const subject = subjectById.get(chapter.subject_id)
    return {
      id: chapter.id,
      name: chapter.name,
      slug: chapter.slug,
      subjectSlug: subject?.slug ?? 'physics',
      subjectName: subject?.name ?? 'Physics',
      progress: progressById.get(chapter.id)?.completion_percent ?? 0,
    }
  })

  const ranked = rankFocusCandidates({
    weakChapters,
    chapters,
    accuracyByChapter,
    pyqByChapter: pyqCounts(activity),
    lastStudiedByChapter: new Map(
      activity.progress.filter((row) => row.last_studied_at).map((row) => [row.chapter_id, row.last_studied_at as string]),
    ),
    examSubjects,
    examSoon,
  })

  const top = ranked[0]
  const focus = top && top.score > 0 ? toFocus(top) : null

  /* Continue studying: opened but unfinished, most recent first. */
  const continueStudying: ContinueItem[] = activity.progress
    .filter((row) => row.completion_percent > 0 && row.completion_percent < 100)
    .sort((a, b) => (b.last_studied_at ?? '').localeCompare(a.last_studied_at ?? ''))
    .slice(0, 4)
    .map((row) => {
      const chapter = chapterById.get(row.chapter_id)
      const subject = chapter ? subjectById.get(chapter.subject_id) : undefined
      const minutesLeft = Math.max(
        5,
        Math.round((chapter?.estimated_minutes ?? 90) * (1 - row.completion_percent / 100)),
      )
      return {
        id: row.id,
        subjectId: (subject?.slug ?? 'physics') as ContinueItem['subjectId'],
        subjectName: subject?.name ?? 'Physics',
        chapterSlug: chapter?.slug ?? '',
        chapter: chapter?.name ?? 'Chapter',
        progress: row.completion_percent,
        lastStudied: relativePast(row.last_studied_at),
        minutesLeft,
      }
    })

  const totalChapters = activity.chapters.length
  const completed = activity.progress.filter((row) => row.completion_percent >= 100).length
  const openMistakes = mistakes.filter((entry) => !entry.reviewed).length
  const today = dayKey(new Date().toISOString())
  const todayMinutes = activity.history
    .filter((entry) => dayKey(entry.occurred_at) === today)
    .reduce((sum, entry) => sum + entry.minutes, 0)

  return {
    snapshot,
    focus,
    continueStudying,
    weakChapters,
    exams,
    recent: history,
    quickActions: QUICK_ACTIONS.map((action) =>
      action.id === 'mistakes'
        ? { ...action, hint: `${openMistakes} to revise` }
        : action.id === 'pyq'
          ? { ...action, hint: `${snapshot.questionsSolved.toLocaleString('en-IN')} solved this week` }
          : action,
    ),
    syllabus: {
      completed,
      total: totalChapters,
      percent: totalChapters ? Math.round((completed / totalChapters) * 100) : 0,
    },
    todayMinutes,
    goalMinutes: await goalMinutes(),
  }
}

function pyqCounts(activity: Awaited<ReturnType<typeof loadActivity>>): Map<string, number> {
  const counts = new Map<string, number>()
  /* PYQ volume per chapter comes from the loaded questions list. */
  activity.questions.forEach((question) => {
    if (!question.chapter_id) return
    counts.set(question.chapter_id, (counts.get(question.chapter_id) ?? 0) + 1)
  })
  return counts
}

function relativePast(iso: string | null): string {
  if (!iso) return 'not yet'
  const then = new Date(iso).getTime()
  const hours = Math.round((Date.now() - then) / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'} ago`
}
