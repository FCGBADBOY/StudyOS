/**
 * MistakeBook service — the signed-in student's own mistakes.
 *
 * RLS guarantees a user can only ever read or write their own rows; the UI
 * never sends a user id (the database takes it from the session).
 */
import type { Mistake, MistakeType } from '@/types'
import type { MistakeFilter, MistakeInput, MistakeRow, MistakeRowType } from '@/types/mistakes'
import { MISTAKES as DEMO_MISTAKES } from '@/data/mistakes'
import {
  db,
  isDemo,
  overlayAdd,
  overlayList,
  overlayRemove,
  overlayUpdate,
  rows,
  toSubjectId,
} from './shared'

const DEMO_KEY = 'mistakes'

const TYPE_LABEL: Record<MistakeRowType, MistakeType> = {
  conceptual: 'Conceptual',
  calculation: 'Calculation',
  formula: 'Formula',
  sign_error: 'Sign error',
  careless: 'Careless mistake',
  memory: 'Memory',
  other: 'Other',
}

const TYPE_VALUE: Record<string, MistakeRowType> = {
  conceptual: 'conceptual',
  calculation: 'calculation',
  formula: 'formula',
  sign_error: 'sign_error',
  'sign error': 'sign_error',
  careless: 'careless',
  'careless mistake': 'careless',
  memory: 'memory',
  other: 'other',
}

interface MistakeEmbed extends MistakeRow {
  chapters: { name: string; slug: string; subjects: { slug: string; name: string } | null } | null
  pyq_questions: { marks: number } | null
}

function toMistake(row: MistakeEmbed): Mistake {
  const chapter = row.chapters
  return {
    id: row.id,
    question: row.question_text,
    myAnswer: row.student_answer ?? '',
    correctConcept: row.explanation || row.correct_answer || '',
    subjectId: toSubjectId(chapter?.subjects?.slug),
    subjectName: chapter?.subjects?.name ?? 'Physics',
    chapter: chapter?.name ?? 'Chapter',
    chapterSlug: chapter?.slug ?? '',
    date: row.created_at.slice(0, 10),
    type: TYPE_LABEL[row.mistake_type] ?? 'Other',
    solvedCount: row.review_count ?? 0,
    reviewed: row.resolved,
    marks: row.pyq_questions?.marks ?? 2,
  }
}

export async function getMistakes(filter: MistakeFilter = {}): Promise<Mistake[]> {
  if (isDemo) {
    return overlayList(DEMO_KEY, DEMO_MISTAKES).filter((mistake) => {
      if (filter.subjectSlug && mistake.subjectId !== filter.subjectSlug) return false
      if (filter.chapterSlug && mistake.chapterSlug !== filter.chapterSlug) return false
      if (filter.type && mistake.type !== TYPE_LABEL[filter.type]) return false
      if (filter.resolved !== undefined && mistake.reviewed !== filter.resolved) return false
      return true
    })
  }

  const client = db()
  if (!client) return []

  const list = await rows<MistakeEmbed>(
    client
      .from('mistakes')
      .select('*, chapters(name, slug, subjects(slug, name)), pyq_questions(marks)')
      .order('created_at', { ascending: false })
      .limit(500),
  )

  const mapped = list.map(toMistake)
  return mapped.filter((mistake) => {
    if (filter.subjectSlug && mistake.subjectId !== filter.subjectSlug) return false
    if (filter.chapterSlug && mistake.chapterSlug !== filter.chapterSlug) return false
    if (filter.type && mistake.type !== TYPE_LABEL[filter.type]) return false
    if (filter.resolved !== undefined && mistake.reviewed !== filter.resolved) return false
    return true
  })
}

/** Counts per subject (filter chips). */
export async function getMistakeCounts(): Promise<Map<string, number>> {
  const list = await getMistakes()
  const counts = new Map<string, number>()
  list.forEach((mistake) => counts.set(mistake.subjectId, (counts.get(mistake.subjectId) ?? 0) + 1))
  return counts
}

