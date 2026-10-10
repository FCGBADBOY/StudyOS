/**
 * ai-embeddings — the RAG indexing worker.
 *
 * Reads queued `embedding_jobs` (scope: resource | chapter | rebuild_all),
 * turns the academic text into logical chunks, embeds them with the
 * configured provider and writes `document_chunks` rows. Stale chunks for the
 * same target are removed first, so a rebuild never leaves a mixed index.
 *
 *   POST { "action": "run",    "limit": 4 }            → process the queue
 *   POST { "action": "enqueue", "scope": "resource",
 *          "resourceId": "…", "chapterId": "…", "rebuild": true }
 *   POST { "action": "status" }                        → queue summary
 *
 * Staff only (`public.is_admin_user()`): embedding work is metered, so it is
 * never triggered by an anonymous browser. Deployments drive it from the
 * Admin → Embeddings panel or a scheduled invocation:
 *
 *   supabase functions invoke ai-embeddings --body '{"action":"run"}'
 *
 * Safety rules enforced here:
 *   * the vector dimension is checked against public.studyos_embedding_dim()
 *     — we never write a vector the index cannot use;
 *   * only published resources are indexed (the search RPC is `security
 *     invoker`, so drafts stay invisible even if a row slipped through);
 *   * every job is bounded: attempts ≤ max_attempts, ≤ 20 jobs per run.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { isPreflight, preflight } from '../_shared/cors.ts'
import { AppError, authenticate, errorResponse, jsonResponse, readJson, requireStaff, toAppError } from '../_shared/http.ts'
import { aiEnv, providerConfigured } from '../_shared/env.ts'
import { log, logEmbeddingJob } from '../_shared/logging.ts'
import { serviceAdmin } from '../_shared/service.ts'
import { chunkDocument, type Chunk } from '../_shared/ai/retrieval/chunk.ts'
import { embedBatch } from '../_shared/ai/retrieval/embed.ts'
import { createEmbeddingProvider } from '../_shared/ai/providers/index.ts'

interface RunBody {
  action?: 'run' | 'enqueue' | 'status'
  limit?: number
  scope?: 'resource' | 'chapter' | 'rebuild_all'
  resourceId?: string
  chapterId?: string
  /** Enqueue *and* drop the existing chunks for the target (rebuild semantics). */
  rebuild?: boolean
}

interface JobRow {
  id: string
  scope: 'resource' | 'chapter' | 'rebuild_all'
  resource_id: string | null
  chapter_id: string | null
  status: string
  attempts: number
  max_attempts: number
}

interface SourceDocument {
  text: string
  sourceType: string | null
  resourceType: string | null
  title: string
  ids: {
    resource_id: string | null
    chapter_id: string | null
    subject_id: string | null
    board_id: string | null
    class_id: string | null
  }
  published: boolean
}

/** Service-role client (memoised) — embedding jobs are never RLS-shaped. */
const serviceClient = (): SupabaseClient => serviceAdmin()

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.json', '.tex']

/** Best-effort plain text for a stored file (PDFs/binaries fall back to metadata). */
async function readStorageText(sb: SupabaseClient, path: string | null): Promise<string> {
  if (!path) return ''
  const lower = path.toLowerCase()
  if (!TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension))) return ''
  try {
    const { data, error } = await sb.storage.from('resources').download(path)
    if (error || !data) return ''
    if (data.size > 512 * 1024) return '' // 512 KB cap — worker must stay fast
    return await data.text()
  } catch {
    return ''
  }
}

