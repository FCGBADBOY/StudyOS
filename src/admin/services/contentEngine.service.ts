/**
 * Admin service: Autonomous Content Engine.
 *
 * Every figure on the engine screens comes from the database through the
 * `ce_*()` RPCs or the engine tables — there is no client-side arithmetic
 * standing in for a missing backend, and no seeded sample numbers (spec §66).
 * In demo mode (no Supabase configured) the queries return empty structures so
 * the UI shows honest empty states instead of invented statistics.
 *
 * Privileged work (crawl / generate / publish) never happens here: it goes
 * through the `content-engine` edge function, which holds the service-role key
 * and re-checks the caller's permission (spec §81).
 */
import { db, isDemo, rows, one, mutate, memo } from '@/services/shared'
import { engine, invokeEngine } from '@/content-engine/api'
import type {
  ContentEngineSettingsRow,
  ContentGenerationJobRow,
  ContentHealth,
  ContentValidationResultRow,
  CoverageRow,
  CrawlItemRow,
  CrawlRunRow,
  EngineAction,
  EngineResponse,
  ExtractedQuestionRow,
  GeneratedNoteRow,
  JobType,
  MissingContentRow,
  NoteItemRow,
  NoteSectionRow,
  PaperMetadataRow,
  PyqImportJobRow,
  SourceDocumentRow,
  SourceProvenanceRow,
  SourceRegistryRow,
  SyllabusChangeItemRow,
  SyllabusChangeSetRow,
  EngineStats,
} from '@/content-engine/types'
import { logAdminAction } from './adminAudit.service'

const EMPTY_STATS: EngineStats = {
  coverage: 0,
  generated_notes: 0,
  notes_needing_review: 0,
  verified_pyqs: 0,
  sample_papers: 0,
  discovered_documents: 0,
  stored_documents: 0,
  linked_documents: 0,
  needs_review: 0,
  failed_jobs: 0,
  running_jobs: 0,
  enabled_sources: 0,
  unavailable_sources: 0,
  broken_links: 0,
  maintenance: { daily: false, syllabus: false, intervalHours: 24, autoApprove: false },
}

/* -------------------------------------------------------------------------- */
/* Dashboard aggregates                                                       */
/* -------------------------------------------------------------------------- */

export async function getEngineStats(): Promise<EngineStats> {
  if (isDemo) return EMPTY_STATS
  const client = db()
  if (!client) return EMPTY_STATS
  const { data, error } = await client.rpc('ce_stats')
  if (error) throw new Error('We could not load the content engine statistics.')
  return { ...EMPTY_STATS, ...((data as EngineStats | null) ?? {}) }
}

export async function getCoverage(boardId?: string | null, classId?: string | null): Promise<CoverageRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  const { data, error } = await client.rpc('ce_coverage', {
    p_board_id: boardId || null,
    p_class_id: classId || null,
  })
  if (error) throw new Error('We could not load the coverage report.')
  return (data as CoverageRow[]) ?? []
}

export async function getMissingContent(
  boardId?: string | null,
  classId?: string | null,
): Promise<MissingContentRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  const { data, error } = await client.rpc('ce_missing_content', {
    p_board_id: boardId || null,
    p_class_id: classId || null,
    p_limit: 60,
  })
  if (error) throw new Error('We could not scan for missing content.')
  return (data as MissingContentRow[]) ?? []
}

export async function getContentHealth(): Promise<ContentHealth> {
  if (isDemo) {
    return {
      generatedAt: new Date().toISOString(),
      sources: { total: 0, enabled: 0, unavailable: 0, stale: 0 },
      links: { checked: 0, broken: 0 },
      content: { missingChapters: 0, failedJobs: 0, stalePapers: 0, failedEmbeddings: 0 },
      reviews: { notes: 0, syllabusChanges: 0, questionMappings: 0 },
    }
  }
  const client = db()
  if (!client) throw new Error('No backend connection is available.')
  const { data, error } = await client.rpc('ce_health')
  if (error) throw new Error('We could not run the content health check.')
  return data as ContentHealth
}

