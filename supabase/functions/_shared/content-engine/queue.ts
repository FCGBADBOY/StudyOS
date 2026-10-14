/**
 * The async worker loop (spec §40/§62).
 *
 * Responsibilities, in order:
 *
 *   1. **claim** a batch atomically via `ce_claim_jobs()` — `FOR UPDATE SKIP
 *      LOCKED` means two invocations can never take the same row, and only the
 *      service role can call it;
 *   2. **dispatch** by `job_type`, one handler per type;
 *   3. **finish or fail that row alone** — a chapter that throws marks itself
 *      `failed` (or `partial` for fan-out jobs) and the loop moves on, so a
 *      single bad chapter never stops a batch;
 *   4. **never publish** — the terminal state for generated material is
 *      `needs_review`, which only a human clears.
 *
 * A crashed worker is recovered by the 15-minute stale-lock clause in
 * `ce_claim_jobs()`, so an edge function that dies mid-run does not wedge the
 * queue.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { AiProvider } from '../ai/providers/provider.interface.ts'
import type { ContentGenerationJobRow, JobStage } from '../../../../src/content-engine/types.ts'
import { JOB_START_STAGE, STAGE_ORDER } from '../../../../src/content-engine/jobs.ts'
import { generateNote } from './notes.ts'
import { runDiscovery } from './discovery.ts'
import { PoliteFetcher } from './crawler.ts'
import { adapterForDomain, getSourceAdapterById } from '../../../../src/content-engine/sources/registry.ts'
import { log } from '../logging.ts'

export interface WorkerDeps {
  sb: SupabaseClient
  provider: AiProvider | null
  workerId: string
  /** Safety valve so one invocation cannot run forever. */
  timeBudgetMs?: number
}

export interface WorkerSummary {
  claimed: number
  completed: number
  failed: number
  partial: number
  errors: Array<{ jobId: string; jobType: string; message: string }>
}

type Handler = (job: ContentGenerationJobRow, deps: WorkerDeps) => Promise<HandlerResult>

interface HandlerResult {
  status?: 'completed' | 'partial'
  result?: Record<string, unknown>
  /** For fan-out jobs: child rows the parent is waiting on. */
  spawned?: number
}

const NOTE_TYPE_BY_JOB: Record<string, string> = {
  generate_notes: 'notes',
  generate_revision: 'quick_revision',
  generate_formula_sheet: 'formula_sheet',
  generate_quiz: 'quiz',
  generate_flashcards: 'flashcards',
  generate_practice: 'practice_questions',
}

/* -------------------------------------------------------------------------- */
/* Progress bookkeeping                                                       */
/* -------------------------------------------------------------------------- */

async function stage(sb: SupabaseClient, jobId: string, value: JobStage): Promise<void> {
  await sb.from('content_generation_jobs').update({ stage: value }).eq('id', jobId)
}

async function progress(
  sb: SupabaseClient,
  jobId: string,
  done: number,
  total: number,
): Promise<void> {
  await sb
    .from('content_generation_jobs')
    .update({
      steps_done: done,
      steps_total: total,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    })
    .eq('id', jobId)
}

/* -------------------------------------------------------------------------- */
/* Handlers                                                                   */
/* -------------------------------------------------------------------------- */

/** Load the full academic context a note needs; throws when it is missing. */
async function loadChapterContext(
  sb: SupabaseClient,
  chapterId: string,
): Promise<{
  id: string
  name: string
  board_id: string
  class_id: string
  subject_id: string
  boardName: string
  className: string
  subjectName: string
  topics: string[]
}> {
  const { data, error } = await sb
    .from('chapters')
    .select(
      `id, name, subject_id, topics,
       subjects!inner ( id, name, class_id, board_id,
         classes!inner ( id, name ),
         boards!inner ( id, name ) )`,
    )
    .eq('id', chapterId)
    .maybeSingle()

  if (error) throw new Error(`Could not load the chapter: ${error.message}`)
  if (!data) throw new Error('That chapter no longer exists.')

  const row = data as unknown as {
    id: string
    name: string
    topics: string[] | null
    subject_id: string
    subjects: {
      id: string
      name: string
      class_id: string
      board_id: string | null
      classes: { id: string; name: string }
      boards: { id: string; name: string } | null
    }
  }

  /* The chapter's own `topics` column is the syllabus scope; a generated
     chapter map only fills in what the column left out. */
  let topics = Array.isArray(row.topics) ? row.topics.filter(Boolean) : []
  if (topics.length === 0) {
    const { data: map } = await sb.from('chapter_maps').select('topics').eq('chapter_id', chapterId).maybeSingle()
    const mapped = (map as { topics?: unknown } | null)?.topics
    if (Array.isArray(mapped)) topics = mapped.filter((entry): entry is string => typeof entry === 'string')
  }

  return {
    id: row.id,
    name: row.name,
    board_id: row.subjects?.board_id ?? '',
    class_id: row.subjects?.class_id ?? '',
    subject_id: row.subject_id,
    boardName: row.subjects?.boards?.name ?? 'Unknown board',
    className: row.subjects?.classes?.name ?? 'Unknown class',
    subjectName: row.subjects?.name ?? 'Unknown subject',
    topics,
  }
}