/** Load everything a job needs: academic text + the ids for the chunk rows. */
async function loadSource(sb: SupabaseClient, job: JobRow): Promise<SourceDocument | null> {
  if (job.scope === 'resource' && job.resource_id) {
    const { data, error } = await sb
      .from('resources')
      .select(
        `id, title, description, resource_type, file_path, is_published, chapter_id,
         chapters:chapter_id (
           id, name, description, topics, subject_id,
           subjects:subject_id ( id, name, board_id, class_id )
         )`,
      )
      .eq('id', job.resource_id)
      .maybeSingle()
    if (error) throw new AppError('internal', error.message)
    if (!data) return null

    const row = data as unknown as {
      id: string
      title: string
      description: string | null
      resource_type: string
      file_path: string | null
      is_published: boolean
      chapter_id: string
      chapters: {
        id: string
        name: string
        description: string | null
        topics: string[] | null
        subject_id: string
        subjects: { id: string; name: string; board_id: string | null; class_id: string | null } | null
      } | null
    }

    const chapter = row.chapters
    const subject = chapter?.subjects ?? null
    const fileText = await readStorageText(sb, row.file_path)
    const parts = [
      `# ${row.title}`,
      row.description ?? '',
      fileText ? `${fileText}` : '',
      chapter ? `Chapter: ${chapter.name}` : '',
      chapter?.description ?? '',
      chapter?.topics?.length ? `Topics: ${chapter.topics.join(', ')}` : '',
    ].filter((part): part is string => Boolean(part && part.trim()))

    return {
      text: parts.join('\n\n'),
      sourceType: row.resource_type,
      resourceType: row.resource_type,
      title: row.title,
      ids: {
        resource_id: row.id,
        chapter_id: chapter?.id ?? row.chapter_id,
        subject_id: subject?.id ?? null,
        board_id: subject?.board_id ?? null,
        class_id: subject?.class_id ?? null,
      },
      published: row.is_published,
    }
  }

  if (job.chapter_id) {
    const { data, error } = await sb
      .from('chapters')
      .select(
        `id, name, description, topics, subject_id,
         subjects:subject_id ( id, name, board_id, class_id )`,
      )
      .eq('id', job.chapter_id)
      .maybeSingle()
    if (error) throw new AppError('internal', error.message)
    if (!data) return null

    const row = data as unknown as {
      id: string
      name: string
      description: string | null
      topics: string[] | null
      subject_id: string
      subjects: { id: string; name: string; board_id: string | null; class_id: string | null } | null
    }

    /* Chapter scope: the chapter's own copy plus its published resources. */
    const { data: resources } = await sb
      .from('resources')
      .select('id, title, description, resource_type, file_path')
      .eq('chapter_id', row.id)
      .eq('is_published', true)
      .limit(50)

    const resourceText = await Promise.all(
      (resources ?? []).map(async (resource) => {
        const typed = resource as { title: string; description: string | null; file_path: string | null }
        const fileText = await readStorageText(sb, typed.file_path)
        return [typed.title, typed.description ?? '', fileText].filter(Boolean).join('\n')
      }),
    )

    const parts = [
      `# ${row.name}`,
      row.description ?? '',
      row.topics?.length ? `Topics: ${row.topics.join(', ')}` : '',
      ...resourceText,
    ].filter((part): part is string => Boolean(part && part.trim()))

    return {
      text: parts.join('\n\n'),
      sourceType: 'chapter',
      resourceType: null,
      title: row.name,
      ids: {
        resource_id: null,
        chapter_id: row.id,
        subject_id: row.subject_id,
        board_id: row.subjects?.board_id ?? null,
        class_id: row.subjects?.class_id ?? null,
      },
      published: true,
    }
  }

  return null
}

/** The database's expected vector dimension (document_chunks.embedding). */
async function dbDimension(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.rpc('studyos_embedding_dim')
  if (error || typeof data !== 'number') {
    throw new AppError('internal', 'Could not read the configured embedding dimension.')
  }
  return data
}

/** Delete every stored chunk for this job's target (rebuild semantics). */
async function clearTarget(sb: SupabaseClient, job: JobRow): Promise<void> {
  if (job.scope === 'resource' && job.resource_id) {
    await sb.from('document_chunks').delete().eq('resource_id', job.resource_id)
    return
  }
  if (job.chapter_id) {
    await sb.from('document_chunks').delete().is('resource_id', null).eq('chapter_id', job.chapter_id)
  }
}

