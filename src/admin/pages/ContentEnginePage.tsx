/**
 * Admin → Content Engine dashboard.
 *
 * The engine's home screen: coverage across every board/class/subject, how much
 * material has been produced and how much is waiting for a human, the recurring
 * jobs that keep it alive, and the daily Content Health report (spec §66/§69).
 *
 * Every figure comes from `ce_stats()` / `ce_health()` — nothing is counted in
 * the browser, and nothing is seeded (spec §66). With no backend connected the
 * cards read 0 and an `EngineNotice` explains why, rather than inventing data.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  HeartPulse,
  Layers,
  ListChecks,
  RefreshCw,
  ScrollText,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  SectionHeader,
  SkeletonCard,
  StatCard,
  type StatCardProps,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { isDemo } from '@/services/shared'
import { SCHEDULED_JOBS, nextRun } from '@/content-engine/jobs'
import { SOURCE_ADAPTERS } from '@/content-engine'
import type { ContentHealth, EngineStats } from '@/content-engine/types'
import { cachedHealth, cachedStats, runAction } from '../services/contentEngine.service'
import { statCounter } from '../animations/adminAnimations'
import { EngineNotice, WarningRow } from '../components/ContentEngineBits'
import { useToast } from '@/context/AppProvider'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'
const SKELETON_COUNT = 6

/** StatCard whose value counts up once per fetch, like the main dashboard. */
function AnimatedStat({
  label,
  value,
  icon,
  accent,
  hint,
}: {
  label: string
  value: number
  icon?: ReactNode
  accent?: StatCardProps['accent']
  hint?: string
}) {
  const valueRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => statCounter(valueRef.current, value), [value])

  return (
    <StatCard
      label={label}
      accent={accent}
      icon={icon}
      trend={hint}
      trendTone="neutral"
      value={<span ref={valueRef}>{value.toLocaleString('en-IN')}</span>}
    />
  )
}

