/**
 * ai-admin — Admin → AI dashboard API.
 *
 *   GET  → aggregates for the AI dashboard: adoption, latency, retrieval
 *          health, error taxonomy, quota pressure, embedding pipeline state.
 *   POST → queue operations: retry failed embedding jobs, rebuild the vector
 *          index for a resource / chapter / the whole corpus.
 *
 * Staff only (`public.is_admin_user()`), enforced after JWT verification.
 * Inputs are validated enums + UUIDs — the client can never send SQL, and
 * aggregates never expose message content (ai_messages stays owner-only).
 *
 * The actual chunk/embedding work runs in `ai-embeddings` (the worker), so a
 * slow index rebuild can never hold this request open.
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import { AppError, authenticate, errorResponse, jsonResponse, readJson, requireStaff, toAppError } from '../_shared/http.ts'
import { aiEnv, providerConfigured } from '../_shared/env.ts'
import { log } from '../_shared/logging.ts'
import { serviceAdmin } from '../_shared/service.ts'

interface AdminBody {
  action?: 'analytics' | 'retry_failed' | 'rebuild' | 'enqueue'
  scope?: 'resource' | 'chapter' | 'rebuild_all'
  resourceId?: string
  chapterId?: string
}

const SCOPES = ['resource', 'chapter', 'rebuild_all'] as const
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/**
 * Rough USD per 1M tokens, used ONLY for an order-of-magnitude admin figure.
 * Published list prices; update when the model changes. Never billed.
 */
const PRICE_TABLE: Array<{ match: RegExp; input: number; output: number }> = [
  { match: /gpt-4o-mini/i, input: 0.15, output: 0.6 },
  { match: /gpt-4o/i, input: 2.5, output: 10 },
  { match: /gpt-4\.1/i, input: 2, output: 8 },
  { match: /o[34]-mini/i, input: 1.1, output: 4.4 },
  { match: /gemini.*flash/i, input: 0.1, output: 0.4 },
  { match: /gemini.*pro/i, input: 1.25, output: 5 },
  { match: /claude.*haiku/i, input: 0.8, output: 4 },
  { match: /claude/i, input: 3, output: 15 },
]

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICE_TABLE.find((entry) => entry.match.test(model))
  if (!price) return 0
  return Number(((inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output).toFixed(4))
}

interface UsageRow {
  feature: string
  requests: number
  input_tokens: number
  output_tokens: number
}

interface EventRow {
  feature: string
  question_type: string | null
  response_latency_ms: number | null
  retrieval_used: boolean
  source_count: number
  no_source: boolean
  provider: string | null
  model: string | null
  status: string
  error_code: string | null
  created_at: string
}

