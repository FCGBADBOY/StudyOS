/**
 * content-engine — the autonomous academic content engine's worker API.
 *
 *   GET  → queue + source status (read-only, `engine.view`)
 *   POST → run the worker or a single engine action (`engine.manage`)
 *
 * Why this lives in an edge function rather than the browser:
 *
 *   * the source allow-list, the AI key and the service role are all
 *     server-side — nothing here can be read by a student's devtools;
 *   * `ce_claim_jobs()` is granted only to the service role, so the queue can
 *     only be drained by this process;
 *   * a crawl can take minutes; an edge function can hold that open, an admin
 *     page refresh cannot.
 *
 * Every action re-checks `engine.manage` against the caller's own JWT before
 * doing anything. Students never reach this endpoint with a valid session —
 * and even if they did, they could not write to the queue, because the table
 * has no INSERT/UPDATE policy for `authenticated`.
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import {
  AppError,
  authenticate,
  errorResponse,
  jsonResponse,
  readJson,
  requireStaff,
  toAppError,
  type Caller,
} from '../_shared/http.ts'
import { log } from '../_shared/logging.ts'
import { aiEnv, providerConfigured } from '../_shared/env.ts'
import { createProvider } from '../_shared/ai/providers/index.ts'
import type { AiProvider } from '../_shared/ai/providers/provider.interface.ts'
import { runWorker } from '../_shared/content-engine/queue.ts'
import type { ContentGenerationJobRow, EngineAction } from '../../../src/content-engine/types.ts'

interface Body {
  action?: EngineAction | 'processJobs' | 'runJob'
  /** Worker batch size (1–20). */
  limit?: number
  /** Run one specific job immediately instead of draining the queue. */
  jobId?: string
}

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** `engine.view` for reads, `engine.manage` for anything that changes state. */
async function requirePermission(caller: Caller, permission: 'engine.view' | 'engine.manage'): Promise<void> {
  const { data } = await caller.client.rpc('has_permission', { p_permission: permission })
  if (data !== true) {
    throw new AppError('unauthorized', 'You do not have permission to run the content engine.')
  }
}

async function queueStatus(caller: Caller): Promise<Record<string, unknown>> {
  const counts = await caller.admin.from('content_generation_jobs').select('status')
  const rows = (counts.data ?? []) as Array<{ status: string }>
  const byStatus: Record<string, number> = {}
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1

  const sources = await caller.admin.from('source_registry').select('enabled, source_status')
  const sourceRows = (sources.data ?? []) as Array<{ enabled: boolean; source_status: string }>

  const reviews = await caller.admin
    .from('generated_notes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'needs_review')

  return {
    jobs: {
      total: rows.length,
      byStatus,
      queued: byStatus.queued ?? 0,
      running: byStatus.running ?? 0,
      failed: byStatus.failed ?? 0,
    },
    sources: {
      total: sourceRows.length,
      enabled: sourceRows.filter((row) => row.enabled).length,
      unavailable: sourceRows.filter((row) => row.source_status === 'unavailable').length,
    },
    awaitingReview: reviews.count ?? 0,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Drain the queue. Chapters fail independently: `runWorker` reports every
 * failure it saw, but it never aborts the batch because of one of them.
 */
async function processJobs(caller: Caller, body: Body): Promise<Record<string, unknown>> {
  const env = aiEnv()
  const provider: AiProvider | null = providerConfigured(env) ? createProvider(env) : null

  const summary = await runWorker(
    {
      sb: caller.admin,
      provider,
      workerId: `edge-${crypto.randomUUID().slice(0, 8)}`,
      timeBudgetMs: 240_000,
    },
    Math.max(1, Math.min(20, body.limit ?? 5)),
  )

  log('info', 'content_engine.run', {
    claimed: summary.claimed,
    completed: summary.completed,
    failed: summary.failed,
    partial: summary.partial,
    provider: provider?.name ?? null,
  })

  return { ...summary, provider: provider?.name ?? null, ranAt: new Date().toISOString() }
}

/** Run exactly one job, so "Run now" in the dashboard returns a real result. */
async function runOneJob(caller: Caller, body: Body): Promise<Record<string, unknown>> {
  if (!isUuid(body.jobId)) throw new AppError('invalid_request', 'jobId must be a UUID.')

  const { data, error } = await caller.admin
    .from('content_generation_jobs')
    .select('*')
    .eq('id', body.jobId)
    .maybeSingle()
  if (error) throw new AppError('internal', error.message)
  if (!data) throw new AppError('not_found', 'That job no longer exists.')

  const job = data as ContentGenerationJobRow
  if (job.status !== 'queued' && job.status !== 'failed' && job.status !== 'partial') {
    throw new AppError('invalid_request', 'Only queued, failed or partial jobs can be run on demand.')
  }

  const env = aiEnv()
  const provider: AiProvider | null = providerConfigured(env) ? createProvider(env) : null

  const summary = await runWorker({ sb: caller.admin, provider, workerId: `edge-one-${job.id.slice(0, 8)}` }, 1)
  return { jobId: job.id, provider: provider?.name ?? null, ...summary }
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)

  try {
    const caller = await authenticate(request)
    await requireStaff(caller)

    if (request.method === 'GET') {
      await requirePermission(caller, 'engine.view')
      return jsonResponse(await queueStatus(caller), 200, request)
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: { code: 'invalid_request', message: 'Use GET or POST.' } }, 405, request)
    }

    await requirePermission(caller, 'engine.manage')
    const body = await readJson<Body>(request)

    switch (body.action) {
      case 'runJob':
        return jsonResponse(await runOneJob(caller, body), 200, request)
      case 'processJobs':
      case undefined:
        return jsonResponse(await processJobs(caller, body), 200, request)
      default:
        throw new AppError(
          'invalid_request',
          'This action runs from the dashboard via the database RPCs; the worker only accepts processJobs or runJob.',
        )
    }
  } catch (error) {
    return errorResponse(request, toAppError(error))
  }
})
