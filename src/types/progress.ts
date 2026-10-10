/** Row types for user progress, attempts and study history. */

export interface ChapterProgressRow {
  id: string
  user_id: string
  chapter_id: string
  completion_percent: number
  total_time_seconds: number
  last_studied_at: string | null
  created_at: string
  updated_at: string
}

export interface ResourceProgressRow {
  id: string
  user_id: string
  resource_id: string
  progress_percent: number
  completed: boolean
  last_opened_at: string | null
}

export interface QuestionAttemptRow {
  id: string
  user_id: string
  question_id: string
  selected_answer: string | null
  is_correct: boolean
  time_taken_seconds: number | null
  attempted_at: string
}

export type StudyEventType =
  | 'resource_opened'
  | 'chapter_studied'
  | 'question_attempted'
  | 'session_completed'

export interface StudyHistoryRow {
  id: string
  user_id: string
  event_type: StudyEventType
  subject_id: string | null
  chapter_id: string | null
  resource_id: string | null
  question_id: string | null
  title: string
  minutes: number
  questions: number
  occurred_at: string
}

export interface AttemptInput {
  questionId: string
  selectedAnswer?: string | null
  isCorrect: boolean
  timeTakenSeconds?: number | null
}

export interface ChapterProgressInput {
  chapterId: string
  completionPercent: number
  secondsStudied?: number
}
