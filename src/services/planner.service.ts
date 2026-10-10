/**
 * Study planner service — CRUD for `study_sessions`.
 *
 * Supports: create · update · delete · mark complete · today's sessions ·
 * the current Monday–Sunday week (built from real `scheduled_date` rows).
 */
import type { StudySession, WeeklyPlanDay } from '@/types'
import type { StudySessionInput, StudySessionRow } from '@/types/planner'
import { TODAY_SESSIONS, WEEK_PLAN } from '@/data/planner'
import { db, isDemo, isoDay, overlayAdd, overlayList, overlayRemove, overlayUpdate, rows, toSubjectId, resetMemo } from './shared'
import { recordSessionCompleted } from './progress.service'

const DEMO_KEY = 'sessions'

interface SessionEmbed extends StudySessionRow {
  subjects: { slug: string; name: string } | null
}

function toSession(row: SessionEmbed): StudySession & { date: string; chapterId: string | null } {
  return {
    id: row.id,
    subjectId: toSubjectId(row.subjects?.slug),
    subjectName: row.subjects?.name ?? 'Study',
    topic: row.title,
    duration: row.duration_minutes,
    priority: row.priority,
    completed: row.completed,
    time: row.start_time ? row.start_time.slice(0, 5) : undefined,
    notes: row.description ?? undefined,
    date: row.scheduled_date,
    chapterId: row.chapter_id,
  }
}

type PlannerSession = StudySession & { date: string; chapterId: string | null }

/* ------------------------------- demo week ------------------------------- */

function currentMonday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

/** Sample week re-based onto the *current* week so the demo never looks stale. */
function demoWeek(): WeeklyPlanDay[] {
  const monday = currentMonday()
  return WEEK_PLAN.map((day, index) => ({
    ...day,
    date: isoDay(addDays(monday, index)),
    sessions: day.sessions.map((session) => ({ ...session })),
  }))
}

function demoToday(): StudySession[] {
  return TODAY_SESSIONS.map((session) => ({ ...session }))
}

/* -------------------------------- reads ---------------------------------- */