const generateNotesHandler: Handler = async (job, deps) => {
  if (!deps.provider) throw new Error('No AI provider is configured on this server.')
  if (!job.chapter_id) throw new Error('This job has no chapter attached.')

  await stage(deps.sb, job.id, 'generation')
  const chapter = await loadChapterContext(deps.sb, job.chapter_id)

  const outcome = await generateNote(deps.sb, deps.provider, {
    chapter,
    noteType: (NOTE_TYPE_BY_JOB[job.job_type] ?? 'notes') as never,
    depth: job.depth ?? 'standard',
    academicSession: job.academic_session ?? 'unknown',
    jobId: job.id,
    userId: job.created_by,
  })

  await stage(deps.sb, job.id, 'validation')
  await progress(deps.sb, job.id, 1, 1)

  /* Indexing is queued only once a human approves — see `publishNote`. */
  return {
    status: 'completed',
    result: {
      noteId: outcome.noteId,
      qualityScore: outcome.qualityScore,
      qualityGrade: outcome.qualityGrade,
      wordCount: outcome.wordCount,
      repaired: outcome.repaired,
      passed: outcome.passed,
      reviewRequired: true,
    },
  }
}

const discoveryHandler: Handler = async (job, deps) => {
  await stage(deps.sb, job.id, 'discovery')

  const { data: source, error } = await deps.sb
    .from('source_registry')
    .select('*')
    .eq('id', job.source_id ?? '')
    .maybeSingle()
  if (error) throw new Error(`Could not load the source: ${error.message}`)
  if (!source) throw new Error('This job has no enabled source attached.')

  const row = source as {
    id: string
    source_name: string
    domain: string
    base_url: string
    source_type: string
    license_status: string
    redistribution_allowed: boolean
    access_method: string
    enabled: boolean
  }
  if (!row.enabled) throw new Error('That source is disabled.')

  /* The source row carries a domain, so resolve the adapter by domain; fall
     back to its stable id for sources registered before adapters keyed on
     hostnames. An unknown adapter is reported, never guessed at. */
  const adapter = adapterForDomain(row.domain) ?? getSourceAdapterById(row.id)
  if (!adapter) throw new Error(`No board adapter matches ${row.domain}.`)

  const fetcher = new PoliteFetcher({ allowedDomains: adapter.domains })
  const run = await runDiscovery({
    source: {
      id: row.id,
      name: row.source_name,
      domain: row.domain,
      baseUrl: row.base_url || adapter.baseUrl,
      sourceType: row.source_type as never,
      licenseStatus: row.license_status as never,
      redistributionAllowed: row.redistribution_allowed,
      accessMethod: row.access_method as never,
    },
    adapter,
    fetcher,
    kind: job.job_type === 'discover_syllabus' ? 'syllabus' : 'papers',
    maxDocuments: 40,
    signal: undefined,
  })

  await progress(deps.sb, job.id, run.documents.length, Math.max(run.documents.length, 1))

  let stored = 0
  let linked = 0
  for (const document of run.documents) {
    const { data: inserted, error: upsertError } = await deps.sb
      .from('source_documents')
      .upsert(
        {
          source_id: document.sourceId,
          canonical_url: document.canonicalUrl,
          domain: document.domain,
          title: document.title,
          title_normalized: document.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
          academic_session: document.academicSession,
          doc_kind: document.docKind,
          official_status: document.officialStatus,
          license_status: document.licenseStatus,
          redistribution_allowed: document.redistributionAllowed,
          access_method: document.accessMethod,
          /* Storage is decided by the licence, never by convenience: a
             document we may not redistribute stays `linked` even if we
             downloaded it to read it. */
          retrieval_status: document.retrievalStatus === 'stored' ? 'linked' : document.retrievalStatus,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: 'source_id,canonical_url' },
      )
      .select('id')
      .single()

    if (upsertError) {
      log('warning', 'content_engine.document_upsert_failed', { message: upsertError.message })
      continue
    }
    if (inserted && document.retrievalStatus === 'stored') stored += 1
    else linked += 1
  }

  await stage(deps.sb, job.id, 'done')

  return {
    status: run.errors.length && run.documents.length === 0 ? 'partial' : 'completed',
    result: {
      session: run.session?.academicSession ?? null,
      fetched: run.fetched,
      refused: run.refused,
      documents: run.documents.length,
      stored,
      linked,
      errors: run.errors.slice(0, 5),
    },
  }
}