interface ProcessOutcome {
  chunks: number
  skipped: boolean
  reason?: string
}

/** One job: load → chunk → embed → store. Throws on anything worth retrying. */
async function processJob(sb: SupabaseClient, job: JobRow, envDimension: number): Promise<ProcessOutcome> {
  const env = aiEnv()
  const source = await loadSource(sb, job)

  if (!source) {
    await sb.from('embedding_jobs').update({ status: 'completed', chunks_total: 0, chunks_done: 0, last_error: null }).eq('id', job.id)
    return { chunks: 0, skipped: true, reason: 'source_missing' }
  }

  if (job.scope === 'resource' && !source.published) {
    /* Drafts are not indexed — clear anything a previous publish left behind. */
    await clearTarget(sb, job)
    await sb.from('embedding_jobs').update({ status: 'completed', chunks_total: 0, chunks_done: 0, last_error: null }).eq('id', job.id)
    return { chunks: 0, skipped: true, reason: 'not_published' }
  }

  const chunks: Chunk[] = chunkDocument(source.text, {
    metadata: {
      resource: source.title,
      resourceType: source.resourceType,
      subject: null,
      chapter: null,
    },
  })

  if (!chunks.length) {
    await clearTarget(sb, job)
    await sb.from('embedding_jobs').update({ status: 'completed', chunks_total: 0, chunks_done: 0, last_error: null }).eq('id', job.id)
    return { chunks: 0, skipped: true, reason: 'no_content' }
  }

  /* Dimension guard: configured model ↔ database must agree, or the ANN index
     would silently miss every row. */
  if (env.embeddingDim !== envDimension) {
    throw new AppError(
      'internal',
      `AI_EMBEDDING_DIM (${env.embeddingDim}) does not match public.studyos_embedding_dim() (${envDimension}). Fix the server env (see .env.example) — refusing to write mismatched vectors.`,
    )
  }

  const provider = createEmbeddingProvider(env)
  if (!providerConfigured(env) || !provider) {
    throw new AppError('no_provider', 'No embedding provider is configured on this server.')
  }

  await sb.from('embedding_jobs').update({ chunks_total: chunks.length, chunks_done: 0 }).eq('id', job.id)

  const vectors = await embedBatch(
    provider,
    chunks.map((chunk) => chunk.content),
    { batchSize: 8, maxRetries: 2 },
  )

  const usable = chunks.filter((_, index) => {
    const vector = vectors[index]
    if (!vector) return false
    if (vector.length !== envDimension) {
      throw new AppError('internal', `Embedding provider returned ${vector.length} dimensions, expected ${envDimension}.`)
    }
    return true
  })
  const usableVectors = vectors.filter((vector): vector is number[] => Boolean(vector) && vector.length === envDimension)

  await clearTarget(sb, job)

  if (usable.length) {
    const rows = usable.map((chunk, index) => ({
      resource_id: source.ids.resource_id,
      chapter_id: source.ids.chapter_id,
      subject_id: source.ids.subject_id,
      board_id: source.ids.board_id,
      class_id: source.ids.class_id,
      content: chunk.content.slice(0, 8000),
      chunk_index: chunk.chunkIndex,
      token_count: chunk.tokenCount,
      section_title: chunk.sectionTitle,
      content_kind: chunk.contentKind,
      source_type: source.sourceType,
      embedding: usableVectors[index],
      metadata: { ...chunk.metadata, title: source.title, indexed_at: new Date().toISOString() },
    }))

    const { error } = await sb.from('document_chunks').insert(rows)
    if (error) throw new AppError('internal', error.message)
  }

  await sb.from('embedding_jobs').update({
    status: 'completed',
    chunks_total: chunks.length,
    chunks_done: usable.length,
    last_error: null,
    completed_at: new Date().toISOString(),
  }).eq('id', job.id)

  logEmbeddingJob({ jobId: job.id, status: 'completed', chunks: usable.length, scope: job.scope })
  return { chunks: usable.length, skipped: false }
}