export async function getStudySessions(from?: string, to?: string): Promise<PlannerSession[]> {
  if (isDemo) {
    const all = demoWeek().flatMap((day) => day.sessions.map((session) => ({ ...session, date: day.date, chapterId: null })))
    return all.filter((session) => (!from || session.date >= from) && (!to || session.date <= to))
  }

  const client = db()
  if (!client) return []

  let query = client
    .from('study_sessions')
    .select('*, subjects(slug, name)')
    .order('scheduled_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .limit(300)
  if (from) query = query.gte('scheduled_date', from)
  if (to) query = query.lte('scheduled_date', to)

  const list = await rows<SessionEmbed>(query)
  return list.map(toSession)
}

/** Today's sessions (dashboard + planner "today" column). */
export async function getTodaySessions(): Promise<StudySession[]> {
  const today = isoDay(new Date())
  if (isDemo) return demoToday()
  const sessions = await getStudySessions(today, today)
  return sessions
}

/** Monday–Sunday week with planned/done minutes per day. */
export async function getWeek(): Promise<WeeklyPlanDay[]> {
  const monday = currentMonday()
  const sunday = addDays(monday, 6)

  if (isDemo) return demoWeek()

  const sessions = await getStudySessions(isoDay(monday), isoDay(sunday))
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return dayNames.map((day, index) => {
    const date = isoDay(addDays(monday, index))
    const list = sessions.filter((session) => session.date === date)
    const planned = list.reduce((sum, session) => sum + session.duration, 0)
    const done = list.filter((session) => session.completed).reduce((sum, session) => sum + session.duration, 0)
    return { id: `day-${index + 1}`, day, date, sessions: list, plannedMinutes: planned, doneMinutes: done }
  })
}

/** Everything the planner screen needs in one call. */
export async function getPlanner(): Promise<{ today: StudySession[]; week: WeeklyPlanDay[] }> {
  const [today, week] = await Promise.all([getTodaySessions(), getWeek()])
  return { today, week }
}

/* ------------------------------- mutations ------------------------------- */

async function userId(): Promise<string | null> {
  const client = db()
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

export async function createStudySession(input: StudySessionInput): Promise<StudySession> {
  if (isDemo) {
    const session: PlannerSession = {
      id: `session-${Date.now()}`,
      subjectId: (input.subjectId ?? 'physics') as StudySession['subjectId'],
      subjectName: 'Study',
      topic: input.title,
      duration: input.durationMinutes,
      priority: input.priority,
      completed: false,
      time: input.startTime ?? undefined,
      notes: input.description ?? undefined,
      date: input.scheduledDate,
      chapterId: input.chapterId ?? null,
    }
    overlayAdd(DEMO_KEY, session)
    return session
  }

  const client = db()
  const uid = await userId()
  if (!client || !uid) throw new Error('Sign in to plan a session.')

  const { data, error } = await client
    .from('study_sessions')
    .insert({
      user_id: uid,
      subject_id: input.subjectId ?? null,
      chapter_id: input.chapterId ?? null,
      title: input.title,
      description: input.description ?? null,
      scheduled_date: input.scheduledDate,
      start_time: input.startTime ?? null,
      duration_minutes: input.durationMinutes,
      priority: input.priority,
    })
    .select('*, subjects(slug, name)')
    .single()

  if (error) throw new Error(error.message)
  resetMemo()
  return toSession(data as SessionEmbed)
}

export async function updateStudySession(
  id: string,
  patch: Partial<StudySessionInput> & { completed?: boolean },
): Promise<void> {
  if (isDemo) {
    const current = overlayList<PlannerSession>(DEMO_KEY, []).find((entry) => entry.id === id)
    const base =
      current ??
      (demoWeek()
        .flatMap((day) => day.sessions)
        .find((entry) => entry.id === id) as PlannerSession | undefined)
    if (!base) return
    overlayUpdate(DEMO_KEY, {
      ...base,
      ...(patch.title ? { topic: patch.title } : {}),
      ...(patch.durationMinutes ? { duration: patch.durationMinutes } : {}),
      ...(patch.priority ? { priority: patch.priority } : {}),
      ...(patch.startTime !== undefined ? { time: patch.startTime ?? undefined } : {}),
      ...(patch.description !== undefined ? { notes: patch.description ?? undefined } : {}),
      ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
      ...(patch.scheduledDate ? { date: patch.scheduledDate } : {}),
    })
    return
  }

  const client = db()
  if (!client) return
  const payload: Record<string, unknown> = {}
  if (patch.title) payload.title = patch.title
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.scheduledDate) payload.scheduled_date = patch.scheduledDate
  if (patch.startTime !== undefined) payload.start_time = patch.startTime
  if (patch.durationMinutes) payload.duration_minutes = patch.durationMinutes
  if (patch.priority) payload.priority = patch.priority
  if (patch.subjectId !== undefined) payload.subject_id = patch.subjectId
  if (patch.chapterId !== undefined) payload.chapter_id = patch.chapterId
  if (patch.completed !== undefined) {
    payload.completed = patch.completed
    payload.completed_at = patch.completed ? new Date().toISOString() : null
  }
  if (!Object.keys(payload).length) return

  const { error } = await client.from('study_sessions').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
  resetMemo()
}

/** Toggle completion — completing a session also logs the minutes studied. */
export async function markSessionComplete(
  id: string,
  completed: boolean,
  context?: { title: string; minutes: number; subjectId?: string | null; chapterId?: string | null },
): Promise<void> {
  await updateStudySession(id, { completed })
  if (completed && context) {
    await recordSessionCompleted({
      title: context.title,
      minutes: context.minutes,
      subjectId: context.subjectId ?? null,
      chapterId: context.chapterId ?? null,
    })
  }
}

export async function deleteStudySession(id: string): Promise<void> {
  if (isDemo) {
    overlayRemove(DEMO_KEY, id)
    return
  }
  const client = db()
  if (!client) return
  const { error } = await client.from('study_sessions').delete().eq('id', id)
  if (error) throw new Error(error.message)
  resetMemo()
}
