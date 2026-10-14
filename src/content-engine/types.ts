/**
 * Content Engine domain types.
 *
 * This folder (`src/content-engine/**`) is deliberately *pure*: no npm
 * packages, no `@/` aliases, no DOM, no Deno. The browser bundle and the
 * `supabase/functions/content-engine` worker both import it, so anything with
 * a side effect or a secret belongs somewhere else.
 *
 * The row shapes mirror `supabase/migrations/20261013000001_content_engine.sql`.
 * They describe *shapes* only — authorisation lives in the RLS policies and the
 * `ce_*()` SECURITY DEFINER RPCs, never in this file.
 */

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/** Where a piece of external material came from. */
export const SOURCE_TYPES = [
  'official_board',
  'official_academic',
  'open_educational',
  'institution',
  'open_archive',
  'community',
  'other',
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official_board: 'Official Board',
  official_academic: 'Official Academic Body',
  open_educational: 'Open Educational Resource',
  institution: 'Institution',
  open_archive: 'Open Archive',
  community: 'Community',
  other: 'Other',
}

/**
 * Licence state of an external source.
 *
 * `unknown` is not a synonym for `open` — see `license.ts`. Only the four
 * positive states permit StudyOS to keep a copy of a file.
 */
export const LICENSE_STATUSES = [
  'official',
  'open_license',
  'public_domain',
  'permission_granted',
  'unknown',
  'restricted',
] as const
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]

export const LICENSE_LABELS: Record<LicenseStatus, string> = {
  official: 'Official publication',
  open_license: 'Open licence',
  public_domain: 'Public domain',
  permission_granted: 'Permission granted',
  unknown: 'Unknown licence',
  restricted: 'Restricted — no redistribution',
}

/** How the material was (or will be) reached. */
export const ACCESS_METHODS = ['public', 'link_only', 'manual'] as const
export type AccessMethod = (typeof ACCESS_METHODS)[number]

/**
 * Authenticity of a paper. Never collapse `unverified` into `official` because
 * a third-party site called its upload a "PYQ" (spec §26).
 */
export const OFFICIAL_STATUSES = [
  'verified_official',
  'verified_source_archive',
  'third_party',
  'unverified',
] as const
export type OfficialStatus = (typeof OFFICIAL_STATUSES)[number]

export const OFFICIAL_STATUS_LABELS: Record<OfficialStatus, string> = {
  verified_official: 'Verified Official',
  verified_source_archive: 'Verified Source Archive',
  third_party: 'Third Party',
  unverified: 'Unverified',
}

/** Whether StudyOS physically holds the file or only a link to it. */
export const RETRIEVAL_STATUSES = [
  'discovered',
  'stored',
  'linked',
  'blocked',
  'failed',
  'archived',
] as const
export type RetrievalStatus = (typeof RETRIEVAL_STATUSES)[number]

export const RETRIEVAL_LABELS: Record<RetrievalStatus, string> = {
  discovered: 'Discovered',
  stored: 'Stored in StudyOS',
  linked: 'View Source',
  blocked: 'Not stored (licence)',
  failed: 'Fetch failed',
  archived: 'Archived',
}

/** Lifecycle shared by every automatically produced item (spec §49). */
export const CONTENT_STATUSES = [
  'discovered',
  'processing',
  'generated',
  'validation_failed',
  'needs_review',
  'approved',
  'published',
  'archived',
  'blocked',
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  discovered: 'Discovered',
  processing: 'Processing',
  generated: 'Generated',
  validation_failed: 'Validation failed',
  needs_review: 'Needs review',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
  blocked: 'Blocked',
}

/** Note depth (spec §14). */
export const DEPTH_LEVELS = ['quick', 'standard', 'detailed', 'exam_master'] as const
export type DepthLevel = (typeof DEPTH_LEVELS)[number]

export const DEPTH_LABELS: Record<DepthLevel, string> = {
  quick: 'Quick',
  standard: 'Standard',
  detailed: 'Detailed',
  exam_master: 'Exam Master',
}

export const DEPTH_DESCRIPTIONS: Record<DepthLevel, string> = {
  quick: 'A 5–10 minute revision pass: definitions, formulas and the ideas that get tested.',
  standard: 'Complete study notes for the chapter, in syllabus order.',
  detailed: 'Concepts with worked examples and deeper explanations.',
  exam_master:
    'Exam-focused: important definitions, formulas, frequently tested areas, common mistakes and answer-writing guidance.',
}

