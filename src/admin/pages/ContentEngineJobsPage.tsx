/**
 * Admin → Content Engine → Job dashboard (`/admin/content-engine/jobs`).
 *
 * One queue for everything the engine does asynchronously (spec §40/§62/§65):
 * syllabus discovery, chapter maps, note generation, validation, PYQ
 * discovery, imports, RAG re-indexing and daily maintenance.
 *
 * Two properties matter here:
 *
 *   * **Chapters fail independently.** One chapter erroring never stops the
 *     rest of its batch, so the controls act on individual rows and the bulk
 *     actions report exactly which rows succeeded and which did not.
 *   * **The queue is written server-side.** There is no INSERT policy on
 *     `content_generation_jobs`; every control goes through `ce_control_job()`
 *     (SECURITY DEFINER), which re-checks `engine.manage`. The disabled buttons
 *     below are cosmetic — the database is the actual gate.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Filter,
  ListChecks,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Search,
} from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@/components/ui'
import type { ReactNode } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { isDemo } from '@/services/shared'
import { relativeTime } from '@/utils/format'
import {
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  JOB_TYPES,
  type ContentGenerationJobRow,
  type JobStatus,
  type JobType,
} from '@/content-engine/types'
import { effectiveProgress, isActive } from '@/content-engine/jobs'
import {
  controlJob,
  controlJobs,
  enqueueJob,
  listJobs,
  type JobControlAction,
} from '../services/contentEngine.service'
import { DataTable, type Column } from '../components/DataTable'
import { EngineNotice, JobProgressBar, JobStatusPill, StageLabel } from '../components/ContentEngineBits'
import { useToast } from '@/context/AppProvider'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'
const REFRESH_MS = 6000

const STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All statuses' },
  ...Object.entries(JOB_STATUS_LABELS).map(([id, label]) => ({ id, label })),
]

const TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All job types' },
  ...Object.entries(JOB_TYPE_LABELS).map(([id, label]) => ({ id, label })),
]

/** Scope summary so a row is identifiable without opening it. */
function scopeOf(job: ContentGenerationJobRow): string {
  const parts = [
    job.academic_session ? `Session ${job.academic_session}` : null,
    typeof job.params?.subjectName === 'string' ? job.params.subjectName : null,
    typeof job.params?.chapterName === 'string' ? job.params.chapterName : null,
    typeof job.params?.sourceName === 'string' ? job.params.sourceName : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length ? parts.join(' · ') : 'Whole engine'
}

export default function ContentEngineJobsPage() {
  const { toast } = useToast()

  const [status, setStatus] = useState<'all' | JobStatus>('all')
  const [jobType, setJobType] = useState<'all' | JobType>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const jobsQuery = useQuery<ContentGenerationJobRow[]>(
    `admin:engine:jobs:${status}:${jobType}`,
    () => listJobs({ status, jobType }, 100),
  )

  const jobs = useMemo(() => {
    const items = jobsQuery.data ?? []
    const needle = search.trim().toLowerCase()
    if (!needle) return items
    return items.filter((job) =>
      `${JOB_TYPE_LABELS[job.job_type] ?? job.job_type} ${scopeOf(job)} ${job.stage} ${job.error ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [jobsQuery.data, search])

  /* Poll only while something is actually moving — a quiet queue costs nothing. */
  const hasActive = (jobsQuery.data ?? []).some((job) => isActive(job.status))
  useEffect(() => {
    if (!hasActive) return
    const timer = window.setInterval(() => void jobsQuery.refetch(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [hasActive, jobsQuery.refetch])

  const applyAction = useCallback(
    async (ids: string[], action: JobControlAction) => {
      if (ids.length === 0) return
      setBusyId(ids[0])

      try {
        if (ids.length === 1) {
          await controlJob(ids[0], action)
          toast({ title: 'Job updated', variant: 'success' })
        } else {
          const result = await controlJobs(ids, action)
          if (result.failed.length) {
            toast({
              title: `${result.updated} updated, ${result.failed.length} failed`,
              description: result.failed.map((failure) => failure.reason).slice(0, 2).join(' '),
              variant: 'warning',
            })
          } else {
            toast({ title: `${result.updated} jobs updated`, variant: 'success' })
          }
        }
        setSelected([])
        await jobsQuery.refetch()
      } catch (error) {
        toast({
          title: 'Could not update the job',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'danger',
        })
      } finally {
        setBusyId(null)
      }
    },
    [jobsQuery.refetch, toast],
  )

  const queueMaintenance = async () => {
    try {
      await enqueueJob('daily_maintenance', { priority: 50 })
      toast({ title: 'Health check queued', variant: 'success' })
      await jobsQuery.refetch()
    } catch (error) {
      toast({
        title: 'Could not queue the job',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    }
  }

  const columns: Column<ContentGenerationJobRow>[] = [
    {
      key: 'job_type',
      header: 'Job',
      render: (job) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
          </p>
          <p className="mt-0.5 truncate text-xs text-faint">{scopeOf(job)}</p>
          {job.error && <p className="mt-1 truncate text-xs text-danger">{job.error}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (job) => (
        <div className="flex flex-col gap-1">
          <JobStatusPill status={job.status} />
          <StageLabel stage={job.stage} />
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (job) => (
        <div className="w-32">
          <JobProgressBar
            progress={effectiveProgress(job)}
            variant={job.status === 'failed' ? 'danger' : job.status === 'completed' ? 'success' : 'brand'}
          />
          {job.steps_total > 0 && (
            <p className="mt-1 text-xs tabular-nums text-faint">
              {job.steps_done} / {job.steps_total} steps
            </p>
          )}
        </div>
      ),
      hideBelow: 'md',
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (job) => <span className="text-sm tabular-nums text-muted">{job.priority}</span>,
      align: 'right',
      hideBelow: 'lg',
    },
    {
      key: 'attempts',
      header: 'Attempts',
      render: (job) => (
        <span className="text-sm tabular-nums text-muted">
          {job.attempts} / {job.max_attempts}
        </span>
      ),
      align: 'right',
      hideBelow: 'lg',
    },
    {
      key: 'created_at',
      header: 'Queued',
      render: (job) => <span className="text-xs text-faint">{relativeTime(job.created_at)}</span>,
    },
  ]

  const rowActions = (job: ContentGenerationJobRow) => {
    const controls: Array<{ action: JobControlAction; label: string; icon: ReactNode }> = []

    if (job.status === 'paused') {
      controls.push({ action: 'resume', label: 'Resume', icon: <Play /> })
    }
    if (job.status === 'queued' || job.status === 'paused') {
      controls.push({ action: 'run', label: 'Run now', icon: <Rocket /> })
      controls.push({ action: 'cancel', label: 'Cancel', icon: <Ban /> })
    }
    if (job.status === 'running') {
      controls.push({ action: 'pause', label: 'Pause', icon: <Pause /> })
    }
    if (job.status === 'failed' || job.status === 'partial' || job.status === 'cancelled') {
      controls.push({ action: 'retry', label: 'Retry', icon: <RotateCcw /> })
    }

    if (!controls.length) return null

    return (
      <div className="flex items-center justify-end gap-1">
        {controls.map((control) => (
          <Button
            key={control.action}
            variant="ghost"
            size="sm"
            icon={control.icon}
            loading={busyId === job.id}
            disabled={busyId !== null}
            onClick={() => void applyAction([job.id], control.action)}
            className={FOCUS_RING}
          >
            <span className="sr-only">{control.label}</span>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/admin/content-engine"
        eyebrow="Content Engine"
        title="Job dashboard"
        subtitle="Every asynchronous job the engine is running or has run. Each chapter is processed independently, so one failure never stops a batch."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw />}
              onClick={() => void jobsQuery.refetch()}
              loading={jobsQuery.isFetching}
              className={FOCUS_RING}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={<Plus />}
              onClick={() => void queueMaintenance()}
              disabled={isDemo}
              className={FOCUS_RING}
            >
              Queue health check
            </Button>
          </>
        }
      />

      {isDemo && <EngineNotice />}

      {/* ------------------------------------------------------- filters */}
      <Card as="section" aria-label="Job filters">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              setStatus(value as 'all' | JobStatus)
              setSelected([])
            }}
          />
          <Select
            label="Job type"
            value={jobType}
            options={TYPE_OPTIONS}
            onChange={(value) => {
              setJobType(value as 'all' | JobType)
              setSelected([])
            }}
          />
          <div className="lg:col-span-2">
            <Input
              label="Search jobs"
              icon={<Search />}
              placeholder="Search by type, subject, chapter or error…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------- bulk bar */}
      {selected.length > 0 && (
        <Card
          as="section"
          aria-label="Bulk actions"
          className="border-brand/35 bg-brand/5"
          elevation="flat"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {selected.length} job{selected.length === 1 ? '' : 's'} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Play />}
                onClick={() => void applyAction(selected, 'run')}
                className={FOCUS_RING}
              >
                Run now
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Pause />}
                onClick={() => void applyAction(selected, 'pause')}
                className={FOCUS_RING}
              >
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw />}
                onClick={() => void applyAction(selected, 'retry')}
                className={FOCUS_RING}
              >
                Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Ban />}
                onClick={() => void applyAction(selected, 'cancel')}
                className={FOCUS_RING}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* --------------------------------------------------------- table */}
      <section aria-label="Jobs">
        {jobsQuery.error ? (
          <ErrorState
            title="Could not load the job queue"
            description={jobsQuery.error}
            onRetry={jobsQuery.refetch}
          />
        ) : !jobsQuery.data ? (
          <LoadingState label="Loading the job queue" />
        ) : (
          <DataTable
            caption="Content engine jobs"
            columns={columns}
            rows={jobs}
            rowKey={(job) => job.id}
            selectedIds={selected}
            onSelectionChange={setSelected}
            renderActions={rowActions}
            loading={jobsQuery.isFetching && jobs.length === 0}
            empty={
              <EmptyState
                compact
                icon={<ListChecks />}
                title={status === 'all' && jobType === 'all' && !search ? 'No jobs yet' : 'No jobs match these filters'}
                description={
                  status === 'all' && jobType === 'all' && !search
                    ? 'Jobs appear here when someone runs the engine, or when the scheduler queues daily maintenance.'
                    : 'Try clearing the status or job-type filter.'
                }
              />
            }
          />
        )}
      </section>

      {/* ---------------------------------------------------- legend */}
      <Card as="section" aria-label="About the queue">
        <CardHeader
          title="About this queue"
          subtitle="How to read the controls."
        />
        <ul className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted">
          <li className="flex items-start gap-2">
            <Filter aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />
            <span>
              <strong className="font-semibold text-foreground">Priority</strong> — lower runs first. A job
              started with “Run now” is promoted to priority 10.
            </span>
          </li>
          <li>
            <strong className="font-semibold text-foreground">Partly finished</strong> — some chapters in the
            batch succeeded and others did not. Retry only affects the failed rows, never the successful ones.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Attempts</strong> — jobs retry automatically up
            to their attempt limit; a manual Retry resets that counter.
          </li>
        </ul>
      </Card>
    </div>
  )
}