export default function ContentEnginePage() {
  const { toast } = useToast()

  const statsQuery = useQuery<EngineStats>('admin:engine:stats', () => cachedStats())
  const healthQuery = useQuery<ContentHealth>('admin:engine:health', () => cachedHealth())

  const stats = statsQuery.data
  const health = healthQuery.data

  const queueMaintenance = async () => {
    try {
      const response = await runAction('dailyMaintenance')
      toast({
        title: 'Content health check queued',
        description: response.summary ?? 'The worker will pick it up shortly.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Could not queue the check',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Content Engine"
        title="Autonomous Academic Content Engine"
        subtitle="Syllabus discovery, original note generation, PYQ and sample-paper collection — every step licensed, validated and reviewed by a human before it reaches a student."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw />}
              onClick={queueMaintenance}
              disabled={isDemo}
              className={FOCUS_RING}
            >
              Run health check
            </Button>
            <LinkButton to="/admin/content-engine/jobs" icon={<ListChecks />} className={FOCUS_RING}>
              Jobs
            </LinkButton>
          </>
        }
      />

      {isDemo && <EngineNotice />}

      {/* ------------------------------------------------------ engine KPIs */}
      <section aria-label="Engine statistics">
        {statsQuery.error ? (
          <ErrorState
            title="Could not load the engine statistics"
            description={statsQuery.error}
            onRetry={statsQuery.refetch}
          />
        ) : !stats ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading engine statistics"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <span className="sr-only">Loading engine statistics…</span>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatedStat
              label="Syllabus coverage"
              value={stats.coverage}
              icon={<Layers />}
              accent="brand"
              hint="% of chapters with notes, revision and PYQs"
            />
            <AnimatedStat
              label="Generated notes"
              value={stats.generated_notes}
              icon={<Sparkles />}
              accent="success"
              hint="Approved or published"
            />
            <AnimatedStat
              label="Awaiting review"
              value={stats.needs_review}
              icon={<ListChecks />}
              accent={stats.needs_review > 0 ? 'warning' : 'neutral'}
              hint="Notes, syllabus changes and question mappings"
            />
            <AnimatedStat
              label="Verified PYQs"
              value={stats.verified_pyqs}
              icon={<ScrollText />}
              accent="brand"
              hint="Stored in the PYQ bank"
            />
            <AnimatedStat
              label="Sample papers"
              value={stats.sample_papers}
              icon={<FileSearch />}
              accent="brand"
              hint="Collected with provenance"
            />
            <AnimatedStat
              label="Discovered documents"
              value={stats.discovered_documents}
              icon={<Bot />}
              accent="neutral"
              hint={`${stats.stored_documents} stored · ${stats.linked_documents} link-only`}
            />
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- health */}
      <section aria-labelledby="engine-health-heading">
        <SectionHeader
          id="engine-health-heading"
          title="Content Health"
          subtitle="What the engine found the last time it looked at itself."
          action={
            healthQuery.refetch ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<HeartPulse />}
                onClick={healthQuery.refetch}
                className={FOCUS_RING}
              >
                Re-check
              </Button>
            ) : undefined
          }
        />

        {healthQuery.error ? (
          <ErrorState
            title="Could not run the content health check"
            description={healthQuery.error}
            onRetry={healthQuery.refetch}
          />
        ) : !health ? (
          <LoadingState label="Running the content health check" />
        ) : (
          <Card as="section" aria-label="Content health">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <HealthGroup
                title="Sources"
                icon={<Bot />}
                rows={[
                  { label: 'Enabled', value: health.sources.enabled, total: health.sources.total },
                  { label: 'Unavailable', value: health.sources.unavailable, tone: 'danger' },
                  { label: 'Stale (overdue)', value: health.sources.stale, tone: 'warning' },
                ]}
              />
              <HealthGroup
                title="Links"
                icon={<FileSearch />}
                rows={[
                  { label: 'Checked', value: health.links.checked },
                  { label: 'Broken or timed out', value: health.links.broken, tone: 'danger' },
                ]}
              />
              <HealthGroup
                title="Content"
                icon={<Layers />}
                rows={[
                  { label: 'Chapters with nothing', value: health.content.missingChapters, tone: 'warning' },
                  { label: 'Failed jobs', value: health.content.failedJobs, tone: 'danger' },
                  { label: 'Stale papers', value: health.content.stalePapers, tone: 'warning' },
                  { label: 'Failed embeddings', value: health.content.failedEmbeddings, tone: 'warning' },
                ]}
              />
              <HealthGroup
                title="Reviews"
                icon={<ListChecks />}
                rows={[
                  { label: 'Notes', value: health.reviews.notes, tone: 'warning' },
                  { label: 'Syllabus changes', value: health.reviews.syllabusChanges },
                  { label: 'Question mappings', value: health.reviews.questionMappings },
                ]}
              />
            </div>

            {health.content.failedJobs > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <WarningRow>
                  {health.content.failedJobs} job{health.content.failedJobs === 1 ? '' : 's'} failed. Each chapter
                  fails on its own, so the rest of the batch continued — open the{' '}
                  <Link to="/admin/content-engine/jobs" className={`font-semibold text-brand ${FOCUS_RING}`}>
                    job dashboard
                  </Link>{' '}
                  to retry them.
                </WarningRow>
              </div>
            )}
          </Card>
        )}
      </section>

      {/* ----------------------------------------------------- automation */}
      <section aria-labelledby="engine-automation-heading">
        <SectionHeader
          id="engine-automation-heading"
          title="Automation"
          subtitle="Recurring work the scheduler may trigger. Nothing here runs without the permission checks in the database."
        />
        <Card as="section" aria-label="Automation schedule">
          <ul className="divide-y divide-border">
            {SCHEDULED_JOBS.map((job) => (
              <li key={job.label} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarClock aria-hidden className="size-4 shrink-0 text-muted" />
                    <p className="text-sm font-semibold text-foreground">{job.label}</p>
                    <Badge variant="neutral">
                      {job.kind === 'daily'
                        ? 'Daily'
                        : job.kind === 'weekly'
                          ? 'Weekly'
                          : job.kind === 'session_change'
                            ? 'On new session'
                            : 'On source update'}
                    </Badge>
                    {job.enabledSetting && (
                      <Badge variant={stats?.maintenance[job.enabledSetting] ? 'success' : 'neutral'}>
                        {stats?.maintenance[job.enabledSetting] ? 'Enabled' : 'Disabled'}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{job.rule}</p>
                </div>
                <p className="shrink-0 text-xs text-faint">
                  Next:{' '}
                  {nextRun(job.kind, stats?.maintenance.intervalHours ?? 24).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* ---------------------------------------------------- quick links */}
      <section aria-labelledby="engine-links-heading">
        <SectionHeader id="engine-links-heading" title="Workspaces" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <EngineLink
            to="/admin/content-engine/review"
            title="Review generated content"
            description="Approve, reject, archive or reprocess AI notes and syllabus changes before anything is published."
            icon={<CheckCircle2 />}
          />
          <EngineLink
            to="/admin/content-engine/coverage"
            title="Find missing content"
            description="Coverage by board, class and subject, with a ready-to-run plan for the gaps."
            icon={<Layers />}
          />
          <EngineLink
            to="/admin/content-engine/sources"
            title="Source registry"
            description="The crawl allow-list: domains, licences and whether each source may be redistributed."
            icon={<Bot />}
          />
          <EngineLink
            to="/admin/content-engine/pyq-discovery"
            title="PYQ & sample papers"
            description="Discover, verify and classify papers. Unverified material never appears as an official PYQ."
            icon={<ScrollText />}
          />
          <EngineLink
            to="/admin/content-engine/jobs"
            title="Job dashboard"
            description="Every queued, running and failed job, with independent retry per chapter."
            icon={<ListChecks />}
          />
        </div>
      </section>

      {/* ------------------------------------------------------- adapters */}
      <section aria-labelledby="engine-adapters-heading">
        <SectionHeader
          id="engine-adapters-heading"
          title="Board adapters"
          subtitle="Adding a board is a new adapter, not a new branch in the app."
        />
        <Card as="section" aria-label="Board adapters">
          <ul className="flex flex-wrap gap-2">
            {SOURCE_ADAPTERS.map((adapter) => (
              <li key={adapter.id}>
                <Badge variant="outline" className="font-medium">
                  {adapter.label}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              Adapters declare their own domains, URL patterns and licence assumptions. They never follow a
              link off their allow-list, never bypass a login, CAPTCHA or paywall, and always obey
              robots.txt — see the README for how to add one.
            </span>
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------------ empty data */}
      {stats && stats.generated_notes === 0 && stats.discovered_documents === 0 && (
        <EmptyState
          title="The engine has not produced anything yet"
          description="Add and enable a source, then run syllabus discovery for a board. Generated material always passes validation and human review before it is published."
          action={
            <LinkButton to="/admin/content-engine/sources" icon={<ArrowRight />} className={FOCUS_RING}>
              Open the source registry
            </LinkButton>
          }
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Health group                                                               */
/* -------------------------------------------------------------------------- */

function HealthGroup({
  title,
  icon,
  rows,
}: {
  title: string
  icon: ReactNode
  rows: Array<{ label: string; value: number; total?: number; tone?: 'danger' | 'warning' }>
}) {
  return (
    <div>
      <p className="eyebrow flex items-center gap-1.5 text-faint">
        {icon}
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] text-muted">{row.label}</span>
            <span
              className={
                row.tone === 'danger' && row.value > 0
                  ? 'text-sm font-bold tabular-nums text-danger'
                  : row.tone === 'warning' && row.value > 0
                    ? 'text-sm font-bold tabular-nums text-warning'
                    : 'text-sm font-bold tabular-nums text-foreground'
              }
            >
              {row.value.toLocaleString('en-IN')}
              {typeof row.total === 'number' && (
                <span className="text-faint"> / {row.total.toLocaleString('en-IN')}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick link                                                                 */
/* -------------------------------------------------------------------------- */

function EngineLink({
  to,
  title,
  description,
  icon,
}: {
  to: string
  title: string
  description: string
  icon: ReactNode
}) {
  return (
    <Link
      to={to}
      className={`group flex items-start gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-secondary ${FOCUS_RING}`}
    >
      <span aria-hidden className="mt-0.5 shrink-0 text-brand">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
          {title}
          <ArrowRight
            aria-hidden
            className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-muted">{description}</span>
      </span>
    </Link>
  )
}