async function buildAnalytics(): Promise<Record<string, unknown>> {
  const sb = serviceAdmin()
  const env = aiEnv()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [usage, events, jobCounts, failures, chunkCount, conversationCount, messageCount] = await Promise.all([
    sb.from('ai_usage').select('feature, requests, input_tokens, output_tokens').gte('created_at', since),
    sb
      .from('ai_events')
      .select('feature, question_type, response_latency_ms, retrieval_used, source_count, no_source, provider, model, status, error_code, created_at')
      .gte('created_at', since)
      .limit(5000),
    sb.from('embedding_jobs').select('status'),
    sb
      .from('embedding_jobs')
      .select('id, scope, resource_id, chapter_id, attempts, max_attempts, last_error, updated_at')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(25),
    sb.from('document_chunks').select('id', { count: 'exact', head: true }),
    sb.from('ai_conversations').select('id', { count: 'exact', head: true }),
    sb.from('ai_messages').select('id', { count: 'exact', head: true }),
  ])

  const usageRows = (usage.data ?? []) as UsageRow[]
  const eventRows = (events.data ?? []) as EventRow[]
  const statusRows = (jobCounts.data ?? []) as Array<{ status: string }>

  /* --- usage by feature (requests, tokens, estimated cost) --- */
  const byFeature = new Map<string, { requests: number; inputTokens: number; outputTokens: number }>()
  let totalRequests = 0
  let totalInput = 0
  let totalOutput = 0
  for (const row of usageRows) {
    const entry = byFeature.get(row.feature) ?? { requests: 0, inputTokens: 0, outputTokens: 0 }
    entry.requests += row.requests ?? 0
    entry.inputTokens += row.input_tokens ?? 0
    entry.outputTokens += row.output_tokens ?? 0
    byFeature.set(row.feature, entry)
    totalRequests += row.requests ?? 0
    totalInput += row.input_tokens ?? 0
    totalOutput += row.output_tokens ?? 0
  }

  /* --- latency + retrieval health + failures --- */
  const latencies: number[] = []
  const byStatus = new Map<string, number>()
  const byQuestionType = new Map<string, number>()
  const byErrorCode = new Map<string, number>()
  const providers = new Map<string, number>()
  let eventsSeen = 0
  let retrievalUsed = 0
  let grounded = 0
  let ungrounded = 0
  let sourceTotal = 0

  for (const row of eventRows) {
    eventsSeen += 1
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1)
    if (row.question_type) byQuestionType.set(row.question_type, (byQuestionType.get(row.question_type) ?? 0) + 1)
    if (row.error_code) byErrorCode.set(row.error_code, (byErrorCode.get(row.error_code) ?? 0) + 1)
    if (row.provider) providers.set(`${row.provider}:${row.model ?? '?'}`, (providers.get(`${row.provider}:${row.model ?? '?'}`) ?? 0) + 1)
    if (typeof row.response_latency_ms === 'number') latencies.push(row.response_latency_ms)
    if (row.retrieval_used) retrievalUsed += 1
    if (row.source_count > 0) grounded += 1
    if (row.no_source) ungrounded += 1
    sourceTotal += row.source_count ?? 0
  }

  latencies.sort((a, b) => a - b)
  const percentile = (p: number): number =>
    latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] : 0

  /* --- embedding pipeline --- */
  const jobStatus = { pending: 0, processing: 0, completed: 0, failed: 0 }
  for (const row of statusRows) {
    if (row.status in jobStatus) jobStatus[row.status as keyof typeof jobStatus] += 1
  }

  return {
    window: '30d',
    generatedAt: new Date().toISOString(),
    usage: {
      totalRequests,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      estimatedCostUsd: estimateCost(env.model, totalInput, totalOutput),
      byFeature: Object.fromEntries(byFeature),
    },
    reliability: {
      events: eventsSeen,
      byStatus: Object.fromEntries(byStatus),
      errorsByCode: Object.fromEntries([...byErrorCode.entries()].sort((a, b) => b[1] - a[1])),
      providers: Object.fromEntries(providers),
      latencyMs: {
        p50: percentile(0.5),
        p95: percentile(0.95),
        max: latencies.length ? latencies[latencies.length - 1] : 0,
      },
    },
    retrieval: {
      used: retrievalUsed,
      groundedAnswers: grounded,
      ungroundedAnswers: ungrounded,
      averageSources: eventsSeen ? Number((sourceTotal / eventsSeen).toFixed(2)) : 0,
      chunksIndexed: chunkCount.count ?? 0,
      support: {
        embeddingModel: env.embeddingModel,
        embeddingDim: env.embeddingDim,
        configured: providerConfigured(env),
        toolPlanning: env.toolPlanning,
        topK: env.topK,
      },
    },
    questions: {
      byType: Object.fromEntries([...byQuestionType.entries()].sort((a, b) => b[1] - a[1])),
    },
    conversations: {
      threads: conversationCount.count ?? 0,
      messages: messageCount.count ?? 0,
    },
    embeddings: {
      jobs: jobStatus,
      failures: failures.data ?? [],
    },
    limits: {
      dailyRequestsPerUser: env.dailyLimit,
      dailyRequestsPerFeature: env.featureDailyLimit,
      requestTimeoutMs: env.requestTimeoutMs,
      maxOutputTokens: env.maxOutputTokens,
    },
  }
}

/** Requeue failed embedding jobs (optionally only one target). */
async function retryFailed(body: AdminBody): Promise<Record<string, unknown>> {
  const sb = serviceAdmin()
  if (body.scope === 'resource' && !isUuid(body.resourceId)) {
    throw new AppError('invalid_request', 'resourceId must be a UUID.')
  }
  if (body.scope === 'chapter' && !isUuid(body.chapterId)) {
    throw new AppError('invalid_request', 'chapterId must be a UUID.')
  }

  let query = sb.from('embedding_jobs').update({ status: 'pending', attempts: 0, last_error: null, completed_at: null }).eq('status', 'failed')
  if (body.scope === 'resource') query = query.eq('resource_id', body.resourceId as string)
  if (body.scope === 'chapter') query = query.eq('chapter_id', body.chapterId as string)
  if (body.scope === 'rebuild_all') query = query.eq('scope', 'rebuild_all')

  const { data, error } = await query.select('id')
  if (error) throw new AppError('internal', error.message)
  log('info', 'ai.admin_retry_failed', { count: data?.length ?? 0, scope: body.scope ?? null })
  return { requeued: data?.length ?? 0 }
}

