/**
 * Job model for the content engine (spec §40, §42, §43, §62, §65).
 *
 * The queue itself lives in `content_generation_jobs`; this module holds the
 * *rules* — which stage a job type starts in, which transitions are legal,
 * how a "Build class" request fans out into independent per-chapter jobs, and
 * how a syllabus change invalidates only the outputs that depended on it.
 *
 * Keeping the rules here means the admin UI can preview what a button will do
 * (\"24 jobs, 4 subjects\") before anything is queued, and the worker cannot
 * drift from what the UI promised.
 *
 * Pure: no I/O, no dependencies.
 */
import type { ContentGenerationJobRow, JobStage, JobType, SyllabusChangeItemRow } from './types'
import { JOB_TYPE_LABELS } from './types'

/* -------------------------------------------------------------------------- */
/* Stage pipeline                                                             */
/* -------------------------------------------------------------------------- */

export const STAGE_ORDER: readonly JobStage[] = [
  'queued',
  'discovery',
  'classification',
  'generation',
  'validation',
  'review',
  'publication',
  'rag_indexing',
  'done',
]

/** Where a job type enters the pipeline. */
export const JOB_START_STAGE: Record<JobType, JobStage> = {
  discover_syllabus: 'discovery',
  discover_pyqs: 'discovery',
  discover_sample_papers: 'discovery',
  import_document: 'discovery',
  daily_maintenance: 'discovery',
  build_chapter_map: 'classification',
  extract_formulas: 'generation',
  extract_reactions: 'generation',
  generate_notes: 'generation',
  generate_revision: 'generation',
  generate_formula_sheet: 'generation',
  generate_quiz: 'generation',
  generate_flashcards: 'generation',
  generate_practice: 'generation',
  validate_content: 'validation',
  rebuild_index: 'rag_indexing',
  build_class: 'queued',
  build_subject: 'queued',
  build_chapter: 'queued',
} as Record<JobType, JobStage>

/** Is `to` reachable from `from`? The pipeline only ever moves forward. */
export function canTransition(from: JobStage, to: JobStage): boolean {
  if (from === 'failed' || to === 'failed') return true
  if (from === 'done') return false
  const a = STAGE_ORDER.indexOf(from)
  const b = STAGE_ORDER.indexOf(to)
  if (a < 0 || b < 0) return false
  return b >= a
}

/** 0–100 from the stage pipeline, independent of `progress` bookkeeping. */
export function stagePercent(stage: JobStage): number {
  const index = STAGE_ORDER.indexOf(stage)
  if (index < 0) return 0
  return Math.round((index / (STAGE_ORDER.length - 1)) * 100)
}

/** Effective progress: explicit steps win, otherwise derive from the stage. */
export function effectiveProgress(job: Pick<ContentGenerationJobRow, 'progress' | 'steps_total' | 'steps_done' | 'stage'>): number {
  if (job.steps_total > 0) {
    return Math.max(0, Math.min(100, Math.round((job.steps_done / job.steps_total) * 100)))
  }
  if (job.progress > 0) return Math.max(0, Math.min(100, job.progress))
  return stagePercent(job.stage)
}

/** Whether a job should be shown as "still working" in the dashboard. */
export function isActive(status: ContentGenerationJobRow['status']): boolean {
  return status === 'queued' || status === 'running'
}

/* -------------------------------------------------------------------------- */
/* Fan-out: build a whole class (spec §40)                                     */
/* -------------------------------------------------------------------------- */

export interface ChapterTarget {
  chapterId: string
  subjectId: string
  subjectName: string
  chapterName: string
}

export interface JobDescriptor {
  job_type: JobType
  params: Record<string, unknown>
  priority: number
  /** Human label for the queue row before it has an id. */
  label: string
}

export interface BuildPlan {
  jobs: JobDescriptor[]
  subjects: number
  chapters: number
  /** Which content types will be produced for every chapter. */
  contentTypes: JobType[]
}

const CONTENT_BY_TYPE: Partial<Record<JobType, JobType[]>> = {
  build_chapter: ['generate_notes', 'generate_revision', 'generate_formula_sheet', 'generate_quiz', 'generate_flashcards'],
  build_subject: ['generate_notes', 'generate_revision', 'generate_formula_sheet', 'generate_quiz', 'generate_flashcards'],
  build_class: ['generate_notes', 'generate_revision', 'generate_formula_sheet', 'generate_quiz', 'generate_flashcards'],
}

export interface BuildPlanInput {
  jobType: Extract<JobType, 'build_class' | 'build_subject' | 'build_chapter'>
  scope: { boardId?: string; classId?: string; subjectId?: string; chapterId?: string }
  depth?: string
  chapters: ChapterTarget[]
  /** Content types to produce; defaults to the standard chapter pack. */
  contentTypes?: JobType[]
}

/**
 * Expand a "BUILD CLASS / SUBJECT / CHAPTER" request into independent jobs.
 *
 * Chapters are processed separately on purpose: one failing chapter must never
 * stop the rest of the class (spec §40). `parent_job_id` links them so the
 * parent can report an aggregate `partial` status.
 */