/** Claim up to `limit` pending jobs (one worker at a time per row). */
async function claimJobs(sb: SupabaseClient, limit: number): Promise<JobRow[]> {
  const { data, error } = await sb
    .from('embedding_jobs')
    .select('id, scope, resource_id, chapter_id, status, attempts, max_attempts')
    .eq('status', 'pending')
    .lt('attempts', 100)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new AppError('internal', error.message)

  const claimed: JobRow[] = []
  for (const raw of (data ?? []) as JobRow[]) {
    const { data: row } = await sb
      .from('embedding_jobs')
      .update({ status: 'processing', attempts: raw.attempts + 1, updated_at: new Date().toISOString() })
      .eq('id', raw.id)
      .eq('status', 'pending')
      .select('id, scope, resource_id, chapter_id, attempts, max_attempts')
      .maybeSingle()
    if (row) claimed.push(row as JobRow)
  }
  return claimed
}

async function runQueue(sb: SupabaseClient, limit: number): Promise<Record<string, unknown>> {
  const env = aiEnv()
  if (!providerConfigured(env)) {
    throw new AppError('no_provider', 'Configure an embedding provider first (AI_PROVIDER + API key).')
  }

  const dimension = await dbDimension(sb)
  const jobs = await claimJobs(sb, limit)

  let completed = 0
  let failed = 0
  let skipped = 0
  let chunksWritten = 0

  for (const job of jobs) {
    try {
      const outcome = await processJob(sb, job, dimension)
      chunksWritten += outcome.chunks
      if (outcome.skipped) skipped += 1
      else completed += 1
    } catch (error) {
      const appError = toAppError(error)
      const attempts = job.attempts
      const exhausted = attempts >= job.max_attempts
      await sb.from('embedding_jobs').update({
        status: exhausted ? 'failed' : 'pending',
        last_error: appError.message.slice(0, 500),
        completed_at: exhausted ? new Date().toISOString() : null,
      }).eq('id', job.id)
      failed += 1
      logEmbeddingJob({ jobId: job.id, status: exhausted ? 'failed' : 'pending', attempts, error: appError.message })
      log('warn', 'embedding.job_failed', { jobId: job.id, attempts, exhausted })
    }
  }

  const { count: pending } = await sb.from('embedding_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending')

  return { completed, failed, skipped, chunksWritten, pending: pending ?? 0, dimension }
}

