/**
 * Admin service: platform analytics.
 *
 * Every number here comes from a `public.admin_*()` RPC (migration 0014), so
 * aggregation happens in PostgreSQL and the browser only ever receives the
 * finished series. This satisfies the two rules that matter for a CMS that
 * will grow: never download a table to compute one statistic, and never put
 * giant SQL inside a React component.
 *
 * The RPCs are SECURITY DEFINER and re-check `analytics.view` themselves — a
 * student calling them directly gets a 42501, not data.
 */
import { db, isDemo } from '@/services/shared'
import type {
  GrowthPeriod,
  GrowthPoint,
  PlatformStats,
  PopularChapterRow,
  PopularSubjectRow,
  QuestionAccuracyRow,
} from '../types/admin'
import {
  DEMO_ADMINS_CHAPTERS,
  DEMO_ADMINS_PYQS,
  DEMO_ADMINS_RESOURCES,
  DEMO_ADMINS_SUBJECTS,
  DEMO_ADMINS_USERS,
} from '../data/adminDemo'

/* --------------------------------- stats ---------------------------------- */

/** Dashboard counters in a single round trip. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const client = db()
  if (!client) return demoStats()

  const { data, error } = await client.rpc('admin_platform_stats')
  if (error) throw new Error('We could not load the platform statistics.')

  return {
    students: Number(data?.students ?? 0),
    resources: Number(data?.resources ?? 0),
    pyqs: Number(data?.pyqs ?? 0),
    published: Number(data?.published ?? 0),
    pending_review: Number(data?.pending_review ?? 0),
    open_reports: Number(data?.open_reports ?? 0),
    drafts: Number(data?.drafts ?? 0),
    archived: Number(data?.archived ?? 0),
  }
}

function demoStats(): PlatformStats {
  const resources = DEMO_ADMINS_RESOURCES
  const activeUsers = DEMO_ADMINS_USERS.filter((user) => !user.suspended)
  return {
    students: activeUsers.length,
    resources: resources.length,
    pyqs: DEMO_ADMINS_PYQS.length,
    published: resources.filter((r) => r.status === 'published').length,
    pending_review: resources.filter((r) => r.status === 'pending_review').length,
    open_reports: 0,
    drafts: resources.filter((r) => r.status === 'draft').length,
    archived: resources.filter((r) => r.status === 'archived').length,
  }
}

/* --------------------------------- growth --------------------------------- */

/** `admin_user_growth(period)` as plain objects the charts can consume. */
export async function getUserGrowth(period: GrowthPeriod = 'month'): Promise<GrowthPoint[]> {
  const client = db()
  if (!client) return demoUserGrowth(period)

  const { data, error } = await client.rpc('admin_user_growth', { p_period: period })
  if (error) throw new Error('We could not load the user growth series.')

  return (data ?? []).map((row: Record<string, unknown>) => ({
    bucket: String(row.bucket ?? ''),
    label: String(row.label ?? ''),
    total: Number(row.total ?? 0),
  }))
}

/** `admin_content_growth(period)` — resources, PYQs and published over time. */
export async function getContentGrowth(period: GrowthPeriod = 'month'): Promise<GrowthPoint[]> {
  const client = db()
  if (!client) return demoContentGrowth(period)

  const { data, error } = await client.rpc('admin_content_growth', { p_period: period })
  if (error) throw new Error('We could not load the content growth series.')

  return (data ?? []).map((row: Record<string, unknown>) => ({
    bucket: String(row.bucket ?? ''),
    label: String(row.label ?? ''),
    resources: Number(row.resources ?? 0),
    pyqs: Number(row.pyqs ?? 0),
    published: Number(row.published ?? 0),
  }))
}

/* ------------------------------ popularity -------------------------------- */

export async function getPopularSubjects(limit = 8): Promise<PopularSubjectRow[]> {
  const client = db()
  if (!client) return demoPopularSubjects()

  const { data, error } = await client.rpc('admin_popular_subjects', { p_limit: limit })
  if (error) throw new Error('We could not load subject popularity.')

  return (data ?? []).map((row: Record<string, unknown>) => ({
    subject_id: String(row.subject_id ?? ''),
    subject_name: String(row.subject_name ?? ''),
    students: Number(row.students ?? 0),
    events: Number(row.events ?? 0),
    minutes: Number(row.minutes ?? 0),
  }))
}

export async function getPopularChapters(limit = 8): Promise<PopularChapterRow[]> {
  const client = db()
  if (!client) return demoPopularChapters()

  const { data, error } = await client.rpc('admin_popular_chapters', { p_limit: limit })
  if (error) throw new Error('We could not load chapter popularity.')

  return (data ?? []).map((row: Record<string, unknown>) => ({
    chapter_id: String(row.chapter_id ?? ''),
    chapter_name: String(row.chapter_name ?? ''),
    subject_name: String(row.subject_name ?? ''),
    students: Number(row.students ?? 0),
    events: Number(row.events ?? 0),
  }))
}

