/**
 * Progress service — learning analytics computed from real rows.
 *
 * Sources of truth:
 *   `study_history`         → minutes studied (only meaningful events are logged)
 *   `question_attempts`     → questions solved + accuracy
 *   `user_chapter_progress` → syllabus completion
 *   `bookmarks`             → chapter/resource favourites
 *
 * Everything the dashboard, progress report and profile statistics show is
 * derived here (never hard-coded in a component).
 */
import type {
  DayStudy,
  HistoryEntry,
  ProgressReport,
  ProgressSnapshot,
  SubjectStat,
  TopicStat,
} from '@/types'
import type { ChapterProgressRow, QuestionAttemptRow, StudyHistoryRow } from '@/types/progress'
import type { ChapterRow, SubjectRow } from '@/types/academic'
import { PROGRESS_REPORT as DEMO_REPORT } from '@/data/progress'
import { PROGRESS_SNAPSHOT as DEMO_SNAPSHOT } from '@/data/dashboard'
import { PROFILE as DEMO_PROFILE } from '@/data/profile'
import { getWeakChapters as demoWeakChapters } from '@/data/dashboard'
import { db, daysAgo, dayKey, isDemo, memo, resetMemo, rows, toSubjectId } from './shared'
import { getBookmarkedKeys } from './bookmark.service'

/** Daily study goal (from the signed-in profile) — used for goal rings. */
async function getDailyGoal(): Promise<number> {
  const client = db()
  if (!client) return 120
  const { data, error } = await client
    .from('profiles')
    .select('daily_goal_minutes')
    .maybeSingle()
  if (error || !data) return 120
  return data.daily_goal_minutes ?? 120
}

export interface WeakChapter {
  id: string
  subjectId: string
  subjectName: string
  chapter: string
  slug: string
  progress: number
  accuracy: number
}

interface ChapterAgg {
  attempts: number
  correct: number
  minutes: number
  accuracy: number
}

interface SubjectAgg {
  slug: string
  name: string
  minutes: number
  weekMinutes: number
  lastWeekMinutes: number
  questions: number
  correct: number
  accuracy: number
}