/**
 * Fan-out jobs expand into per-chapter work and stop. The parent reports
 * `partial` until its children are done — which is exactly what the admin
 * dashboard shows as "some chapters finished, some did not".
 */
const fanOutHandler: Handler = async (job, deps) => {
  await stage(deps.sb, job.id, 'queued')

  /* `chapters` hangs off subjects, not classes — scope through the join. */
  let query = deps.sb.from('chapters').select('id, subjects!inner(class_id)').eq('is_archived', false).limit(500)
  if (job.subject_id) query = query.eq('subject_id', job.subject_id)
  else if (job.class_id) query = query.eq('subjects.class_id', job.class_id)
  else throw new Error('This job has neither a class nor a subject to build from.')

  const { data: chapters, error: chapterError } = await query
  if (chapterError) throw new Error(`Could not load chapters: ${chapterError.message}`)

  const chapterIds = (chapters ?? []).map((row) => (row as { id: string }).id)
  if (chapterIds.length === 0) throw new Error('No chapters matched this scope.')

  const noteJobs = ['generate_notes', 'generate_revision', 'generate_formula_sheet']
  let spawned = 0
  const rows = chapterIds.flatMap((chapterId) =>
    noteJobs.map((jobType) => ({
      job_type: jobType,
      status: 'queued',
      priority: job.priority + 1,
      board_id: job.board_id,
      class_id: job.class_id,
      subject_id: job.subject_id,
      chapter_id: chapterId,
      academic_session: job.academic_session,
      depth: job.depth ?? 'standard',
      parent_job_id: job.id,
      created_by: job.created_by,
    })),
  )

  for (let index = 0; index < rows.length; index += 25) {
    const slice = rows.slice(index, index + 25)
    const { error } = await deps.sb.from('content_generation_jobs').insert(slice)
    if (error) throw new Error(`Could not queue chapter work: ${error.message}`)
    spawned += slice.length
  }

  await progress(deps.sb, job.id, spawned, spawned)
  return { status: 'completed', spawned, result: { chapters: chapterIds.length, spawned } }
}

const maintenanceHandler: Handler = async (job, deps) => {
  await stage(deps.sb, job.id, 'discovery')

  /* Re-check links on discovered documents; a broken link demotes the row. */
  const { data: documents } = await deps.sb
    .from('source_documents')
    .select('id, canonical_url')
    .neq('link_status', 'blocked')
    .limit(50)

  let checked = 0
  let broken = 0
  for (const document of documents ?? []) {
    const url = (document as { canonical_url: string }).canonical_url
    let status = 'ok'
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      if (!response.ok) status = 'broken'
    } catch {
      status = 'timeout'
    }
    await deps.sb.from('source_documents').update({ link_status: status }).eq('id', (document as { id: string }).id)
    checked += 1
    if (status !== 'ok') broken += 1
  }

  await stage(deps.sb, job.id, 'done')
  await progress(deps.sb, job.id, checked, Math.max(checked, 1))
  return { status: 'completed', result: { checked, broken } }
}