/* -------------------------------------------------------------------------- */
/* Source registry                                                            */
/* -------------------------------------------------------------------------- */

export interface SourceFilter {
  enabled?: 'all' | 'on' | 'off'
  status?: 'all' | 'active' | 'unavailable' | 'paused'
  search?: string
}

export async function listSources(filter: SourceFilter = {}): Promise<SourceRegistryRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []

  let query = client
    .from('source_registry')
    .select('*')
    .order('priority', { ascending: true })
    .order('source_name', { ascending: true })

  if (filter.enabled === 'on') query = query.eq('enabled', true)
  if (filter.enabled === 'off') query = query.eq('enabled', false)
  if (filter.status && filter.status !== 'all') query = query.eq('source_status', filter.status)
  if (filter.search?.trim()) query = query.ilike('source_name', `%${filter.search.trim()}%`)

  return rows<SourceRegistryRow>(query)
}

export interface SourceDraft {
  source_name: string
  domain: string
  base_url: string
  board_id?: string | null
  source_type: SourceRegistryRow['source_type']
  license_status: SourceRegistryRow['license_status']
  redistribution_allowed: boolean
  access_method: SourceRegistryRow['access_method']
  enabled: boolean
  priority: number
  notes?: string | null
}

export async function createSource(draft: SourceDraft): Promise<SourceRegistryRow> {
  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  const row = await one<SourceRegistryRow>(
    client.from('source_registry').insert(draft).select().single(),
  )
  if (!row) throw new Error('The source could not be created.')

  await logAdminAction('engine.source_created', 'source_registry', row.id, { name: row.source_name })
  return row
}

export async function updateSource(id: string, patch: Partial<SourceDraft>): Promise<void> {
  const client = db()
  if (!client) return
  await mutate(client.from('source_registry').update(patch).eq('id', id))
  await logAdminAction('engine.source_updated', 'source_registry', id, { fields: Object.keys(patch) })
}

export async function deleteSource(id: string): Promise<void> {
  const client = db()
  if (!client) return
  await mutate(client.from('source_registry').delete().eq('id', id))
  await logAdminAction('engine.source_deleted', 'source_registry', id, {})
}

/** Ask the worker to re-check a source (robots, reachability, session). */
export async function verifySource(sourceId: string): Promise<EngineResponse> {
  const response = await engine.verifySource({ sourceId })
  await logAdminAction('engine.source_verified', 'source_registry', sourceId, {})
  return response
}

/* -------------------------------------------------------------------------- */
/* Documents + crawl telemetry                                                 */
/* -------------------------------------------------------------------------- */

export interface DocumentFilter {
  kind?: 'all' | SourceDocumentRow['doc_kind']
  retrieval?: 'all' | SourceDocumentRow['retrieval_status']
  official?: 'all' | SourceDocumentRow['official_status']
  search?: string
}

export async function listDocuments(
  filter: DocumentFilter = {},
  limit = 50,
  offset = 0,
): Promise<{ items: SourceDocumentRow[]; total: number }> {
  if (isDemo) return { items: [], total: 0 }
  const client = db()
  if (!client) return { items: [], total: 0 }

  let query = client
    .from('source_documents')
    .select('*', { count: 'exact' })
    .order('first_seen_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter.kind && filter.kind !== 'all') query = query.eq('doc_kind', filter.kind)
  if (filter.retrieval && filter.retrieval !== 'all') query = query.eq('retrieval_status', filter.retrieval)
  if (filter.official && filter.official !== 'all') query = query.eq('official_status', filter.official)
  if (filter.search?.trim()) query = query.ilike('title', `%${filter.search.trim()}%`)

  const { data, error, count } = await query
  if (error) throw new Error('We could not load the discovered documents.')
  return { items: (data as SourceDocumentRow[]) ?? [], total: count ?? 0 }
}

export async function listCrawlRuns(limit = 20): Promise<CrawlRunRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  return rows<CrawlRunRow>(
    client.from('crawl_runs').select('*').order('started_at', { ascending: false }).limit(limit),
  )
}