export const NOTE_TYPES = [
  'notes',
  'quick_revision',
  'formula_sheet',
  'important_concepts',
  'common_mistakes',
  'practice_questions',
  'flashcards',
  'quiz',
  'sample_paper',
] as const
export type NoteType = (typeof NOTE_TYPES)[number]

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  notes: 'Detailed Notes',
  quick_revision: 'Quick Revision',
  formula_sheet: 'Formula Sheet',
  important_concepts: 'Important Concepts',
  common_mistakes: 'Common Mistakes',
  practice_questions: 'Practice Questions',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  sample_paper: 'Sample Paper',
}

/** Rendering order for a chapter pack (spec §55). Admins may override later. */
export const NOTE_TYPE_ORDER: readonly NoteType[] = [
  'notes',
  'quick_revision',
  'formula_sheet',
  'important_concepts',
  'practice_questions',
  'quiz',
  'flashcards',
  'common_mistakes',
  'sample_paper',
]

/** A note item is a typed block, never an opaque paragraph (spec §15). */
export const NOTE_ITEM_TYPES = [
  'heading',
  'paragraph',
  'definition',
  'formula',
  'derivation',
  'example',
  'reaction',
  'table',
  'tip',
  'warning',
  'question',
  'answer',
  'diagram',
] as const
export type NoteItemType = (typeof NOTE_ITEM_TYPES)[number]

export const JOB_TYPES = [
  'discover_syllabus',
  'build_chapter_map',
  'generate_notes',
  'generate_revision',
  'generate_formula_sheet',
  'generate_quiz',
  'generate_flashcards',
  'generate_practice',
  'extract_formulas',
  'extract_reactions',
  'discover_pyqs',
  'discover_sample_papers',
  'import_document',
  'validate_content',
  'rebuild_index',
  'daily_maintenance',
  'build_class',
  'build_subject',
  'build_chapter',
] as const
export type JobType = (typeof JOB_TYPES)[number]

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  discover_syllabus: 'Discover syllabus',
  build_chapter_map: 'Build chapter map',
  generate_notes: 'Generate notes',
  generate_revision: 'Generate quick revision',
  generate_formula_sheet: 'Generate formula sheet',
  generate_quiz: 'Generate quiz',
  generate_flashcards: 'Generate flashcards',
  generate_practice: 'Generate AI practice',
  extract_formulas: 'Extract formulas',
  extract_reactions: 'Extract reactions',
  discover_pyqs: 'Discover PYQs',
  discover_sample_papers: 'Discover sample papers',
  import_document: 'Import document',
  validate_content: 'Validate content',
  rebuild_index: 'Re-index for RAG',
  daily_maintenance: 'Daily content health',
  build_class: 'Build class content',
  build_subject: 'Build subject content',
  build_chapter: 'Build chapter content',
}

export const JOB_STATUSES = [
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'partial',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  partial: 'Partly finished',
}

export const JOB_STAGES = [
  'queued',
  'discovery',
  'classification',
  'generation',
  'validation',
  'review',
  'publication',
  'rag_indexing',
  'done',
  'failed',
] as const
export type JobStage = (typeof JOB_STAGES)[number]

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  queued: 'Queued',
  discovery: 'Discovery',
  classification: 'Classification',
  generation: 'Generation',
  validation: 'Validation',
  review: 'Awaiting review',
  publication: 'Publication',
  rag_indexing: 'RAG indexing',
  done: 'Finished',
  failed: 'Failed',
}

export const DOC_KINDS = [
  'syllabus',
  'curriculum',
  'sample_paper',
  'question_paper',
  'marking_scheme',
  'notification',
  'reference',
  'other',
] as const
export type DocKind = (typeof DOC_KINDS)[number]

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  syllabus: 'Syllabus',
  curriculum: 'Curriculum',
  sample_paper: 'Sample Paper',
  question_paper: 'Question Paper',
  marking_scheme: 'Marking Scheme',
  notification: 'Notification',
  reference: 'Reference',
  other: 'Document',
}

export const CHANGE_TYPES = ['added', 'removed', 'renamed', 'moved', 'reordered', 'subject_changed'] as const
export type ChangeType = (typeof CHANGE_TYPES)[number]

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: 'New chapter',
  removed: 'Removed chapter',
  renamed: 'Renamed chapter',
  moved: 'Moved topic',
  reordered: 'Chapter order changed',
  subject_changed: 'Subject changed',
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