export function planBuild(input: BuildPlanInput): BuildPlan {
  const contentTypes = input.contentTypes?.length
    ? input.contentTypes
    : (CONTENT_BY_TYPE[input.jobType] ?? ['generate_notes'])

  const scoped =
    input.jobType === 'build_chapter'
      ? input.chapters.filter((chapter) => chapter.chapterId === input.scope.chapterId)
      : input.jobType === 'build_subject'
        ? input.chapters.filter((chapter) => chapter.subjectId === input.scope.subjectId)
        : input.chapters

  const jobs: JobDescriptor[] = []

  /* One discovery/map job first so generation has a chapter map to work from. */
  jobs.push({
    job_type: 'build_chapter_map',
    params: { ...input.scope, ...(input.depth ? { depth: input.depth } : {}) },
    priority: 30,
    label: `${JOB_TYPE_LABELS.build_chapter_map} — ${scoped.length} chapter(s)`,
  })

  for (const chapter of scoped) {
    for (const contentType of contentTypes) {
      jobs.push({
        job_type: contentType,
        params: {
          ...input.scope,
          chapterId: chapter.chapterId,
          subjectId: chapter.subjectId,
          chapterName: chapter.chapterName,
          subjectName: chapter.subjectName,
          ...(input.depth ? { depth: input.depth } : {}),
        },
        priority: 100,
        label: `${JOB_TYPE_LABELS[contentType]} — ${chapter.subjectName} · ${chapter.chapterName}`,
      })
    }
  }

  return {
    jobs,
    subjects: new Set(scoped.map((chapter) => chapter.subjectId)).size,
    chapters: scoped.length,
    contentTypes,
  }
}

/* -------------------------------------------------------------------------- */
/* Incremental regeneration (spec §43)                                         */
/* -------------------------------------------------------------------------- */

export interface DependentOutput {
  id: string
  type: 'generated_note' | 'resource' | 'embedding' | 'pyq_question' | 'chapter_map'
  chapterId?: string | null
  subjectId?: string | null
}

/**
 * Given a syllabus diff, which outputs must be regenerated?
 *
 * A renamed chapter keeps its notes but needs re-titling; a new chapter has
 * nothing and needs everything; a *removed* chapter must not drag anything
 * with it. Physics must never be regenerated because Chemistry changed.
 */
export function affectedBySyllabusChange(
  changes: Pick<SyllabusChangeItemRow, 'change_type' | 'entity' | 'existing_id' | 'discovered_name' | 'details'>[],
  outputs: DependentOutput[],
): { regenerate: DependentOutput[]; unaffected: DependentOutput[]; byReason: Record<string, number> } {
  const touchedChapterIds = new Set<string>()
  const byReason: Record<string, number> = {}

  for (const change of changes) {
    if (change.entity !== 'chapter') continue
    if (change.change_type === 'added') continue // nothing depends on it yet
    if (change.change_type === 'removed') continue // nothing to regenerate

    const chapterId = change.existing_id ?? (change.details?.chapterId as string | undefined)
    if (!chapterId) continue
    touchedChapterIds.add(chapterId)
    byReason[change.change_type] = (byReason[change.change_type] ?? 0) + 1
  }

  const regenerate = outputs.filter((output) => output.chapterId && touchedChapterIds.has(output.chapterId))
  const regenerateIds = new Set(regenerate.map((output) => output.id))

  return {
    regenerate,
    unaffected: outputs.filter((output) => !regenerateIds.has(output.id)),
    byReason,
  }
}

/* -------------------------------------------------------------------------- */
/* Scheduling (spec §42)                                                       */
/* -------------------------------------------------------------------------- */

export type ScheduleKind = 'daily' | 'weekly' | 'session_change' | 'source_update'

export interface ScheduledJob {
  kind: ScheduleKind
  jobType: JobType
  label: string
  /** Rule description shown in the automation panel. */
  rule: string
  enabledSetting: 'daily' | 'syllabus' | null
}

/**
 * Recurring jobs the automation layer may run. The scheduler itself lives in
 * the worker (cron invocation of `content-engine`); this list is what the
 * dashboard displays and what settings toggle.
 */
export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
  {
    kind: 'daily',
    jobType: 'daily_maintenance',
    label: 'Daily content health',
    rule: 'Every day: check enabled sources, new papers, changed sources, missing content, failed embeddings, broken links and syllabus changes.',
    enabledSetting: 'daily',
  },
  {
    kind: 'weekly',
    jobType: 'discover_syllabus',
    label: 'Weekly syllabus check',
    rule: 'Every week: re-read enabled syllabus sources and report a diff — never overwrite.',
    enabledSetting: 'syllabus',
  },
  {
    kind: 'session_change',
    jobType: 'discover_sample_papers',
    label: 'New academic session',
    rule: 'When a new academic session is detected on an enabled source: discover curriculum and sample papers.',
    enabledSetting: 'syllabus',
  },
  {
    kind: 'source_update',
    jobType: 'import_document',
    label: 'Source update',
    rule: 'When a tracked document changes (hash / ETag / last-modified): re-import its metadata and queue only the affected outputs.',
    enabledSetting: null,
  },
]

/** Next run time for a schedule, for the "last / next check" column. */
export function nextRun(kind: ScheduleKind, intervalHours: number, from: Date = new Date()): Date {
  const next = new Date(from.getTime())
  if (kind === 'daily') next.setUTCHours(2, 0, 0, 0)
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1)
  if (kind === 'weekly') next.setUTCDate(next.getUTCDate() + 7)
  if (kind === 'session_change' || kind === 'source_update') {
    next.setTime(from.getTime() + Math.max(1, intervalHours) * 3_600_000)
  }
  return next
}