async function enqueue(
  sb: SupabaseClient,
  body: RunBody,
): Promise<Record<string, unknown>> {
  const scope = body.scope ?? (body.chapterId && !body.resourceId ? 'chapter' : 'resource')
  if (scope !== 'resource' && scope !== 'chapter' && scope !== 'rebuild_all') {
    throw new AppError('invalid_request', 'scope must be resource | chapter | rebuild_all.')
  }
  if (scope === 'resource' && !isUuid(body.resourceId)) {
    throw new AppError('invalid_request', 'resourceId must be a UUID.')
  }
  if (scope === 'chapter' && !isUuid(body.chapterId)) {
    throw new AppError('invalid_request', 'chapterId must be a UUID.')
  }

  /* rebuild_all: one job per published resource + one per chapter, capped. */
  if (scope === 'rebuild_all') {
    const { data: resources } = await sb.from('resources').select('id, chapter_id').eq('is_published', true).limit(2000)
    const { data: chapters } = await sb.from('chapters').select('id').limit(1000)
    const rows = [
      ...(resources ?? []).map((row) => ({ scope: 'resource', resource_id: row.id, chapter_id: row.chapter_id })),
      ...(chapters ?? []).map((row) => ({ scope: 'chapter', resource_id: null, chapter_id: row.id })),
    ].map((row) => ({ ...row, status: 'pending', attempts: 0, last_error: null }))

    if (body.rebuild !== false) {
      await sb.from('document_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      /* Drop queued duplicates so a double click cannot process a target twice. */
      await sb.from('embedding_jobs').delete().eq('status', 'pending')
    }
    const { error } = await sb.from('embedding_jobs').insert(rows)
    if (error) throw new AppError('internal', error.message)
    log('info', 'embedding.enqueue_all', { jobs: rows.length })
    return { enqueued: rows.length, scope }
  }

  const row = {
    scope,
    resource_id: scope === 'resource' ? body.resourceId : null,
    chapter_id: isUuid(body.chapterId) ? body.chapterId : null,
    status: 'pending',
    attempts: 0,
    last_error: null,
    completed_at: null,
    chunks_done: 0,
  }

  if (body.rebuild) {
    if (scope === 'resource') await sb.from('document_chunks').delete().eq('resource_id', body.resourceId as string)
    else await sb.from('document_chunks').delete().is('resource_id', null).eq('chapter_id', row.chapter_id as string)
  }

  /* No unique constraint targets (scope, target) — requeue explicitly. */
  let existing = sb.from('embedding_jobs').select('id').eq('scope', scope)
  existing = scope === 'resource' ? existing.eq('resource_id', body.resourceId as string) : existing.eq('chapter_id', row.chapter_id as string)
  const { data: matches } = await existing.limit(1)

  if (matches?.length) {
    const { error } = await sb.from('embedding_jobs').update(row).eq('id', (matches[0] as { id: string }).id)
    if (error) throw new AppError('internal', error.message)
  } else {
    const { error } = await sb.from('embedding_jobs').insert(row)
    if (error) throw new AppError('internal', error.message)
  }
  log('info', 'embedding.enqueue', { scope, resourceId: body.resourceId ?? null, chapterId: body.chapterId ?? null })
  return { enqueued: 1, scope }
}

async function queueStatus(sb: SupabaseClient): Promise<Record<string, unknown>> {
  const [pending, processing, completed, failed, chunks] = await Promise.all([
    sb.from('embedding_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('embedding_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
    sb.from('embedding_jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    sb.from('embedding_jobs').select('id, last_error, scope, resource_id, chapter_id, attempts, updated_at', { count: 'exact', head: false }).eq('status', 'failed').order('updated_at', { ascending: false }).limit(20),
    sb.from('document_chunks').select('id', { count: 'exact', head: true }),
  ])

  const recentJobs = await sb
    .from('embedding_jobs')
    .select('id, scope, status, attempts, max_attempts, chunks_total, chunks_done, resource_id, chapter_id, created_at, updated_at, completed_at, last_error')
    .order('updated_at', { ascending: false })
    .limit(25)

  return {
    queue: {
      pending: pending.count ?? 0,
      processing: processing.count ?? 0,
      completed: completed.count ?? 0,
      failed: failed.count ?? 0,
    },
    chunks: chunks.count ?? 0,
    failures: failed.data ?? [],
    jobs: recentJobs.data ?? [],
    provider: aiEnv().provider,
    embeddingModel: aiEnv().embeddingModel,
    configured: providerConfigured(aiEnv()),
    expectedDimension: await dbDimension(sb),
  }
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Use POST.' } }, 405, request)
  }

  try {
    const caller = await authenticate(request)
    await requireStaff(caller) // embedding work is staff-only

    const body = await readJson<RunBody>(request)
    const action = body.action ?? (body.scope || body.resourceId || body.chapterId ? 'enqueue' : 'run')
    const sb = serviceClient()

    if (action === 'run') {
      const limit = Math.min(Math.max(Number(body.limit ?? 6) || 6, 1), 20)
      return jsonResponse(await runQueue(sb, limit), 200, request)
    }
    if (action === 'enqueue') {
      return jsonResponse(await enqueue(sb, body), 200, request)
    }
    if (action === 'status') {
      return jsonResponse(await queueStatus(sb), 200, request)
    }
    throw new AppError('invalid_request', 'action must be run | enqueue | status.')
  } catch (error) {
    return errorResponse(request, error)
  }
})
