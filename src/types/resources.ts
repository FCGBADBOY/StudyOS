/** Row + filter types for the notes/resources system and file storage. */

export type ResourceRowType =
  | 'notes'
  | 'revision_notes'
  | 'formula_sheet'
  | 'diagram'
  | 'sample_paper'
  | 'important_questions'
  | 'reference_material'
  | 'video'
  | 'other'

export interface ResourceRow {
  id: string
  chapter_id: string
  title: string
  description: string | null
  resource_type: ResourceRowType
  file_path: string | null
  thumbnail_url: string | null
  page_count: number | null
  question_count: number | null
  file_size_bytes: number | null
  author_name: string | null
  source_name: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface ResourceFilter {
  chapterId?: string
  subjectSlug?: string
  chapterSlug?: string
  type?: ResourceRowType
}

/** Storage buckets used by the app (see README → Storage). */
export const BUCKETS = {
  /** Academic files: `resources/<board>/<class>/<subject>/<chapter>/file.pdf` */
  resources: 'resources',
  /** Public avatars: `avatars/<user-id>/avatar.<ext>` */
  avatars: 'avatars',
} as const