export async function listCrawlItems(runId: string): Promise<CrawlItemRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  return rows<CrawlItemRow>(
    client.from('crawl_items').select('*').eq('run_id', runId).order('created_at').limit(200),
  )
}

/* -------------------------------------------------------------------------- */
/* Job queue                                                                  */
/* -------------------------------------------------------------------------- */

export interface JobFilter {
  status?: 'all' | ContentGenerationJobRow['status']
  jobType?: 'all' | JobType
  search?: string
}

export async function listJobs(filter: JobFilter = {}, limit = 50): Promise<ContentGenerationJobRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []

  let query = client
    .from('content_generation_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filter.status && filter.status !== 'all') query = query.eq('status', filter.status)
  if (filter.jobType && filter.jobType !== 'all') query = query.eq('job_type', filter.jobType)

  return rows<ContentGenerationJobRow>(query)
}

export async function getJob(id: string): Promise<ContentGenerationJobRow | null> {
  if (isDemo) return null
  const client = db()
  if (!client) return null
  return one<ContentGenerationJobRow>(
    client.from('content_generation_jobs').select('*').eq('id', id).maybeSingle(),
  )
}

export type JobControlAction = 'run' | 'pause' | 'resume' | 'cancel' | 'retry'

/**
 * Run / pause / resume / cancel / retry.
 *
 * Goes through `ce_control_job()` (SECURITY DEFINER), which re-checks
 * `engine.manage` — the UI's disabled buttons are cosmetic, the database is
 * the gate.
 */
export async function controlJob(id: string, action: JobControlAction): Promise<ContentGenerationJobRow> {
  if (isDemo) throw new Error('Job control needs a live backend.')
  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  const { data, error } = await client.rpc('ce_control_job', { p_job_id: id, p_action: action })
  if (error) throw new Error('We could not change that job.')

  await logAdminAction(`engine.job_${action}`, 'content_generation_jobs', id, { action })
  return data as ContentGenerationJobRow
}

export async function enqueueJob(jobType: JobType, params: Record<string, unknown> = {}): Promise<ContentGenerationJobRow> {
  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  const { data, error } = await client.rpc('ce_enqueue_job', {
    p_job_type: jobType,
    p_params: params,
  })
  if (error) throw new Error('We could not queue that job.')

  await logAdminAction('engine.job_queued', 'content_generation_jobs', (data as { id: string }).id, { jobType })
  return data as ContentGenerationJobRow
}

/** Bulk controls for the jobs screen (spec §65). Each row is handled alone. */
export async function controlJobs(
  ids: string[],
  action: JobControlAction,
): Promise<{ updated: number; failed: Array<{ id: string; reason: string }> }> {
  const failed: Array<{ id: string; reason: string }> = []
  let updated = 0

  for (const id of ids) {
    try {
      await controlJob(id, action)
      updated += 1
    } catch (error) {
      failed.push({ id, reason: error instanceof Error ? error.message : 'Update failed.' })
    }
  }

  return { updated, failed }
}

/* -------------------------------------------------------------------------- */
/* Review queue (spec §50)                                                    */
/* -------------------------------------------------------------------------- */

export interface ReviewFilter {
  status?: 'all' | 'needs_review' | 'approved' | 'published' | 'blocked'
  noteType?: 'all' | GeneratedNoteRow['note_type']
}

/** A generated note plus the academic hierarchy it belongs to, for display. */
export interface ReviewNoteRow extends GeneratedNoteRow {
  chapters: {
    name: string
    subjects: { name: string; classes: { name: string; boards: { name: string } | null } | null } | null
  } | null
}