export async function getQuestionAccuracy(): Promise<QuestionAccuracyRow[]> {
  const client = db()
  if (!client) return demoQuestionAccuracy()

  const { data, error } = await client.rpc('admin_question_accuracy')
  if (error) throw new Error('We could not load question performance.')

  return (data ?? []).map((row: Record<string, unknown>) => ({
    subject_name: String(row.subject_name ?? ''),
    attempted: Number(row.attempted ?? 0),
    correct: Number(row.correct ?? 0),
    incorrect: Number(row.incorrect ?? 0),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
  }))
}

/* ------------------------------ demo series ------------------------------- */
/* Deterministic shapes so the analytics screen is stable between renders.   */

const MONTH_LABELS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']

function demoUserGrowth(period: GrowthPeriod): GrowthPoint[] {
  const count = period === 'day' ? 14 : period === 'week' ? 12 : 12
  const base = DEMO_ADMINS_USERS.length
  return Array.from({ length: count }, (_, index) => {
    const label =
      period === 'day' ? `${index + 1}` : period === 'week' ? `W${index + 1}` : MONTH_LABELS[index] ?? `${index + 1}`
    return {
      bucket: `bucket-${index}`,
      label,
      /* Steady climb with a gentle curve, capped at the demo population. */
      total: Math.min(base, Math.round((index + 1) * (base / count))),
    }
  })
}

function demoContentGrowth(period: GrowthPeriod): GrowthPoint[] {
  const count = period === 'day' ? 14 : 12
  const resources = DEMO_ADMINS_RESOURCES.length
  const pyqs = DEMO_ADMINS_PYQS.length

  return Array.from({ length: count }, (_, index) => {
    const label =
      period === 'day' ? `${index + 1}` : period === 'week' ? `W${index + 1}` : MONTH_LABELS[index] ?? `${index + 1}`
    const share = (index + 1) / count
    const resourceCount = Math.max(1, Math.round(resources * share))
    return {
      bucket: `bucket-${index}`,
      label,
      resources: resourceCount,
      pyqs: Math.max(1, Math.round(pyqs * share)),
      published: Math.max(0, Math.round(resourceCount * 0.55)),
    }
  })
}

function demoPopularSubjects(): PopularSubjectRow[] {
  const counts = new Map<string, { students: number; events: number; minutes: number }>()
  for (const question of DEMO_ADMINS_PYQS) {
    if (!question.subject_id) continue
    const entry = counts.get(question.subject_id) ?? { students: 0, events: 0, minutes: 0 }
    entry.events += 1
    entry.students += 6
    entry.minutes += 45
    counts.set(question.subject_id, entry)
  }

  return DEMO_ADMINS_SUBJECTS.filter((subject) => counts.has(subject.id))
    .map((subject) => {
      const entry = counts.get(subject.id) ?? { students: 0, events: 0, minutes: 0 }
      return {
        subject_id: subject.id,
        subject_name: subject.name,
        students: entry.students,
        events: entry.events,
        minutes: entry.minutes,
      }
    })
    .sort((a, b) => b.students - a.students || b.events - a.events)
}

function demoPopularChapters(): PopularChapterRow[] {
  const bySubject = new Map<string, string>()
  for (const subject of DEMO_ADMINS_SUBJECTS) bySubject.set(subject.id, subject.name)

  const counts = new Map<string, number>()
  for (const question of DEMO_ADMINS_PYQS) {
    if (!question.chapter_id) continue
    counts.set(question.chapter_id, (counts.get(question.chapter_id) ?? 0) + 1)
  }

  return DEMO_ADMINS_CHAPTERS.filter((chapter) => counts.has(chapter.id))
    .map((chapter) => ({
      chapter_id: chapter.id,
      chapter_name: chapter.name,
      subject_name: bySubject.get(chapter.subject_id) ?? '—',
      students: (counts.get(chapter.id) ?? 0) * 7,
      events: counts.get(chapter.id) ?? 0,
    }))
    .sort((a, b) => b.students - a.students || b.events - a.events)
}

function demoQuestionAccuracy(): QuestionAccuracyRow[] {
  const bySubject = new Map<string, { attempted: number; correct: number }>()
  const subjects = new Set<string>()

  for (const question of DEMO_ADMINS_PYQS) {
    if (!question.subject_id) continue
    subjects.add(question.subject_id)
    const entry = bySubject.get(question.subject_id) ?? { attempted: 0, correct: 0 }
    /* Deterministic split so the accuracy figure never jumps between renders. */
    const attempted = 24 + (question.question_text.length % 30)
    entry.attempted += attempted
    entry.correct += Math.round(attempted * (0.45 + (question.marks % 5) / 10))
    bySubject.set(question.subject_id, entry)
  }

  const names = new Map(DEMO_ADMINS_SUBJECTS.map((subject) => [subject.id, subject.name]))

  return [...subjects]
    .map((subjectId) => {
      const entry = bySubject.get(subjectId) ?? { attempted: 0, correct: 0 }
      const incorrect = Math.max(0, entry.attempted - entry.correct)
      return {
        subject_name: names.get(subjectId) ?? '—',
        attempted: entry.attempted,
        correct: entry.correct,
        incorrect,
        accuracy: entry.attempted ? Math.round((entry.correct / entry.attempted) * 1000) / 10 : null,
      }
    })
    .sort((a, b) => b.attempted - a.attempted)
}