export async function createMistake(input: MistakeInput): Promise<Mistake> {
  if (isDemo) {
    const now = new Date().toISOString()
    const mistake: Mistake = {
      id: `mk-${Date.now()}`,
      question: input.questionText,
      myAnswer: input.studentAnswer ?? '',
      correctConcept: input.explanation || input.correctAnswer || '',
      subjectId: 'physics',
      subjectName: 'Physics',
      chapter: 'Added manually',
      chapterSlug: '',
      date: now.slice(0, 10),
      type: TYPE_LABEL[input.mistakeType] ?? 'Other',
      solvedCount: 0,
      reviewed: false,
      marks: 2,
    }
    overlayAdd(DEMO_KEY, mistake)
    return mistake
  }

  const client = db()
  const { data: auth } = await client!.auth.getUser()
  if (!client || !auth.user) throw new Error('You need to sign in to save mistakes.')

  const { data, error } = await client
    .from('mistakes')
    .insert({
      user_id: auth.user.id,
      question_text: input.questionText,
      mistake_type: input.mistakeType,
      chapter_id: input.chapterId ?? null,
      question_id: input.questionId ?? null,
      student_answer: input.studentAnswer ?? null,
      correct_answer: input.correctAnswer ?? null,
      explanation: input.explanation ?? null,
      notes: input.notes ?? null,
    })
    .select('*, chapters(name, slug, subjects(slug, name)), pyq_questions(marks)')
    .single()

  if (error) throw new Error(error.message)
  return toMistake(data as MistakeEmbed)
}

export async function updateMistake(
  id: string,
  patch: Partial<{ mistakeType: MistakeRowType; studentAnswer: string; explanation: string; notes: string; resolved: boolean }>,
): Promise<void> {
  if (isDemo) {
    const current = overlayList(DEMO_KEY, DEMO_MISTAKES).find((entry) => entry.id === id)
    if (!current) return
    overlayUpdate(DEMO_KEY, {
      ...current,
      ...(patch.mistakeType ? { type: TYPE_LABEL[patch.mistakeType] } : {}),
      ...(patch.studentAnswer !== undefined ? { myAnswer: patch.studentAnswer } : {}),
      ...(patch.explanation !== undefined ? { correctConcept: patch.explanation } : {}),
      ...(patch.resolved !== undefined ? { reviewed: patch.resolved } : {}),
    })
    return
  }

  const client = db()
  if (!client) return
  const payload: Record<string, unknown> = {}
  if (patch.mistakeType) payload.mistake_type = patch.mistakeType
  if (patch.studentAnswer !== undefined) payload.student_answer = patch.studentAnswer
  if (patch.explanation !== undefined) payload.explanation = patch.explanation
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (patch.resolved !== undefined) payload.resolved = patch.resolved
  if (!Object.keys(payload).length) return

  const { error } = await client.from('mistakes').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Mark resolved / back to open. */
export async function setMistakeResolved(id: string, resolved: boolean): Promise<void> {
  await updateMistake(id, { resolved })
}

/** Logging a review keeps the "solved N times" counter honest. */
export async function recordMistakeReview(id: string): Promise<void> {
  if (isDemo) {
    const current = overlayList(DEMO_KEY, DEMO_MISTAKES).find((entry) => entry.id === id)
    if (current) overlayUpdate(DEMO_KEY, { ...current, solvedCount: current.solvedCount + 1 })
    return
  }
  const client = db()
  if (!client) return
  const { data } = await client.from('mistakes').select('review_count').eq('id', id).maybeSingle()
  await client
    .from('mistakes')
    .update({ review_count: (data?.review_count ?? 0) + 1 })
    .eq('id', id)
}

export async function deleteMistake(id: string): Promise<void> {
  if (isDemo) {
    overlayRemove(DEMO_KEY, id)
    return
  }
  const client = db()
  if (!client) return
  const { error } = await client.from('mistakes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