/**
 * Rebuild: drop the stored chunks for the target and enqueue fresh jobs.
 * The heavy lifting happens in `ai-embeddings` (run it from the panel or a
 * scheduled invocation).
 */
async function rebuild(body: AdminBody): Promise<Record<string, unknown>> {
  const sb = serviceAdmin()
  const scope = body.scope ?? (isUuid(body.chapterId) && !isUuid(body.resourceId) ? 'chapter' : 'resource')
  if (!SCOPES.includes(scope)) throw new AppError('invalid_request', 'scope must be resource | chapter | rebuild_all.')
  if (scope === 'resource' && !isUuid(body.resourceId)) throw new AppError('invalid_request', 'resourceId must be a UUID.')
  if (scope === 'chapter' && !isUuid(body.chapterId)) throw new AppError('invalid_request', 'chapterId must be a UUID.')

  if (scope === 'rebuild_all') {
    await sb.from('document_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await sb.from('embedding_jobs').delete().eq('status', 'pending')
    const { data: resources } = await sb.from('resources').select('id, chapter_id').eq('is_published', true).limit(2000)
    const { data: chapters } = await sb.from('chapters').select('id').limit(1000)
    const rows = [
      ...(resources ?? []).map((row) => ({ scope: 'resource', resource_id: row.id, chapter_id: row.chapter_id, status: 'pending', attempts: 0 })),
      ...(chapters ?? []).map((row) => ({ scope: 'chapter', resource_id: null, chapter_id: row.id, status: 'pending', attempts: 0 })),
    ]
    if (rows.length) {
      const { error } = await sb.from('embedding_jobs').insert(rows)
      if (error) throw new AppError('internal', error.message)
    }
    log('info', 'ai.admin_rebuild_all', { jobs: rows.length })
    return { cleared: true, enqueued: rows.length, scope }
  }

  if (scope === 'resource') {
    await sb.from('document_chunks').delete().eq('resource_id', body.resourceId as string)
    await sb.from('embedding_jobs').delete().eq('resource_id', body.resourceId as string).eq('status', 'pending')
    const { error } = await sb.from('embedding_jobs').insert({
      scope: 'resource',
      resource_id: body.resourceId,
      chapter_id: null,
      status: 'pending',
      attempts: 0,
    })
    if (error) throw new AppError('internal', error.message)
    log('info', 'ai.admin_rebuild_resource', { resourceId: body.resourceId })
    return { cleared: true, enqueued: 1, scope }
  }

  await sb.from('document_chunks').delete().is('resource_id', null).eq('chapter_id', body.chapterId as string)
  await sb.from('embedding_jobs').delete().eq('chapter_id', body.chapterId as string).eq('status', 'pending')
  const { error } = await sb.from('embedding_jobs').insert({
    scope: 'chapter',
    resource_id: null,
    chapter_id: body.chapterId,
    status: 'pending',
    attempts: 0,
  })
  if (error) throw new AppError('internal', error.message)
  log('info', 'ai.admin_rebuild_chapter', { chapterId: body.chapterId })
  return { cleared: true, enqueued: 1, scope }
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)

  try {
    const caller = await authenticate(request)
    await requireStaff(caller)

    if (request.method === 'GET') {
      return jsonResponse(await buildAnalytics(), 200, request)
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: { code: 'invalid_request', message: 'Use GET or POST.' } }, 405, request)
    }

    const body = await readJson<AdminBody>(request)
    switch (body.action) {
      case 'retry_failed':
        return jsonResponse(await retryFailed(body), 200, request)
      case 'rebuild':
        return jsonResponse(await rebuild(body), 200, request)
      case 'enqueue':
        return jsonResponse(await rebuild({ ...body, scope: body.scope ?? 'resource' }), 200, request)
      case 'analytics':
      case undefined:
        return jsonResponse(await buildAnalytics(), 200, request)
      default:
        throw new AppError('invalid_request', 'action must be analytics | retry_failed | rebuild | enqueue.')
    }
  } catch (error) {
    return errorResponse(request, toAppError(error))
  }
})
