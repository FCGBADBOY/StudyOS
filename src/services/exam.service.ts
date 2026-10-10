/**
 * Exams service — `exams` (per student) seeded from `exam_templates`
 * (per board + class, cloned when onboarding picks a board).
 *
 * Countdowns are always computed from `exam_date` at render time; nothing
 * static is stored.
 */
import type { Exam } from '@/types'
import type { ExamColor, ExamInput, ExamRow, ExamTemplateRow } from '@/types/planner'
import { EXAMS as DEMO_EXAMS } from '@/data/exams'
import { db, isDemo, isoDay, rows, toSubjectId } from './shared'

function today(): string {
  return isoDay(new Date())
}

/**
 * Upcoming exams for the signed-in student (past exams are hidden by the
 * service so callers never show a stale countdown).
 */
export async function getExams(): Promise<Exam[]> {
  if (isDemo) return DEMO_EXAMS

  const client = db()
  if (!client) return []

  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return []

  const [examRows, profile] = await Promise.all([
    rows<ExamRow & { subjects: { slug: string; name: string } | null }>(
      client
        .from('exams')
        .select('*, subjects(slug, name)')
        .gte('exam_date', today())
        .order('exam_date', { ascending: true })
        .limit(50),
    ),
    client.from('profiles').select('board_id, class_id').eq('id', auth.user.id).maybeSingle(),
  ])

  const boardSlug = await boardSlugFor(profile.data?.board_id ?? null)
  const classSlug = await classSlugFor(profile.data?.class_id ?? null)

  return examRows.map((row) => ({
    id: row.id,
    name: row.title,
    board: (boardSlug ?? 'cbse') as Exam['board'],
    classId: (classSlug ?? 'class-12') as Exam['classId'],
    date: row.exam_date,
    subjects: row.subjects?.slug ? [toSubjectId(row.subjects.slug)] : [],
    color: (row.color ?? 'brand') as ExamColor,
  }))
}

/** Exams from today onwards, nearest first. */
export async function getUpcomingExams(limit = 5): Promise<Exam[]> {
  const list = await getExams()
  return list.slice(0, limit)
}

async function boardSlugFor(boardId: string | null): Promise<string | null> {
  if (!boardId) return null
  const client = db()
  if (!client) return null
  const { data } = await client.from('boards').select('slug').eq('id', boardId).maybeSingle()
  return data?.slug ?? null
}

async function classSlugFor(classId: string | null): Promise<string | null> {
  if (!classId) return null
  const client = db()
  if (!client) return null
  const { data } = await client.from('classes').select('slug').eq('id', classId).maybeSingle()
  return data?.slug ?? null
}

/* ---------------------------- template cloning ---------------------------- */

/**
 * Copy the board/class exam templates into a student's calendar.
 * Called from onboarding when the board + class are chosen (idempotent).
 */
export async function assignExamsForProfile(boardId: string, classId: string): Promise<void> {
  const client = db()
  if (!client) return
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return

  const existing = await rows<{ id: string }>(
    client.from('exams').select('id').eq('user_id', auth.user.id).limit(1),
  )
  if (existing.length) return

  const templates = await rows<ExamTemplateRow>(
    client.from('exam_templates').select('*').eq('board_id', boardId).eq('class_id', classId),
  )
  if (!templates.length) return

  const { error } = await client.from('exams').insert(
    templates.map((template) => ({
      user_id: auth.user.id,
      subject_id: template.subject_id,
      title: template.title,
      exam_date: template.exam_date,
      total_marks: template.total_marks,
      notes: template.notes,
      color: template.color,
    })),
  )
  if (error) throw new Error(error.message)
}

/* -------------------------------- mutations ------------------------------- */

export async function createExam(input: ExamInput): Promise<void> {
  if (isDemo) return
  const client = db()
  if (!client) return
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error('Sign in to add an exam.')

  const { error } = await client.from('exams').insert({
    user_id: auth.user.id,
    subject_id: input.subjectId ?? null,
    title: input.title,
    exam_date: input.examDate,
    total_marks: input.totalMarks ?? null,
    notes: input.notes ?? null,
    color: input.color ?? 'brand',
  })
  if (error) throw new Error(error.message)
}

export async function deleteExam(id: string): Promise<void> {
  if (isDemo) return
  const client = db()
  if (!client) return
  const { error } = await client.from('exams').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