export interface ActivityData {
  history: StudyHistoryRow[]
  attempts: QuestionAttemptRow[]
  progress: ChapterProgressRow[]
  subjects: SubjectRow[]
  chapters: ChapterRow[]
  questions: { id: string; subject_id: string | null; chapter_id: string | null }[]
  byChapter: Map<string, ChapterAgg>
  bySubject: Map<string, SubjectAgg>
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function emptyActivity(): ActivityData {
  return {
    history: [],
    attempts: [],
    progress: [],
    subjects: [],
    chapters: [],
    questions: [],
    byChapter: new Map(),
    bySubject: new Map(),
  }
}

/** Everything analytics needs, in one (memoized) round of queries. */
export async function loadActivity(): Promise<ActivityData> {
  if (isDemo) return emptyActivity()
  const client = db()
  if (!client) return emptyActivity()

  return memo('activity', async () => {
    const since = daysAgo(60)
    const [history, attempts, progress, subjects, chapters, questions] = await Promise.all([
      rows<StudyHistoryRow>(
        client
          .from('study_history')
          .select('*')
          .gte('occurred_at', since)
          .order('occurred_at', { ascending: false })
          .limit(1000),
      ),
      rows<QuestionAttemptRow>(
        client
          .from('question_attempts')
          .select('*')
          .gte('attempted_at', since)
          .order('attempted_at', { ascending: false })
          .limit(1000),
      ),
      rows<ChapterProgressRow>(client.from('user_chapter_progress').select('*')),
      rows<SubjectRow>(client.from('subjects').select('*')),
      rows<ChapterRow>(client.from('chapters').select('*')),
      rows<{ id: string; subject_id: string | null; chapter_id: string | null }>(
        client.from('pyq_questions').select('id, subject_id, chapter_id'),
      ),
    ])

    const subjectById = new Map(subjects.map((row) => [row.id, row]))
    const questionById = new Map(questions.map((row) => [row.id, row]))

    const byChapter = new Map<string, ChapterAgg>()
    const bySubject = new Map<string, SubjectAgg>()

    const subjectAgg = (subjectId: string | null): SubjectAgg | undefined => {
      if (!subjectId) return undefined
      const row = subjectById.get(subjectId)
      if (!row) return undefined
      let agg = bySubject.get(row.slug)
      if (!agg) {
        agg = {
          slug: row.slug,
          name: row.name,
          minutes: 0,
          weekMinutes: 0,
          lastWeekMinutes: 0,
          questions: 0,
          correct: 0,
          accuracy: 0,
        }
        bySubject.set(row.slug, agg)
      }
      return agg
    }

    const weekStart = daysAgo(7)
    const lastWeekStart = daysAgo(14)

    history.forEach((entry) => {
      const agg = subjectAgg(entry.subject_id)
      if (!agg) return
      agg.minutes += entry.minutes
      if (entry.occurred_at >= weekStart) agg.weekMinutes += entry.minutes
      else if (entry.occurred_at >= lastWeekStart) agg.lastWeekMinutes += entry.minutes

      if (entry.chapter_id) {
        const chapter = byChapter.get(entry.chapter_id) ?? { attempts: 0, correct: 0, minutes: 0, accuracy: 0 }
        chapter.minutes += entry.minutes
        byChapter.set(entry.chapter_id, chapter)
      }
    })

    attempts.forEach((attempt) => {
      const question = questionById.get(attempt.question_id)
      const chapterId = question?.chapter_id ?? null
      const agg = subjectAgg(question?.subject_id ?? null)
      if (agg) {
        agg.questions += 1
        if (attempt.is_correct) agg.correct += 1
      }
      if (chapterId) {
        const chapter = byChapter.get(chapterId) ?? { attempts: 0, correct: 0, minutes: 0, accuracy: 0 }
        chapter.attempts += 1
        if (attempt.is_correct) chapter.correct += 1
        byChapter.set(chapterId, chapter)
      }
    })

    /* Derived ratios, computed once here so consumers never re-derive them. */
    bySubject.forEach((agg) => {
      agg.accuracy = agg.questions ? Math.round((agg.correct / agg.questions) * 100) : 0
    })
    byChapter.forEach((agg) => {
      agg.accuracy = agg.attempts ? Math.round((agg.correct / agg.attempts) * 100) : 0
    })

    return { history, attempts, progress, subjects, chapters, questions, byChapter, bySubject }
  })
}

/** `chapter_id → completion %` for building the Library chapter cards. */
export async function getChapterProgressMap(): Promise<Map<string, number>> {
  const activity = await loadActivity()
  const map = new Map<string, number>()
  activity.progress.forEach((row) => map.set(row.chapter_id, row.completion_percent))
  return map
}

/** Subject/chapter aggregates used for accuracy, weak chapters and stats. */
export async function getSubjectActivity(): Promise<ActivityData> {
  return loadActivity()
}

/* ------------------------------- streak math ------------------------------ */

function computeStreak(activity: ActivityData): number {
  const activeDays = new Set<string>()
  activity.history.forEach((entry) => activeDays.add(dayKey(entry.occurred_at)))
  activity.attempts.forEach((entry) => activeDays.add(dayKey(entry.attempted_at)))
  activity.progress.forEach((row) => {
    if (row.last_studied_at) activeDays.add(dayKey(row.last_studied_at))
  })
  if (!activeDays.size) return 0

  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  /* A streak may start yesterday (today's session is still ahead). */
  if (!activeDays.has(dayKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!activeDays.has(dayKey(cursor.toISOString()))) return 0
  }

  let streak = 0
  while (activeDays.has(dayKey(cursor.toISOString()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function sumMinutes(list: StudyHistoryRow[], from: string, to?: string): number {
  return list
    .filter((entry) => entry.occurred_at >= from && (!to || entry.occurred_at < to))
    .reduce((sum, entry) => sum + entry.minutes, 0)
}

function countAttempts(list: QuestionAttemptRow[], from: string, to?: string): number {
  return list.filter((entry) => entry.attempted_at >= from && (!to || entry.attempted_at < to)).length
}

function accuracyOf(list: QuestionAttemptRow[], from: string, to?: string): number {
  const window = list.filter((entry) => entry.attempted_at >= from && (!to || entry.attempted_at < to))
  if (!window.length) return 0
  return Math.round((window.filter((entry) => entry.is_correct).length / window.length) * 100)
}

function trendPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

/* --------------------------------- report --------------------------------- */

export interface UserStats {
  streak: number
  weekMinutes: number
  questionsSolved: number
  totalAttempts: number
  accuracy: number
  chaptersCompleted: number
  studyMinutes: number
  subjects: string[]
  savedResources: number
}

export async function getStats(): Promise<UserStats> {
  if (isDemo) {
    return {
      streak: DEMO_PROFILE.streak,
      weekMinutes: DEMO_REPORT.weekMinutes,
      questionsSolved: DEMO_PROFILE.questionsSolved,
      totalAttempts: DEMO_PROFILE.questionsSolved,
      accuracy: DEMO_REPORT.averageAccuracy,
      chaptersCompleted: DEMO_PROFILE.chaptersCompleted,
      studyMinutes: DEMO_PROFILE.studyMinutes,
      subjects: DEMO_PROFILE.subjects,
      savedResources: DEMO_PROFILE.savedResources,
    }
  }

  const [activity, bookmarks] = await Promise.all([loadActivity(), getBookmarkedKeys()])
  const completed = activity.progress.filter((row) => row.completion_percent >= 100).length
  const subjects = Array.from(new Set(activity.bySubject.keys()))

  return {
    streak: computeStreak(activity),
    weekMinutes: sumMinutes(activity.history, daysAgo(7)),
    questionsSolved: countAttempts(activity.attempts, daysAgo(7)),
    totalAttempts: activity.attempts.length,
    accuracy: accuracyOf(activity.attempts, daysAgo(7)),
    chaptersCompleted: completed,
    studyMinutes: activity.history.reduce((sum, entry) => sum + entry.minutes, 0),
    subjects: subjects.length ? subjects : DEMO_PROFILE.subjects,
    savedResources: bookmarks.size,
  }
}

/** Dashboard snapshot (4 numbers). */
export async function getSnapshot(): Promise<ProgressSnapshot> {
  if (isDemo) return DEMO_SNAPSHOT
  const stats = await getStats()
  return {
    weekMinutes: stats.weekMinutes,
    questionsSolved: stats.questionsSolved,
    accuracy: stats.accuracy,
    streak: stats.streak,
  }
}

/** Full analytics report behind `/progress`. */
export async function getProgress(): Promise<ProgressReport> {
  if (isDemo) return DEMO_REPORT

  const [activity, dailyGoal] = await Promise.all([loadActivity(), getDailyGoal()])

  const daily: DayStudy[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - offset)
    const key = dayKey(date.toISOString())
    const minutes = activity.history
      .filter((entry) => dayKey(entry.occurred_at) === key)
      .reduce((sum, entry) => sum + entry.minutes, 0)
    const questions = activity.attempts.filter((entry) => dayKey(entry.attempted_at) === key).length
    daily.push({ day: WEEK_DAYS[(date.getDay() + 6) % 7], minutes, questions })
  }

  const weekMinutes = sumMinutes(activity.history, daysAgo(7))
  const prevWeekMinutes = sumMinutes(activity.history, daysAgo(14), daysAgo(7))
  const questionsSolved = countAttempts(activity.attempts, daysAgo(7))
  const prevQuestions = countAttempts(activity.attempts, daysAgo(14), daysAgo(7))
  const averageAccuracy = accuracyOf(activity.attempts, daysAgo(7))
  const prevAccuracy = accuracyOf(activity.attempts, daysAgo(14), daysAgo(7))

  const chapterName = new Map(activity.chapters.map((row) => [row.id, row]))
  const subjectName = new Map(activity.subjects.map((row) => [row.id, row]))

  const subjectStats: SubjectStat[] = Array.from(activity.bySubject.values())
    .map((agg) => ({
      subjectId: toSubjectId(agg.slug),
      subjectName: agg.name,
      accuracy: agg.questions ? Math.round((agg.correct / agg.questions) * 100) : 0,
      questions: agg.questions,
      minutes: agg.minutes,
      trend: trendPct(agg.weekMinutes, agg.lastWeekMinutes),
    }))
    .filter((stat) => stat.questions > 0 || stat.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)

  const chapterScores = Array.from(activity.byChapter.entries())
    .filter(([, agg]) => agg.attempts > 0)
    .map(([chapterId, agg]) => {
      const chapter = chapterName.get(chapterId)
      const subject = chapter ? subjectName.get(chapter.subject_id) : undefined
      return {
        topic: chapter?.name ?? 'Chapter',
        subjectId: toSubjectId(subject?.slug),
        value: Math.round((agg.correct / agg.attempts) * 100),
      }
    })

  const strongest: TopicStat[] = [...chapterScores].sort((a, b) => b.value - a.value).slice(0, 4)
  const weakest: TopicStat[] = [...chapterScores].sort((a, b) => a.value - b.value).slice(0, 4)

  const chaptersCompleted = activity.progress.filter((row) => row.completion_percent >= 100).length
  const totalChapters = activity.chapters.length
  const syllabus = totalChapters ? Math.round((chaptersCompleted / totalChapters) * 100) : 0
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const completedGoalMinutes = sumMinutes(activity.history, monthStart.toISOString())

  return {
    weekMinutes,
    weekMinutesTrend: trendPct(weekMinutes, prevWeekMinutes),
    questionsSolved,
    questionsTrend: trendPct(questionsSolved, prevQuestions),
    averageAccuracy,
    accuracyTrend: averageAccuracy - prevAccuracy,
    chaptersCompleted,
    streak: computeStreak(activity),
    daily,
    subjectStats,
    strongest,
    weakest,
    rings: [
      { label: 'Syllabus covered', value: syllabus, color: 'brand' },
      { label: 'Weekly goal', value: Math.min(100, Math.round((weekMinutes / (dailyGoal * 7)) * 100)), color: 'accent' },
      { label: 'PYQ completion', value: syllabus, color: 'warning' },
    ],
    monthlyGoalMinutes: dailyGoal * 30,
    completedGoalMinutes,
  }
}

/**
 * Weakest chapters: lowest attempt accuracy first, then low-completion
 * chapters the student has actually opened.
 */
export async function getWeakChapters(limit = 4): Promise<WeakChapter[]> {
  if (isDemo) return demoWeakChapters(limit)

  const activity = await loadActivity()
  const chapterName = new Map(activity.chapters.map((row) => [row.id, row]))
  const subjectName = new Map(activity.subjects.map((row) => [row.id, row]))
  const progressMap = new Map(activity.progress.map((row) => [row.chapter_id, row.completion_percent]))

  const weak = Array.from(activity.byChapter.entries())
    .filter(([chapterId, agg]) => agg.attempts >= 3 && agg.correct / agg.attempts < 0.55)
    .map(([chapterId, agg]) => {
      const chapter = chapterName.get(chapterId)
      const subject = chapter ? subjectName.get(chapter.subject_id) : undefined
      return {
        id: chapterId,
        subjectId: subject?.slug ?? 'physics',
        subjectName: subject?.name ?? 'Physics',
        chapter: chapter?.name ?? 'Chapter',
        slug: chapter?.slug ?? '',
        progress: progressMap.get(chapterId) ?? 0,
        accuracy: Math.round((agg.correct / agg.attempts) * 100),
      }
    })
    .sort((a, b) => a.accuracy - b.accuracy)

  if (weak.length >= limit) return weak.slice(0, limit)

  /* Not enough attempts yet → surface low-completion chapters instead. */
  const filler = activity.chapters
    .filter((chapter) => !weak.some((row) => row.id === chapter.id))
    .filter((chapter) => (progressMap.get(chapter.id) ?? 0) < 50)
    .sort((a, b) => (progressMap.get(a.id) ?? 0) - (progressMap.get(b.id) ?? 0))
    .slice(0, limit - weak.length)
    .map((chapter) => {
      const subject = subjectName.get(chapter.subject_id)
      const agg = activity.byChapter.get(chapter.id)
      return {
        id: chapter.id,
        subjectId: subject?.slug ?? 'physics',
        subjectName: subject?.name ?? 'Physics',
        chapter: chapter.name,
        slug: chapter.slug,
        progress: progressMap.get(chapter.id) ?? 0,
        accuracy: agg && agg.attempts ? Math.round((agg.correct / agg.attempts) * 100) : 0,
      }
    })

  return [...weak, ...filler].slice(0, limit)
}

/** Recent study history (profile activity feed). */
export async function getHistory(limit = 6): Promise<HistoryEntry[]> {
  if (isDemo) return DEMO_PROFILE.history.slice(0, limit)

  const activity = await loadActivity()
  const chapterName = new Map(activity.chapters.map((row) => [row.id, row]))
  const subjectName = new Map(activity.subjects.map((row) => [row.id, row]))

  return activity.history.slice(0, limit).map((entry) => {
    const subject = entry.subject_id ? subjectName.get(entry.subject_id) : undefined
    return {
      id: entry.id,
      date: entry.occurred_at.slice(0, 10),
      title: entry.title,
      subjectId: toSubjectId(subject?.slug ?? chapterName.get(entry.chapter_id ?? '')?.subject_id),
      minutes: entry.minutes,
      questions: entry.questions,
    }
  })
}

/* ------------------------------- mutations -------------------------------- */

async function currentUserId(): Promise<string | null> {
  const client = db()
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

/** Save chapter completion (also feeds the streak + activity feed). */
export async function recordChapterProgress(input: {
  chapterId: string
  completionPercent: number
  secondsStudied?: number
  subjectId?: string | null
  title?: string
}): Promise<void> {
  const client = db()
  const userId = await currentUserId()
  if (!client || !userId) return

  const percent = Math.max(0, Math.min(100, Math.round(input.completionPercent)))
  await client.from('user_chapter_progress').upsert(
    {
      user_id: userId,
      chapter_id: input.chapterId,
      completion_percent: percent,
      total_time_seconds: input.secondsStudied ?? 0,
      last_studied_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,chapter_id' },
  )

  if (input.secondsStudied && input.secondsStudied > 0) {
    await client.from('study_history').insert({
      user_id: userId,
      event_type: 'chapter_studied',
      chapter_id: input.chapterId,
      subject_id: input.subjectId ?? null,
      title: input.title ?? 'Chapter studied',
      minutes: Math.max(1, Math.round(input.secondsStudied / 60)),
      questions: 0,
      occurred_at: new Date().toISOString(),
    })
  }
}

/** Record a solved question (drives accuracy + weak chapters). */
export async function recordAttempt(input: {
  questionId: string
  selectedAnswer?: string | null
  isCorrect: boolean
  timeTakenSeconds?: number | null
}): Promise<void> {
  const client = db()
  const userId = await currentUserId()
  if (!client || !userId) return

  await client.from('question_attempts').insert({
    user_id: userId,
    question_id: input.questionId,
    selected_answer: input.selectedAnswer ?? null,
    is_correct: input.isCorrect,
    time_taken_seconds: input.timeTakenSeconds ?? null,
    attempted_at: new Date().toISOString(),
  })
}

/** "Resource opened" — one line in Recent Activity. */
export async function recordResourceOpen(input: {
  resourceId: string
  title: string
  subjectId?: string | null
  chapterId?: string | null
}): Promise<void> {
  const client = db()
  const userId = await currentUserId()
  if (!client || !userId) return

  await client.from('user_resource_progress').upsert(
    {
      user_id: userId,
      resource_id: input.resourceId,
      last_opened_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,resource_id' },
  )

  await client.from('study_history').insert({
    user_id: userId,
    event_type: 'resource_opened',
    resource_id: input.resourceId,
    subject_id: input.subjectId ?? null,
    chapter_id: input.chapterId ?? null,
    title: input.title,
    minutes: 0,
    questions: 0,
    occurred_at: new Date().toISOString(),
  })
}

/** Finished study session → minutes in the activity feed. */
export async function recordSessionCompleted(input: {
  title: string
  subjectId?: string | null
  chapterId?: string | null
  minutes: number
}): Promise<void> {
  const client = db()
  const userId = await currentUserId()
  if (!client || !userId) return

  await client.from('study_history').insert({
    user_id: userId,
    event_type: 'session_completed',
    subject_id: input.subjectId ?? null,
    chapter_id: input.chapterId ?? null,
    title: input.title,
    minutes: input.minutes,
    questions: 0,
    occurred_at: new Date().toISOString(),
  })
}
