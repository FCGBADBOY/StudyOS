/**
 * Row + filter types for the academic hierarchy:
 * boards → classes → streams → subjects → chapters.
 *
 * Nothing here is CBSE-specific: the hierarchy is data, so any board, class or
 * stream can be added with INSERTs (or seed rows) only.
 */

export interface BoardRow {
  id: string
  slug: string
  name: string
  short_name: string
  description: string | null
  display_order: number
}

export interface ClassRow {
  id: string
  slug: string
  name: string
  description: string | null
  display_order: number
  senior: boolean
}

export interface StreamRow {
  id: string
  slug: string
  name: string
  description: string | null
  display_order: number
}

export interface SubjectRow {
  id: string
  slug: string
  class_id: string
  /** Nullable: subjects are not bound to one board (mirrors the schema). */
  board_id: string | null
  stream_id: string | null
  name: string
  code: string | null
  description: string | null
  display_order: number
}

export interface ChapterRow {
  id: string
  subject_id: string
  slug: string
  name: string
  chapter_number: number
  description: string | null
  display_order: number
  difficulty: 'Easy' | 'Moderate' | 'Hard'
  estimated_minutes: number
  topics: string[]
}

export interface SubjectFilter {
  board?: string
  classId?: string
  streamId?: string
}