/** Human-readable location, e.g. "CBSE · Class 12 · Physics · Electric Charges". */
export function reviewScope(note: ReviewNoteRow): string {
  const parts = [
    note.chapters?.subjects?.classes?.boards?.name ?? null,
    note.chapters?.subjects?.classes?.name ?? null,
    note.chapters?.subjects?.name ?? null,
    note.chapters?.name ?? null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Unknown chapter'
}

export async function listNotesForReview(
  filter: ReviewFilter = {},
  limit = 50,
): Promise<ReviewNoteRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []

  let query = client
    .from('generated_notes')
    .select('*, chapters(name, subjects(name, classes(name, boards(name))))')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (filter.status === 'needs_review') {
    query = query.in('status', ['generated', 'needs_review', 'validation_failed', 'processing'])
  } else if (filter.status && filter.status !== 'all') {
    query = query.eq('status', filter.status)
  }
  if (filter.noteType && filter.noteType !== 'all') query = query.eq('note_type', filter.noteType)

  const { data, error } = await query
  if (error) throw new Error('We could not load the review queue.')
  return (data as unknown as ReviewNoteRow[]) ?? []
}

export interface NoteDetail {
  note: GeneratedNoteRow
  sections: Array<NoteSectionRow & { items: NoteItemRow[] }>
  validation: ContentValidationResultRow | null
  provenance: SourceProvenanceRow[]
}

export async function getNoteDetail(noteId: string): Promise<NoteDetail | null> {
  if (isDemo) return null
  const client = db()
  if (!client) return null

  const note = await one<GeneratedNoteRow>(
    client.from('generated_notes').select('*').eq('id', noteId).maybeSingle(),
  )
  if (!note) return null

  // Sections must load before their items (items are keyed by section id).
  const sectionRows = await rows<NoteSectionRow>(
    client.from('note_sections').select('*').eq('note_id', noteId).order('position'),
  )

  const [itemRows, validations, provenance] = await Promise.all([
    sectionRows.length
      ? rows<NoteItemRow>(
          client
            .from('note_items')
            .select('*')
            .in('section_id', sectionRows.map((section) => section.id))
            .order('position'),
        )
      : Promise.resolve([] as NoteItemRow[]),
    rows<ContentValidationResultRow>(
      client
        .from('content_validation_results')
        .select('*')
        .eq('entity_type', 'note')
        .eq('entity_id', noteId)
        .order('created_at', { ascending: false })
        .limit(1),
    ),
    rows<SourceProvenanceRow>(
      client
        .from('source_provenance')
        .select('*')
        .eq('entity_type', 'note')
        .eq('entity_id', noteId)
        .limit(20),
    ),
  ])

  const itemsBySection = new Map<string, NoteItemRow[]>()
  for (const item of itemRows) {
    const list = itemsBySection.get(item.section_id) ?? []
    list.push(item)
    itemsBySection.set(item.section_id, list)
  }

  return {
    note,
    sections: sectionRows.map((section) => ({
      ...section,
      items: itemsBySection.get(section.id) ?? [],
    })),
    validation: validations[0] ?? null,
    provenance,
  }
}

export type ReviewDecision = 'approve' | 'publish' | 'reject' | 'archive' | 'reprocess'

export async function reviewNote(noteId: string, decision: ReviewDecision, note?: string): Promise<GeneratedNoteRow> {
  if (isDemo) throw new Error('Reviewing content needs a live backend.')
  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  const { data, error } = await client.rpc('ce_review_note', {
    p_note_id: noteId,
    p_decision: decision,
    p_note: note ?? null,
  })
  if (error) throw new Error('We could not apply that decision.')

  await logAdminAction(`engine.note_${decision}`, 'generated_notes', noteId, { decision, note })
  return data as GeneratedNoteRow
}

/** Approve + publish in one step, then hand the result to the RAG pipeline. */
export async function publishNote(noteId: string): Promise<{ note: GeneratedNoteRow; indexed: boolean }> {
  const response = await engine.publishContent({ noteId })
  const note = await getNoteDetail(noteId)
  await logAdminAction('engine.note_published', 'generated_notes', noteId, {})
  return { note: note?.note ?? ({} as GeneratedNoteRow), indexed: Boolean(response.jobId) }
}

/* -------------------------------------------------------------------------- */
/* Syllabus discovery + change review                                         */
/* -------------------------------------------------------------------------- */

