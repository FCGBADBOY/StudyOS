/**
 * Student context builder — the "who is asking" half of every AI request.
 *
 * Everything is read with the caller's own session (RLS) or explicitly scoped
 * to `userId`, so one student can never receive another student's data. The
 * result is compact: only what the prompt and the UI need.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { StudentContext } from '../types.ts'
import { log } from '../logging.ts'

interface ProfileRow {
  id: string
  full_name: string | null
  board_id: string | null
  class_id: string | null
  stream_id: string | null
  target_exam: string | null
  exam_date: string | null
  daily_goal_minutes: number
  boards: { name: string } | null
  classes: { name: string } | null
  streams: { name: string } | null
}

export interface FocusIds {
  subjectId?: string | null
  chapterId?: string | null
}

function daysFromNow(iso: string): number {
  const time = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - Date.now()
  return Math.round(time / 86_400_000)
}

export async function buildStudentContext(
  db: SupabaseClient,
  userId: string,
  focus: FocusIds = {},
): Promise<StudentContext> {
  const empty: StudentContext = {
    userId,
    name: null,
    board: null,
    className: null,
    stream: null,
    boardId: null,
    classId: null,
    streamId: null,
    targetExam: null,
    examDate: null,
    dailyGoalMinutes: 120,
    subjectId: focus.subjectId ?? null,
    chapterId: focus.chapterId ?? null,
    subject: null,
    chapter: null,
    weakChapters: [],
    recentMistakes: [],
    upcomingExams: [],
    activity: { minutesThisWeek: 0, questionsThisWeek: 0, accuracyThisWeek: null, chaptersStudied: [] },
  }

  try {
    const { data: profile } = await db
      .from('profiles')
      .select('id, full_name, board_id, class_id, stream_id, target_exam, exam_date, daily_goal_minutes, boards(name), classes(name), streams(name)')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      const row = profile as unknown as ProfileRow
      empty.name = row.full_name
      empty.boardId = row.board_id
      empty.classId = row.class_id
      empty.streamId = row.stream_id
      empty.board = row.boards?.name ?? null
      empty.className = row.classes?.name ?? null
      empty.stream = row.streams?.name ?? null
      empty.targetExam = row.target_exam
      empty.examDate = row.exam_date
      empty.dailyGoalMinutes = row.daily_goal_minutes ?? 120
    }

    /* Focused subject/chapter names (for the prompt's CURRENT FOCUS block). */
    if (focus.chapterId) {
      const { data: chapter } = await db
        .from('chapters')
        .select('id, name, subjects(id, name)')
        .eq('id', focus.chapterId)
        .maybeSingle()
      if (chapter) {
        const row = chapter as unknown as { name: string; subjects: { id: string; name: string } | null }
        empty.chapter = row.name
        empty.subject = row.subjects?.name ?? null
        empty.subjectId = focus.subjectId ?? row.subjects?.id ?? null
      }
    } else if (focus.subjectId) {
      const { data: subject } = await db.from('subjects').select('name').eq('id', focus.subjectId).maybeSingle()
      if (subject) empty.subject = (subject as unknown as { name: string }).name
    }

    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const [progress, mistakes, exams, history, attempts] = await Promise.all([
      db
        .from('user_chapter_progress')
        .select('chapter_id, completion_percent, last_studied_at, chapters(name, subjects(name))')
        .eq('user_id', userId)
        .order('last_studied_at', { ascending: false, nullsFirst: false })
        .limit(30),
      db
        .from('mistakes')
        .select('id, question_text, mistake_type, chapter_id, chapters(name, subjects(name))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      db
        .from('exams')
        .select('title, exam_date, subjects(name)')
        .eq('user_id', userId)
        .gte('exam_date', new Date().toISOString().slice(0, 10))
        .order('exam_date', { ascending: true })
        .limit(5),
      db
        .from('study_history')
        .select('minutes, questions, chapter_id, occurred_at, title')
        .eq('user_id', userId)
        .gte('occurred_at', weekAgo)
        .limit(100),
      db
        .from('question_attempts')
        .select('is_correct, attempted_at, question_id, pyq_questions(chapter_id)')
        .eq('user_id', userId)
        .gte('attempted_at', weekAgo)
        .limit(200),
    ])

    /* Weak areas: chapters with unresolved mistakes, then low completion. */
    const mistakeCounts = new Map<string, number>()
    for (const row of (mistakes.data ?? []) as Array<{ chapter_id: string | null }>) {
      if (!row.chapter_id) continue
      mistakeCounts.set(row.chapter_id, (mistakeCounts.get(row.chapter_id) ?? 0) + 1)
    }

    const progressRows = (progress.data ?? []) as Array<{
      chapter_id: string
      completion_percent: number
      last_studied_at: string | null
      chapters: { name: string; subjects: { name: string } | null } | null
    }>

    const weak = new Map<string, { chapter: string; subject: string; accuracy: number | null; score: number }>()
    for (const row of progressRows) {
      const name = row.chapters?.name
      if (!name) continue
      const mistakesHere = mistakeCounts.get(row.chapter_id) ?? 0
      if (mistakesHere > 0 || row.completion_percent < 40) {
        weak.set(row.chapter_id, {
          chapter: name,
          subject: row.chapters?.subjects?.name ?? 'Subject',
          accuracy: null,
          score: mistakesHere * 10 + (row.completion_percent < 40 ? 3 : 0),
        })
      }
    }
    for (const [chapterId] of mistakeCounts) {
      if (weak.has(chapterId)) continue
      const row = progressRows.find((entry) => entry.chapter_id === chapterId)
      weak.set(chapterId, {
        chapter: row?.chapters?.name ?? 'Chapter',
        subject: row?.chapters?.subjects?.name ?? 'Subject',
        accuracy: null,
        score: 5,
      })
    }
    empty.weakChapters = Array.from(weak.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ chapter, subject, accuracy }) => ({ chapter, subject, accuracy }))

    empty.recentMistakes = ((mistakes.data ?? []) as Array<{
      id: string
      question_text: string
      mistake_type: string
      chapters: { name: string; subjects: { name: string } | null } | null
    }>).map((row) => ({
      id: row.id,
      question: row.question_text,
      type: row.mistake_type,
      chapter: row.chapters?.name ?? null,
      subject: row.chapters?.subjects?.name ?? null,
    }))

    empty.upcomingExams = ((exams.data ?? []) as Array<{
      title: string
      exam_date: string
      subjects: { name: string } | null
    }>).map((row) => ({
      title: row.title,
      date: row.exam_date,
      daysAway: Math.max(0, daysFromNow(row.exam_date)),
      subject: row.subjects?.name ?? null,
    }))

    const historyRows = (history.data ?? []) as Array<{ minutes: number; questions: number; chapter_id: string | null }>
    const attemptRows = (attempts.data ?? []) as Array<{
      is_correct: boolean
      pyq_questions: { chapter_id: string | null } | null
    }>

    const correct = attemptRows.filter((row) => row.is_correct).length
    empty.activity = {
      minutesThisWeek: historyRows.reduce((sum, row) => sum + (row.minutes ?? 0), 0),
      questionsThisWeek: attemptRows.length || historyRows.reduce((sum, row) => sum + (row.questions ?? 0), 0),
      accuracyThisWeek: attemptRows.length ? Math.round((correct / attemptRows.length) * 100) : null,
      chaptersStudied: Array.from(
        new Set(historyRows.map((row) => row.chapter_id).filter((id): id is string => Boolean(id))),
      ).slice(0, 8),
    }
  } catch (error) {
    /* Context is an enhancement — never fail a request because of it. */
    log('warn', 'ai.context_partial', { error: error instanceof Error ? error.message : String(error) })
  }

  return empty
}