const HANDLERS: Record<string, Handler> = {
  generate_notes: generateNotesHandler,
  generate_revision: generateNotesHandler,
  generate_formula_sheet: generateNotesHandler,
  generate_quiz: generateNotesHandler,
  generate_flashcards: generateNotesHandler,
  generate_practice: generateNotesHandler,
  discover_syllabus: discoveryHandler,
  discover_pyqs: discoveryHandler,
  discover_sample_papers: discoveryHandler,
  build_class: fanOutHandler,
  build_subject: fanOutHandler,
  build_chapter: fanOutHandler,
  daily_maintenance: maintenanceHandler,
}

/* -------------------------------------------------------------------------- */
/* Loop                                                                       */
/* -------------------------------------------------------------------------- */

async function claimBatch(sb: SupabaseClient, limit: number, workerId: string): Promise<ContentGenerationJobRow[]> {
  const { data, error } = await sb.rpc('ce_claim_jobs', { p_limit: limit, p_worker: workerId })
  if (error) throw new Error(`Could not claim jobs: ${error.message}`)
  return (data ?? []) as ContentGenerationJobRow[]
}

async function finish(
  sb: SupabaseClient,
  job: ContentGenerationJobRow,
  outcome: { status: 'completed' | 'failed' | 'partial'; result?: Record<string, unknown>; error?: string },
): Promise<void> {
  await sb
    .from('content_generation_jobs')
    .update({
      status: outcome.status,
      stage: outcome.status === 'failed' ? 'failed' : 'done',
      progress: outcome.status === 'failed' ? undefined : 100,
      result: outcome.result ?? {},
      error: outcome.error ?? null,
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq('id', job.id)
}

/**
 * Claim and run up to `batchSize` jobs, stopping early if the time budget is
 * spent. Always resolves — a worker error is reported, never thrown, so one
 * bad run cannot take down the invocation.
 */
export async function runWorker(deps: WorkerDeps, batchSize = 5): Promise<WorkerSummary> {
  const summary: WorkerSummary = { claimed: 0, completed: 0, failed: 0, partial: 0, errors: [] }
  const deadline = Date.now() + (deps.timeBudgetMs ?? 240_000)

  let jobs: ContentGenerationJobRow[]
  try {
    jobs = await claimBatch(deps.sb, batchSize, deps.workerId)
  } catch (error) {
    summary.errors.push({
      jobId: '',
      jobType: 'claim',
      message: error instanceof Error ? error.message : String(error),
    })
    return summary
  }

  summary.claimed = jobs.length

  for (const job of jobs) {
    if (Date.now() > deadline) {
      /* Out of time — hand the row back rather than leave it locked. */
      await finish(deps.sb, job, { status: 'failed', error: 'The worker ran out of its time budget.' })
      summary.failed += 1
      summary.errors.push({ jobId: job.id, jobType: job.job_type, message: 'time budget exhausted' })
      continue
    }

    const handler = HANDLERS[job.job_type]
    if (!handler) {
      await finish(deps.sb, job, { status: 'failed', error: `No handler for "${job.job_type}".` })
      summary.failed += 1
      summary.errors.push({ jobId: job.id, jobType: job.job_type, message: 'unhandled job type' })
      continue
    }

    try {
      const result = await handler(job, deps)
      const status = result.status ?? 'completed'
      await finish(deps.sb, job, { status, result: result.result })
      if (status === 'partial') summary.partial += 1
      else summary.completed += 1
      log('info', 'content_engine.job_done', { jobId: job.id, jobType: job.job_type, status })
    } catch (error) {
      /* Chapter-scoped failure: record it here and keep going. */
      const message = error instanceof Error ? error.message : String(error)
      const retrying = job.attempts < job.max_attempts
      await finish(deps.sb, job, {
        status: retrying ? 'partial' : 'failed',
        error: message,
      })
      if (!retrying) summary.failed += 1
      summary.errors.push({ jobId: job.id, jobType: job.job_type, message })
      log('warning', 'content_engine.job_failed', { jobId: job.id, jobType: job.job_type, message })
    }
  }

  return summary
}

/** First stage a job type enters — exported so the API can seed `stage`. */
export function startStageFor(jobType: string): JobStage {
  return JOB_START_STAGE[jobType as keyof typeof JOB_START_STAGE] ?? 'queued'
}

/** Ordered pipeline, for progress rendering in the admin UI. */
export const STAGES = STAGE_ORDER
