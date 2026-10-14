/**
 * Admin Portal types.
 *
 * Mirrors the database introduced in:
 *   supabase/migrations/20261010000001_admin_roles_permissions.sql
 *   supabase/migrations/20261010000002_content_workflow.sql
 *   supabase/migrations/20261010000003_admin_rls_policies.sql
 *   supabase/migrations/20261010000004_admin_users_analytics.sql
 *
 * These describe *shapes* only. Authorisation is enforced by Row Level
 * Security and the SECURITY DEFINER functions in those migrations — never by
 * the checks in `src/admin/permissions.ts`, which exist purely so the UI can
 * hide controls the user could not successfully use anyway.
 */

/* -------------------------------------------------------------------------- */
/* Roles & permissions                                                        */
/* -------------------------------------------------------------------------- */

export const ADMIN_ROLES = [
  'student',
  'content_editor',
  'moderator',
  'admin',
  'super_admin',
] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

/** Human labels for the role picker. */
export const ROLE_LABELS: Record<AdminRole, string> = {
  student: 'Student',
  content_editor: 'Content Editor',
  moderator: 'Moderator',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

/** Short descriptions used on the user detail page. */
export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  student: 'Standard StudyOS account. Can study, track progress and report problems.',
  content_editor: 'Creates and edits study resources and PYQs. Cannot publish or manage users.',
  moderator: 'Reviews reports and moderates content. Can manage the academic hierarchy.',
  admin: 'Manages content, publishing, users, reports and analytics.',
  super_admin: 'Full access, including granting administrative roles.',
}

/**
 * Every permission string the database knows about.
 * `role_permissions` is the source of truth — this list only drives the
 * "what this role can do" panel on the user detail page.
 */
export const ALL_PERMISSIONS = [
  'content.view',
  'content.create',
  'content.edit',
  'content.upload',
  'content.submit',
  'content.publish',
  'content.moderate',
  'content.archive',
  'content.delete',
  'academic.view',
  'academic.manage',
  'engine.view',
  'engine.manage',
  'pyq.create',
  'pyq.edit',
  'pyq.import',
  'pyq.archive',
  'reports.view',
  'reports.resolve',
  'users.view',
  'users.change_role',
  'users.suspend',
  'analytics.view',
  'audit.view',
  'settings.manage',
  'admin.manage',
] as const

export type AdminPermission = (typeof ALL_PERMISSIONS)[number]

/* -------------------------------------------------------------------------- */
/* Content workflow                                                           */
/* -------------------------------------------------------------------------- */

export const RESOURCE_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'published',
  'rejected',
  'archived',
] as const

export type ResourceStatus = (typeof RESOURCE_STATUSES)[number]

export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
}

