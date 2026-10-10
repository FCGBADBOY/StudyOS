/** Row + filter types for the MistakeBook. */

export type MistakeRowType =
  | 'conceptual'
  | 'calculation'
  | 'formula'
  | 'sign_error'
  | 'careless'
  | 'memory'
  | 'other'

export interface MistakeRow {
  id: string
  user_id: string
  question_id: string | null
  chapter_id: string | null
  question_text: string
  mistake_type: MistakeRowType
  student_answer: string | null
  correct_answer: string | null
  explanation: string | null
  notes: string | null
  review_count: number
  resolved: boolean
  created_at: string
  updated_at: string
}

export interface MistakeFilter {
  subjectSlug?: string
  chapterSlug?: string
  type?: MistakeRowType
  resolved?: boolean
}

export interface MistakeInput {
  questionText: string
  mistakeType: MistakeRowType
  chapterId?: string | null
  questionId?: string | null
  studentAnswer?: string | null
  correctAnswer?: string | null
  explanation?: string | null
  notes?: string | null
}