export interface SourceRegistryRow {
  id: string
  board_id: string | null
  source_name: string
  domain: string
  base_url: string
  source_type: SourceType
  license_status: LicenseStatus
  redistribution_allowed: boolean
  access_method: AccessMethod
  enabled: boolean
  priority: number
  source_status: 'active' | 'unavailable' | 'paused'
  notes: string | null
  last_checked_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  last_error: string | null
  consecutive_failures: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SourceDocumentRow {
  id: string
  source_id: string
  board_id: string | null
  class_id: string | null
  subject_id: string | null
  chapter_id: string | null
  academic_session: string | null
  doc_kind: DocKind
  title: string
  title_normalized: string
  canonical_url: string
  domain: string
  publisher: string | null
  source_type: SourceType
  license_status: LicenseStatus
  redistribution_allowed: boolean
  access_method: AccessMethod
  official_status: OfficialStatus
  retrieval_status: RetrievalStatus
  storage_path: string | null
  file_hash: string | null
  mime_type: string | null
  size_bytes: number | null
  http_status: number | null
  etag: string | null
  last_modified: string | null
  duplicate_of: string | null
  retrieved_at: string | null
  first_seen_at: string
  last_checked_at: string | null
  link_status: 'unchecked' | 'ok' | 'broken' | 'timeout' | 'blocked'
  link_http_status: number | null
  link_checked_at: string | null
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CrawlRunRow {
  id: string
  source_id: string | null
  trigger: 'manual' | 'schedule' | 'webhook'
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  started_at: string
  finished_at: string | null
  pages_fetched: number
  pages_skipped: number
  documents_found: number
  documents_stored: number
  documents_linked: number
  blocked_by_robots: number
  rate_limited: number
  errors: number
  error_message: string | null
  created_by: string | null
  created_at: string
}

export interface CrawlItemRow {
  id: string
  run_id: string
  url: string
  depth: number
  http_status: number | null
  outcome:
    | 'fetched'
    | 'skipped_robots'
    | 'skipped_depth'
    | 'skipped_domain'
    | 'skipped_size'
    | 'skipped_type'
    | 'rate_limited'
    | 'error'
    | 'not_found'
  bytes: number | null
  content_type: string | null
  document_id: string | null
  message: string | null
  created_at: string
}

export interface SyllabusDiscoveryJobRow {
  id: string
  source_id: string | null
  board_id: string
  class_id: string | null
  subject_id: string | null
  academic_session: string | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage: 'discover' | 'extract' | 'normalize' | 'compare' | 'review' | 'applied'
  progress: number
  found_subjects: number
  found_chapters: number
  added_count: number
  renamed_count: number
  removed_count: number
  moved_count: number
  unchanged_count: number
  error: string | null
  created_by: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface SyllabusChangeItemRow {
  id: string
  change_set_id: string
  change_type: ChangeType
  entity: 'subject' | 'chapter' | 'topic'
  existing_id: string | null
  existing_name: string | null
  discovered_name: string | null
  details: Record<string, unknown>
  applied: boolean
  created_at: string
}

export interface SyllabusChangeSetRow {
  id: string
  job_id: string | null
  board_id: string
  class_id: string | null
  subject_id: string
  academic_session: string | null
  baseline: DiscoveredChapter[]
  discovered: DiscoveredChapter[]
  summary: Record<string, unknown>
  status: 'needs_review' | 'approved' | 'rejected' | 'applied'
  reviewed_by: string | null
  reviewed_at: string | null
  applied_at: string | null
  created_at: string
  updated_at: string
}

export interface ChapterMapRow {
  id: string
  chapter_id: string
  board_id: string | null
  class_id: string | null
  subject_id: string | null
  academic_session: string | null
  status: 'draft' | 'generated' | 'validated' | 'approved' | 'stale'
  topics: ChapterMapTopic[]
  learning_objectives: string[]
  prerequisites: string[]
  formulas: FormulaRecord[]
  important_concepts: string[]
  source_id: string | null
  generation_source: string
  generation_model: string | null
  prompt_version: string | null
  generated_at: string | null
  approved_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContentGenerationJobRow {
  id: string
  job_type: JobType
  status: JobStatus
  priority: number
  board_id: string | null
  class_id: string | null
  stream_id: string | null
  subject_id: string | null
  chapter_id: string | null
  source_id: string | null
  document_id: string | null
  academic_session: string | null
  depth: DepthLevel | null
  params: Record<string, unknown>
  stage: JobStage
  progress: number
  steps_total: number
  steps_done: number
  result: Record<string, unknown>
  error: string | null
  attempts: number
  max_attempts: number
  parent_job_id: string | null
  created_by: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface GeneratedNoteRow {
  id: string
  chapter_id: string
  board_id: string | null
  class_id: string | null
  subject_id: string | null
  academic_session: string | null
  note_type: NoteType
  depth: DepthLevel
  title: string
  status: ContentStatus
  quality_score: number | null
  quality_grade: 'A' | 'B' | 'C' | 'review' | null
  word_count: number
  generation_source: 'ai' | 'imported' | 'manual' | 'hybrid'
  source_references: SourceReference[]
  generation_model: string | null
  prompt_version: string | null
  syllabus_version: string | null
  generation_version: number
  content_hash: string | null
  job_id: string | null
  resource_id: string | null
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface NoteSectionRow {
  id: string
  note_id: string
  section_key: string
  position: number
  heading: string
  summary: string | null
  created_at: string
}

export interface NoteItemRow {
  id: string
  section_id: string
  position: number
  item_type: NoteItemType
  body: string
  meta: Record<string, unknown>
  created_at: string
}

export interface SourceProvenanceRow {
  id: string
  entity_type: 'note' | 'document' | 'pyq_question' | 'resource' | 'paper' | 'question'
  entity_id: string
  source_id: string | null
  document_id: string | null
  board_id: string | null
  class_id: string | null
  subject_id: string | null
  chapter_id: string | null
  source_name: string
  domain: string | null
  publisher: string | null
  source_url: string | null
  source_type: string | null
  license_status: LicenseStatus
  redistribution_allowed: boolean
  access_method: AccessMethod
  official_status: OfficialStatus
  attribution: string | null
  retrieved_at: string | null
  created_at: string
}

export interface ContentValidationResultRow {
  id: string
  entity_type: 'note' | 'document' | 'pyq_import' | 'paper' | 'chapter_map'
  entity_id: string
  job_id: string | null
  checks_run: string[]
  quality_score: number | null
  quality_grade: 'A' | 'B' | 'C' | 'review' | null
  passed: boolean
  warnings: ValidationIssue[]
  errors: ValidationIssue[]
  coverage: CoverageReport
  /** Targeted repair (spec §37): passes run, and the sections they touched. */
  repair_attempts: number
  repaired_targets: string[]
  created_at: string
}

export interface PyqImportJobRow {
  id: string
  board_id: string | null
  class_id: string | null
  subject_id: string | null
  source_id: string | null
  document_id: string | null
  academic_session: string | null
  year: number | null
  exam_type: string
  status: 'queued' | 'running' | 'extracting' | 'classifying' | 'deduplicating' | 'completed' | 'failed' | 'needs_review'
  progress: number
  questions_found: number
  questions_imported: number
  duplicates_blocked: number
  low_confidence: number
  job_id: string | null
  error: string | null
  created_by: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface PaperMetadataRow {
  id: string
  document_id: string | null
  source_id: string | null
  board_id: string | null
  class_id: string | null
  subject_id: string | null
  year: number | null
  academic_session: string | null
  exam_type: 'board' | 'sample' | 'unit_test' | 'mid_term' | 'pre_board' | 'other' | 'unknown'
  paper_set: string
  language: string
  marks: number | null
  duration_minutes: number | null
  question_count: number | null
  official_status: OfficialStatus
  marking_scheme_document_id: string | null
  sections: PaperSection[]
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ExtractedQuestionRow {
  id: string
  paper_id: string | null
  document_id: string | null
  board_id: string | null
  class_id: string | null
  subject_id: string | null
  chapter_id: string | null
  year: number | null
  question_number: string | null
  question_text: string
  question_type: string
  marks: number | null
  difficulty: 'easy' | 'moderate' | 'hard' | null
  topic: string | null
  mapping_confidence: number | null
  mapping_source: 'ai' | 'rule' | 'manual'
  needs_review: boolean
  imported_question_id: string | null
  created_at: string
  updated_at: string
}

export interface ContentEngineSettingsRow {
  id: boolean
  daily_maintenance_enabled: boolean
  syllabus_check_enabled: boolean
  source_check_interval_hours: number
  storable_licenses: LicenseStatus[]
  metadata_only_licenses: LicenseStatus[]
  blocked_licenses: LicenseStatus[]
  auto_approve: boolean
  max_concurrent_jobs: number
  rate_limit_ms: number
  max_crawl_depth: number
  max_file_mb: number
  updated_by: string | null
  updated_at: string
}

/* -------------------------------------------------------------------------- */
/* Normalised discovery payloads (what adapters return)                       */
/* -------------------------------------------------------------------------- */

/** One chapter as discovered from a syllabus source, before reconciliation. */
export interface DiscoveredChapter {
  name: string
  slug: string
  chapter_number?: number
  display_order?: number
  description?: string
  topics?: string[]
}

export interface DiscoveredSubject {
  name: string
  slug: string
  code?: string
  stream?: string
  chapters: DiscoveredChapter[]
}

/** Normalised syllabus — the adapter contract for every board. */
export interface DiscoveredSyllabus {
  boardSlug: string
  boardName: string
  classSlug?: string
  className: string
  academicSession: string
  subjects: DiscoveredSubject[]
  sourceUrl: string
  sourceName: string
  sourceType: SourceType
  licenseStatus: LicenseStatus
  discoveredAt: string
}

export interface ChapterMapTopic {
  name: string
  subtopics?: string[]
  learning_objectives?: string[]
  prerequisites?: string[]
  formulas?: string[]
  important_concepts?: string[]
}

export interface FormulaRecord {
  formula: string
  meaning: string
  variables?: Array<{ symbol: string; meaning: string; unit?: string }>
  topic?: string
  source?: string
}

export interface ReactionRecord {
  reactants: string
  reagents: string
  conditions?: string
  products: string
  reaction_name?: string
  mechanism?: string
  topic?: string
  verified?: boolean
}

export interface SourceReference {
  source_name: string
  source_url?: string
  domain?: string
  official_status?: OfficialStatus
  retrieved_at?: string
  note?: string
}

export interface PaperSection {
  name: string
  marks?: number
  question_count?: number
  question_types?: string[]
}

/* -------------------------------------------------------------------------- */
/* Validation (spec §22/23)                                                    */
/* -------------------------------------------------------------------------- */

export type ValidationSeverity = 'info' | 'warning' | 'error'

export interface ValidationIssue {
  code: string
  label: string
  detail?: string
  severity: ValidationSeverity
  /** The section/topic the issue points at, when it is localised. */
  target?: string
}

export interface CoverageReport {
  expected: string[]
  covered: string[]
  missing: string[]
}

export interface ValidationReport {
  entity_type: 'note' | 'document' | 'pyq_import' | 'paper' | 'chapter_map'
  entity_id: string
  checks_run: string[]
  quality_score: number
  quality_grade: 'A' | 'B' | 'C' | 'review'
  passed: boolean
  warnings: ValidationIssue[]
  errors: ValidationIssue[]
  coverage: CoverageReport
}

/* -------------------------------------------------------------------------- */
/* Engine statistics (spec §66/69)                                             */
/* -------------------------------------------------------------------------- */

export interface EngineStats {
  coverage: number
  generated_notes: number
  notes_needing_review: number
  verified_pyqs: number
  sample_papers: number
  discovered_documents: number
  stored_documents: number
  linked_documents: number
  needs_review: number
  failed_jobs: number
  running_jobs: number
  enabled_sources: number
  unavailable_sources: number
  broken_links: number
  maintenance: {
    daily: boolean
    syllabus: boolean
    intervalHours: number
    autoApprove: boolean
  }
}

export interface CoverageRow {
  board_id: string | null
  board_name: string
  class_id: string | null
  class_name: string
  subject_id: string
  subject_name: string
  subject_slug: string
  chapter_count: number
  with_notes: number
  with_revision: number
  with_formulas: number
  with_concepts: number
  with_practice: number
  with_quiz: number
  with_flashcards: number
  with_pyqs: number
  sample_papers: number
  coverage_percent: number
}

export interface MissingContentRow {
  chapter_id: string
  chapter_name: string
  subject_name: string
  class_name: string
  board_name: string | null
  subject_id: string
  class_id: string
  board_id: string | null
  missing: string[]
}

export interface ContentHealth {
  generatedAt: string
  sources: { total: number; enabled: number; unavailable: number; stale: number }
  links: { checked: number; broken: number }
  content: {
    missingChapters: number
    failedJobs: number
    stalePapers: number
    failedEmbeddings: number
  }
  reviews: { notes: number; syllabusChanges: number; questionMappings: number }
}

/* -------------------------------------------------------------------------- */
/* Actions the admin can ask the worker to perform (spec §82)                  */
/* -------------------------------------------------------------------------- */

export const ENGINE_ACTIONS = [
  'discoverSyllabus',
  'buildChapterMap',
  'generateNotes',
  'generateRevisionNotes',
  'extractFormulas',
  'extractReactions',
  'discoverPYQs',
  'discoverSamplePapers',
  'verifySource',
  'importDocument',
  'classifyPaper',
  'validateContent',
  'publishContent',
  'rebuildContent',
  'findMissingContent',
  'dailyMaintenance',
  'processJobs',
] as const
export type EngineAction = (typeof ENGINE_ACTIONS)[number]

export interface EngineRequest {
  action: EngineAction
  [key: string]: unknown
}

/** Everything the worker knows how to report back. */
export interface EngineResponse {
  ok: boolean
  action: EngineAction
  jobId?: string
  summary?: string
  counts?: Record<string, number>
  warnings?: ValidationIssue[]
  data?: unknown
}