export const RESOURCE_TYPES = [
  'notes',
  'revision_notes',
  'formula_sheet',
  'important_questions',
  'sample_paper',
  'diagram',
  'reference_material',
  'video',
  'other',
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  notes: 'Notes',
  revision_notes: 'Revision Notes',
  formula_sheet: 'Formula Sheet',
  important_questions: 'Important Questions',
  sample_paper: 'Sample Paper',
  diagram: 'Diagram',
  reference_material: 'Reference Material',
  video: 'Video',
  other: 'Other',
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

/** A row of `public.profiles` enriched for the user-management screens. */
export interface AdminUserRow {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  email: string | null
  role: AdminRole
  suspended: boolean
  suspended_at: string | null
  suspended_reason: string | null
  board_id: string | null
  class_id: string | null
  stream_id: string | null
  target_exam: string | null
  created_at: string
  last_active_at: string | null
}

/** A row of `public.resources` as the admin sees it (any status). */
export interface AdminResourceRow {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  chapter_id: string | null
  subject_id: string | null
  board_id: string | null
  class_id: string | null
  author_name: string | null
  source_name: string | null
  thumbnail_url: string | null
  file_path: string | null
  file_size_bytes: number | null
  tags: string[]
  status: ResourceStatus
  is_published: boolean
  created_by: string | null
  updated_by: string | null
  reviewed_by: string | null
  review_note: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

/** One entry of `public.resource_versions`. */
export interface ResourceVersionRow {
  id: string
  resource_id: string
  version: number
  snapshot: Record<string, unknown>
  change_summary: string | null
  changed_by: string | null
  created_at: string
}

/* -------------------------------------------------------------------------- */
/* PYQ                                                                        */
/* -------------------------------------------------------------------------- */

export const PYQ_QUESTION_TYPES = [
  'MCQ',
  'assertion_reason',
  'short_answer',
  'long_answer',
  'numerical',
  'case_study',
  'other',
] as const

export type PyqQuestionType = (typeof PYQ_QUESTION_TYPES)[number]

export const PYQ_DIFFICULTIES = ['easy', 'moderate', 'hard'] as const
export type PyqDifficulty = (typeof PYQ_DIFFICULTIES)[number]

/** A row of `public.pyq_questions` for the admin editor. */
export interface AdminPyqRow {
  id: string
  board_id: string
  class_id: string
  subject_id: string | null
  chapter_id: string | null
  year: number
  exam_type: string
  question_text: string
  question_type: PyqQuestionType
  paper_set: string
  marks: number
  difficulty: PyqDifficulty
  source: string | null
  solution_resource_id: string | null
  concepts: string[]
  is_important: boolean
  created_at: string
  updated_at: string
}

/** Payload accepted by create/update — everything except server-owned fields. */
export type AdminPyqDraft = Omit<AdminPyqRow, 'id' | 'created_at' | 'updated_at'>

/* -------------------------------------------------------------------------- */
/* Reports & audit                                                            */
/* -------------------------------------------------------------------------- */

export const REPORT_TYPES = [
  'incorrect_question',
  'wrong_answer',
  'broken_resource',
  'inappropriate_content',
  'duplicate_content',
  'other',
] as const

export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  incorrect_question: 'Incorrect Question',
  wrong_answer: 'Wrong Answer',
  broken_resource: 'Broken Resource',
  inappropriate_content: 'Inappropriate Content',
  duplicate_content: 'Duplicate Content',
  other: 'Other',
}

export interface AdminReportRow {
  id: string
  reporter_id: string | null
  report_type: ReportType
  item_type: 'resource' | 'pyq_question' | 'chapter' | 'subject' | 'user'
  item_id: string | null
  item_title: string
  description: string | null
  status: ReportStatus
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface AuditLogRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

export interface PlatformStats {
  students: number
  resources: number
  pyqs: number
  published: number
  pending_review: number
  open_reports: number
  drafts: number
  archived: number
}

export interface GrowthPoint {
  bucket: string
  label: string
  [key: string]: string | number
}

export interface PopularSubjectRow {
  subject_id: string
  subject_name: string
  students: number
  events: number
  minutes: number
}

export interface PopularChapterRow {
  chapter_id: string
  chapter_name: string
  subject_name: string
  students: number
  events: number
}

export interface QuestionAccuracyRow {
  subject_name: string
  attempted: number
  correct: number
  incorrect: number
  accuracy: number | null
}

export type GrowthPeriod = 'day' | 'week' | 'month' | 'year'

/* -------------------------------------------------------------------------- */
/* Content quality dashboard (spec §26)                                       */
/* -------------------------------------------------------------------------- */

export interface QualityIssue {
  id: string
  label: string
  detail: string
  count: number
  /** Route an admin should visit to fix it. */
  href: string
}

/* -------------------------------------------------------------------------- */
/* Academic hierarchy (shared shape for the CRUD screens)                     */
/* -------------------------------------------------------------------------- */

export interface AdminBoardRow {
  id: string
  slug: string
  name: string
  short_name: string | null
  description: string | null
  display_order: number
  is_archived: boolean
}

export interface AdminClassRow {
  id: string
  slug: string
  name: string
  description: string | null
  display_order: number
  senior: boolean
  is_archived: boolean
}

export interface AdminStreamRow {
  id: string
  slug: string
  name: string
  description: string | null
  display_order: number
  is_archived: boolean
}

export interface AdminSubjectRow {
  id: string
  slug: string
  class_id: string
  board_id: string | null
  stream_id: string | null
  name: string
  code: string | null
  description: string | null
  display_order: number
  is_archived: boolean
}

export interface AdminChapterRow {
  id: string
  subject_id: string
  slug: string
  name: string
  chapter_number: number
  description: string | null
  display_order: number
  difficulty: string | null
  estimated_minutes: number | null
  topics: string[]
  is_archived: boolean
}
