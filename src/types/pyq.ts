/** Row, filter and analytics types for Previous Year Questions. */

export type PyqRowType =
  | 'MCQ'
  | 'assertion_reason'
  | 'short_answer'
  | 'long_answer'
  | 'numerical'
  | 'case_study'
  | 'other'

export type PyqRowDifficulty = 'easy' | 'moderate' | 'hard'

export interface PyqQuestionRow {
  id: string
  chapter_id: string | null
  subject_id: string | null
  board_id: string
  class_id: string
  year: number
  exam_type: string
  question_text: string
  question_type: PyqRowType
  paper_set: string
  marks: number
  difficulty: PyqRowDifficulty
  source: string | null
  solution_resource_id: string | null
  concepts: string[]
  group_key: string | null
  is_important: boolean
  created_at: string
}

export interface PyqFilter {
  subjectSlug?: string
  chapterSlug?: string
  year?: number
  marks?: number
  difficulty?: PyqRowDifficulty
  important?: boolean
  boardSlug?: string
  classSlug?: string
}

/* ------------------------- intelligence aggregates ------------------------ */

/** Row of `pyq_chapter_stats` — most frequently asked chapters. */
export interface PyqChapterStatRow {
  chapter_id: string
  chapter_name: string
  chapter_slug: string
  subject_id: string
  subject_slug: string
  subject_name: string
  question_count: number
  years_covered: number
  last_year: number
  average_marks: number
}

/** Row of `pyq_year_stats` — question frequency by year. */
export interface PyqYearStatRow {
  year: number
  question_count: number
}

/** Row of `pyq_marks_stats` — marks distribution. */
export interface PyqMarksStatRow {
  marks: number
  question_count: number
}

/** Row of `pyq_difficulty_stats` — difficulty distribution. */
export interface PyqDifficultyStatRow {
  difficulty: string
  question_count: number
}

/** Row of `pyq_concept_stats` — repeated concepts across years. */
export interface PyqConceptStatRow {
  concept: string
  question_count: number
  subject_id: string
  subject_slug: string
  average_marks: number
  years: number[]
  last_difficulty: string
}
