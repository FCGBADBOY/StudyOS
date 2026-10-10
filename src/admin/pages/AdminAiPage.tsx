/**
 * Admin → AI: adoption, reliability, retrieval health and the embedding
 * pipeline (Retry failed / Rebuild resource, chapter or all / Run queue).
 *
 * Everything is server-computed by the `ai-admin` and `ai-embeddings` edge
 * functions, which re-check `public.is_admin_user()` — the browser never sees
 * message content, provider keys or a service-role client.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  DatabaseZap,
  Gauge,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Timer,
  Wrench,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  PageHeader,
  SectionHeader,
  StatCard,
} from '@/components/ui'
import {
  friendlyAiError,
  getAiAnalytics,
  getEmbeddingStatus,
  rebuildIndex,
  retryFailedJobs,
  runEmbeddingQueue,
  type AiAnalytics,
  type EmbeddingStatus,
} from '@/ai/services/ai.service'
import { db, isDemo } from '@/services/shared'
import { cn } from '@/utils/cn'

type Access = 'checking' | 'allowed' | 'denied' | 'demo'

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <StatCard
      label={label}
      value={typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      trend={hint}
    />
  )
}

export default function AdminAiPage() {
  const [access, setAccess] = useState<Access>(isDemo ? 'demo' : 'checking')
  const [analytics, setAnalytics] = useState<AiAnalytics | null>(null)
  const [embeddings, setEmbeddings] = useState<EmbeddingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  /* Staff gate — the edge functions check it again, this is just the UX. */
  useEffect(() => {
    if (isDemo) return
    let cancelled = false
    void (async () => {
      const client = db()
      if (!client) return
      const { data } = await client.rpc('is_admin_user')
      if (!cancelled) setAccess(data === true ? 'allowed' : 'denied')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    if (access !== 'allowed') return
    setLoading(true)
    setError(null)
    try {
      const [stats, pipeline] = await Promise.all([getAiAnalytics(), getEmbeddingStatus()])
      setAnalytics(stats)
      setEmbeddings(pipeline)
    } catch (caught) {
      setError(friendlyAiError(caught))
    } finally {
      setLoading(false)
    }
  }, [access])

  useEffect(() => {
    if (access === 'allowed') void load()
  }, [access, load])

  const act = async (key: string, run: () => Promise<unknown>, done: string) => {
    setBusy(key)
    try {
      await run()
      await load()
    } catch (caught) {
      setError(friendlyAiError(caught))
    } finally {
      setBusy(null)
      void done
    }
  }

  if (access === 'checking') return <LoadingState label="Checking your access" />

  if (access === 'demo') {
    return (
      <EmptyState
        title="Demo mode"
        description="The AI admin dashboard needs a connected Supabase backend — run with VITE_SUPABASE_URL set and a staff account."
      />
    )
  }

  if (access === 'denied') {
    return (
      <EmptyState
        title="Staff only"
        description="This area is for StudyOS administrators (public.is_admin_user())."
      />
    )
  }

  if (loading && !analytics) return <LoadingState label="Loading AI telemetry" />

  if (error && !analytics) return <ErrorState title="Could not load AI analytics" description={error} onRetry={() => void load()} />

  const reliability = analytics?.reliability
  const retrieval = analytics?.retrieval
  const usage = analytics?.usage
  const queue = embeddings?.queue

  return (
    <div className="space-y-7 sm:space-y-9">
      <PageHeader
        title="AI dashboard"
        subtitle="Adoption, latency, grounding rate and the embedding pipeline — aggregates only, never message content."
        actions={
          <IconButton label="Refresh" size="lg" variant="soft" onClick={() => void load()}>
            <RefreshCw className={cn(busy && 'animate-spin')} />
          </IconButton>
        }
      />

      {error && <ErrorState compact title="Last refresh failed" description={error} onRetry={() => void load()} />}

      {/* ------------------------------ adoption ------------------------------ */}
      <section aria-labelledby="ai-adoption">
        <SectionHeader id="ai-adoption" title="Adoption & cost" subtitle={`Last ${analytics?.window ?? '30d'}`} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="AI requests" value={usage?.totalRequests ?? 0} hint="server-enforced limits" />
          <Stat label="Input tokens" value={usage?.totalInputTokens ?? 0} />
          <Stat label="Output tokens" value={usage?.totalOutputTokens ?? 0} />
          <Stat label="Est. cost" value={`$${(usage?.estimatedCostUsd ?? 0).toFixed(3)}`} hint="list price estimate" />
        </div>

        {usage && Object.keys(usage.byFeature).length > 0 && (
          <Card padded className="mt-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">By feature</p>
            <ul role="list" className="mt-2 space-y-1.5">
              {Object.entries(usage.byFeature).map(([feature, entry]) => (
                <li key={feature} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <Wrench aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate text-foreground">{feature}</span>
                  </span>
                  <span className="tabular shrink-0 text-muted">
                    {entry.requests} req · {(entry.inputTokens + entry.outputTokens).toLocaleString('en-IN')} tokens
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ----------------------------- reliability ---------------------------- */}
      <section aria-labelledby="ai-reliability">
        <SectionHeader id="ai-reliability" title="Reliability" subtitle="Latency, statuses and error taxonomy" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <Timer aria-hidden className="h-3.5 w-3.5" /> p50 latency
            </span>
            <p className="tabular mt-1 text-xl font-bold text-foreground">{reliability?.latencyMs.p50 ?? 0} ms</p>
            <p className="tabular text-[12px] text-faint">p95 {reliability?.latencyMs.p95 ?? 0} ms</p>
          </div>
          <Stat label="Events" value={reliability?.events ?? 0} />
          <Stat label="Grounded answers" value={retrieval?.groundedAnswers ?? 0} hint={`${retrieval?.ungroundedAnswers ?? 0} ungrounded`} />
          <Stat label="Avg sources / answer" value={retrieval?.averageSources ?? 0} />
        </div>

        {reliability && Object.keys(reliability.errorsByCode).length > 0 && (
          <Card padded className="mt-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
              <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-warning" /> Errors by code
            </p>
            <ul role="list" className="mt-2 flex flex-wrap gap-2">
              {Object.entries(reliability.errorsByCode).map(([code, count]) => (
                <li key={code}>
                  <Badge variant="danger">
                    {code} · {count}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {reliability && Object.keys(reliability.providers).length > 0 && (
          <Card padded className="mt-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">Providers</p>
            <ul role="list" className="mt-2 flex flex-wrap gap-2">
              {Object.entries(reliability.providers).map(([provider, count]) => (
                <li key={provider}>
                  <Badge variant="neutral">
                    {provider} · {count}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ------------------------------ retrieval ----------------------------- */}
      <section aria-labelledby="ai-retrieval">
        <SectionHeader id="ai-retrieval" title="RAG pipeline" subtitle="Index size and grounding configuration" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Chunks indexed" value={retrieval?.chunksIndexed ?? 0} hint="document_chunks" />
          <Stat label="Retrieval used" value={retrieval?.used ?? 0} />
          <Stat label="Threads" value={analytics?.conversations.threads ?? 0} />
          <Stat label="Messages" value={analytics?.conversations.messages ?? 0} />
        </div>

        {retrieval && (
          <Card padded className="mt-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
              <Gauge aria-hidden className="h-3.5 w-3.5" /> Support
            </p>
            <ul role="list" className="mt-2 space-y-1.5 text-[13px] text-muted">
              <li className="flex items-center justify-between gap-3">
                <span>Embedding model</span>
                <span className="tabular text-foreground">
                  {retrieval.support.configured ? retrieval.support.embeddingModel : 'not configured'}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Vector dimension</span>
                <span className="tabular text-foreground">{retrieval.support.embeddingDim}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Top-K / tool planning</span>
                <span className="tabular text-foreground">
                  {retrieval.support.topK} · {retrieval.support.toolPlanning}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Daily limits</span>
                <span className="tabular text-foreground">
                  {analytics?.limits.dailyRequestsPerUser ?? 0} overall ·{' '}
                  {analytics?.limits.dailyRequestsPerFeature ?? 0} per feature
                </span>
              </li>
            </ul>
          </Card>
        )}
      </section>

      {/* ----------------------------- embeddings ----------------------------- */}
      <section aria-labelledby="ai-embeddings">
        <SectionHeader
          id="ai-embeddings"
          title="Embeddings admin"
          subtitle="Retry failed jobs, rebuild the index, or run the queue now"
          action={
            <Button
              variant="soft"
              size="sm"
              icon={<DatabaseZap />}
              disabled={busy !== null || !embeddings?.configured}
              onClick={() => void act('run', () => runEmbeddingQueue(6), 'Queue processed')}
            >
              Run queue now
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Pending" value={queue?.pending ?? 0} />
          <Stat label="Processing" value={queue?.processing ?? 0} />
          <Stat label="Completed" value={queue?.completed ?? 0} />
          <Stat label="Failed" value={queue?.failed ?? 0} />
        </div>

        {embeddings && !embeddings.configured && (
          <Card padded className="mt-3 border border-warning/50 bg-warning-soft">
            <p className="flex items-start gap-2 text-[13px] text-foreground">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              No embedding provider is configured — hybrid search is running keyword-only. Set AI_PROVIDER + the
              embedding model and key on the edge functions (see .env.example).
            </p>
          </Card>
        )}

        {embeddings && (
          <Card padded className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
                <Boxes aria-hidden className="h-3.5 w-3.5" /> Pipeline
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RotateCcw />}
                  disabled={busy !== null || (queue?.failed ?? 0) === 0}
                  onClick={() => void act('retry', () => retryFailedJobs(), 'Failed jobs requeued')}
                >
                  Retry failed{queue?.failed ? ` (${queue.failed})` : ''}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Sparkles />}
                  disabled={busy !== null || !embeddings.configured}
                  onClick={() => void act('rebuild-all', () => rebuildIndex({ scope: 'rebuild_all' }), 'Index rebuilding')}
                >
                  Rebuild entire index
                </Button>
              </div>
            </div>

            <p className="mt-2 text-[13px] text-muted">
              {embeddings.chunks.toLocaleString('en-IN')} chunks · provider <b>{embeddings.provider}</b> · model{' '}
              <b>{embeddings.embeddingModel}</b> · expected dimension <b>{embeddings.expectedDimension}</b>
            </p>

            {embeddings.failures.length > 0 && (
              <ul role="list" className="mt-3 space-y-2">
                {embeddings.failures.map((failure, index) => (
                  <li key={index} className="rounded-tile border border-danger/40 bg-danger-soft p-2.5">
                    <p className="text-[12px] font-semibold text-foreground">
                      {String(failure.scope ?? 'resource')} · {String(failure.resource_id ?? failure.chapter_id ?? '')}
                    </p>
                    <p className="text-[12px] text-muted">
                      {String(failure.last_error ?? 'Unknown error')} · attempts {String(failure.attempts ?? 0)}/
                      {String(failure.max_attempts ?? 3)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </section>
    </div>
  )
}
