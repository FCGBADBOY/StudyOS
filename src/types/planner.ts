/** Row types for the study planner, exams and bookmarks. */

export type SessionPriority = 'High' | 'Medium' | 'Low'

export interface StudySessionRow {
  id: string
  user_id: string
  subject_id: string | null
  chapter_id: string | null
  title: string
  description: string | null
  scheduled_date: string
  start_time: string | null
  duration_minutes: number
  priority: SessionPriority
  completed: boolean
  completed_at: string | null
  created_at: string
}

export interface StudySessionInput {
  subjectId?: string | null
  chapterId?: string | null
  title: string
  description?: string | null
  scheduledDate: string
  startTime?: string | null
  durationMinutes: number
  priority: SessionPriority
}

export type ExamColor = 'brand' | 'accent' | 'warning' | 'danger'

export interface ExamRow {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  exam_date: string
  total_marks: number | null
  notes: string | null
  color: ExamColor
  created_at: string
}

export interface ExamInput {
  subjectId?: string | null
  title: string
  examDate: string
  totalMarks?: number | null
  notes?: string | null
  color?: ExamColor
}

/** Seeded, board-level exams copied into a profile when it is created. */
export interface ExamTemplateRow {
  id: string
  board_id: string
  class_id: string
  subject_id: string | null
  title: string
  exam_date: string
  total_marks: number | null
  notes: string | null
  color: ExamColor
}

export type BookmarkTarget = 'resource' | 'chapter' | 'pyq' | 'question'

export interface BookmarkRow {
  id: string
  user_id: string
  target_type: BookmarkTarget
  target_key: string
  resource_id: string | null
  chapter_id: string | null
  question_id: string | null
  created_at: string
}