export async function listSyllabusChangeSets(
  status: 'all' | 'needs_review' | 'approved' | 'rejected' | 'applied' = 'needs_review',
): Promise<SyllabusChangeSetRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []

  let query = client
    .from('syllabus_change_sets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (status !== 'all') query = query.eq('status', status)

  return rows<SyllabusChangeSetRow>(query)
}

export async function getSyllabusChangeItems(changeSetId: string): Promise<SyllabusChangeItemRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  return rows<SyllabusChangeItemRow>(
    client
      .from('syllabus_change_items')
      .select('*')
      .eq('change_set_id', changeSetId)
      .order('created_at'),
  )
}

export async function decideSyllabusChange(
  changeSetId: string,
  decision: 'approve' | 'reject' | 'apply',
): Promise<void> {
  if (isDemo) throw new Error('Reviewing syllabus changes needs a live backend.')
  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  if (decision === 'apply') {
    const { error } = await client.rpc('ce_apply_syllabus_changes', {
      p_change_set_id: changeSetId,
    })
    if (error) throw new Error('We could not apply those syllabus changes.')
  } else {
    const { error } = await client
      .from('syllabus_change_sets')
      .update({ status: decision === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', changeSetId)
    if (error) throw new Error('We could not save that decision.')
  }

  await logAdminAction(`engine.syllabus_${decision}`, 'syllabus_change_sets', changeSetId, { decision })
}

/* -------------------------------------------------------------------------- */
/* Papers + extracted questions                                               */
/* -------------------------------------------------------------------------- */

export async function listPapers(limit = 50): Promise<PaperMetadataRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  return rows<PaperMetadataRow>(
    client.from('paper_metadata').select('*').order('created_at', { ascending: false }).limit(limit),
  )
}

export async function listExtractedQuestions(
  filter: { needsReview?: boolean; paperId?: string } = {},
  limit = 100,
): Promise<ExtractedQuestionRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []

  let query = client
    .from('extracted_questions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filter.needsReview !== undefined) query = query.eq('needs_review', filter.needsReview)
  if (filter.paperId) query = query.eq('paper_id', filter.paperId)

  return rows<ExtractedQuestionRow>(query)
}

export async function listPyqImportJobs(limit = 25): Promise<PyqImportJobRow[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  return rows<PyqImportJobRow>(
    client.from('pyq_import_jobs').select('*').order('created_at', { ascending: false }).limit(limit),
  )
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export async function getEngineSettings(): Promise<ContentEngineSettingsRow | null> {
  if (isDemo) return null
  const client = db()
  if (!client) return null
  return one<ContentEngineSettingsRow>(
    client.from('content_engine_settings').select('*').eq('id', true).maybeSingle(),
  )
}

export async function updateEngineSettings(
  patch: Partial<ContentEngineSettingsRow>,
): Promise<void> {
  const client = db()
  if (!client) return
  await mutate(client.from('content_engine_settings').update(patch).eq('id', true))
  await logAdminAction('engine.settings_updated', 'content_engine_settings', 'singleton', {
    fields: Object.keys(patch),
  })
}

/* -------------------------------------------------------------------------- */
/* Worker actions (spec §82)                                                  */
/* -------------------------------------------------------------------------- */

/** Run a worker action by name — used by the action buttons on each screen. */
export async function runAction(action: EngineAction, payload: Record<string, unknown> = {}): Promise<EngineResponse> {
  const response = await invokeEngine({ action, ...payload })
  await logAdminAction(`engine.${action}`, 'content_engine', null, payload)
  return response
}

export const engineActions = engine

/* -------------------------------------------------------------------------- */
/* Cached reads                                                               */
/* -------------------------------------------------------------------------- */

/** Dashboard aggregates, memoised so three widgets share one round trip. */
export function cachedStats(): Promise<EngineStats> {
  return memo('admin:engine:stats', () => getEngineStats(), 15_000)
}

export function cachedHealth(): Promise<ContentHealth> {
  return memo('admin:engine:health', () => getContentHealth(), 15_000)
}
