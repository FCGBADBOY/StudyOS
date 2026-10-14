/**
 * Admin → Content Engine → Coverage (`/admin/content-engine/coverage`).
 *
 * "Find Missing Content" (spec §67/§68), plus the one-click plan that closes
 * the gap.
 *
 * Two things this screen is careful about:
 *
 *   * **Coverage is defined, not implied.** A chapter counts as covered when it
 *     has approved notes, quick revision material *and* PYQs. The percentage is
 *     computed in `content_coverage` (SQL), not estimated in the browser.
 *   * **Nothing is generated speculatively.** The build plan is previewed —
 *     exactly how many jobs, for how many chapters — before anything is queued.
 */
import { useMemo, useState } from 'react'
import { Layers, ListChecks, Play, Sparkles } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { isDemo } from '@/services/shared'
import { JOB_TYPE_LABELS, type CoverageRow, type MissingContentRow } from '@/content-engine/types'
import { planBuild, type ChapterTarget } from '@/content-engine/jobs'
import {
  enqueueJob,
  getCoverage,
  getMissingContent,
} from '../services/contentEngine.service'
import {
  listBoards,
  listClasses,
  listChapters,
  listSubjects,
} from '../services/adminAcademic.service'
import { DataTable, type Column } from '../components/DataTable'
import { EngineNotice } from '../components/ContentEngineBits'
import { useToast } from '@/context/AppProvider'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

export default function ContentEngineCoveragePage() {
  const { toast } = useToast()
  const [boardId, setBoardId] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [planOpen, setPlanOpen] = useState(false)
  const [queueing, setQueueing] = useState(false)

  const coverageQuery = useQuery<CoverageRow[]>(
    `admin:engine:coverage:${boardId}:${classId}`,
    () => getCoverage(boardId || null, classId || null),
  )
  const missingQuery = useQuery<MissingContentRow[]>(
    `admin:engine:missing:${boardId}:${classId}`,
    () => getMissingContent(boardId || null, classId || null),
  )
  const boardsQuery = useQuery('admin:engine:boards', () => listBoards())
  const classesQuery = useQuery('admin:engine:classes', () => listClasses())
  const subjectsQuery = useQuery('admin:engine:subjects', () => listSubjects())
  const chaptersQuery = useQuery('admin:engine:chapters', () => listChapters())

  const boardOptions = [{ id: '', label: 'All boards' }, ...(boardsQuery.data ?? []).map((board) => ({ id: board.id, label: board.name }))]
  const classOptions = [{ id: '', label: 'All classes' }, ...(classesQuery.data ?? []).map((entry) => ({ id: entry.id, label: entry.name }))]

  const missing = missingQuery.data ?? []
  const coverage = coverageQuery.data ?? []

  /* Filtered by search only — the server already filtered by board and class. */
  const shownMissing = useMemo(() => {
    const needle = subjectFilter.trim().toLowerCase()
    if (!needle) return missing
    return missing.filter((row) =>
      `${row.subject_name} ${row.chapter_name} ${row.class_name} ${row.board_name ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [missing, subjectFilter])

  /**
   * Expand the selected scope into a concrete build plan so the admin can see
   * how many jobs will be queued before committing to anything.
   */
  const targets: ChapterTarget[] = useMemo(() => {
    const subjectNames = new Map((subjectsQuery.data ?? []).map((subject) => [subject.id, subject.name]))
    return (chaptersQuery.data ?? [])
      .filter((chapter) => !chapter.is_archived)
      .map((chapter) => ({
        chapterId: chapter.id,
        subjectId: chapter.subject_id,
        subjectName: subjectNames.get(chapter.subject_id) ?? 'Unknown subject',
        chapterName: chapter.name,
      }))
  }, [chaptersQuery.data, subjectsQuery.data])

  const plan = useMemo(
    () => planBuild({ jobType: 'build_class', scope: { boardId, classId }, chapters: targets }),
    [targets, boardId, classId],
  )

  const runPlan = async () => {
    setQueueing(true)
    let queued = 0
    try {
      for (const job of plan.jobs) {
        await enqueueJob(job.job_type, { ...job.params, priority: job.priority })
        queued += 1
      }
      toast({
        title: `${queued} job${queued === 1 ? '' : 's'} queued`,
        description: 'Each chapter is processed independently — one failure will not stop the batch.',
        variant: 'success',
      })
      setPlanOpen(false)
    } catch (error) {
      toast({
        title: 'Could not queue the whole plan',
        description: `${error instanceof Error ? error.message : 'Please try again.'} ${queued} job(s) were queued.`,
        variant: 'warning',
      })
      setPlanOpen(false)
    } finally {
      setQueueing(false)
    }
  }

  const columns: Column<CoverageRow>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{row.subject_name}</p>
          <p className="mt-0.5 truncate text-xs text-faint">
            {row.board_name} · {row.class_name}
          </p>
        </div>
      ),
    },
    {
      key: 'chapters',
      header: 'Chapters',
      render: (row) => (
        <span className="text-sm tabular-nums text-muted">{row.chapter_count}</span>
      ),
      align: 'right',
    },
    {
      key: 'coverage',
      header: 'Coverage',
      render: (row) => (
        <div className="w-36">
          <ProgressBar
            value={Math.round(row.coverage_percent)}
            size="sm"
            variant={row.coverage_percent >= 80 ? 'success' : row.coverage_percent >= 40 ? 'warning' : 'danger'}
          />
          <p className="mt-1 text-xs tabular-nums text-faint">{row.coverage_percent}%</p>
        </div>
      ),
      hideBelow: 'md',
    },
    {
      key: 'content',
      header: 'Content',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.with_notes === row.chapter_count ? 'success' : 'neutral'}>
            {row.with_notes} notes
          </Badge>
          <Badge variant={row.with_revision === row.chapter_count ? 'success' : 'neutral'}>
            {row.with_revision} revision
          </Badge>
          <Badge variant={row.with_formulas === row.chapter_count ? 'success' : 'neutral'}>
            {row.with_formulas} formulas
          </Badge>
        </div>
      ),
      hideBelow: 'lg',
    },
    {
      key: 'pyqs',
      header: 'PYQs',
      render: (row) => (
        <span className="text-sm tabular-nums text-muted">{row.with_pyqs}</span>
      ),
      align: 'right',
      hideBelow: 'lg',
    },
    {
      key: 'papers',
      header: 'Papers',
      render: (row) => (
        <span className="text-sm tabular-nums text-muted">{row.sample_papers}</span>
      ),
      align: 'right',
      hideBelow: 'lg',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/admin/content-engine"
        eyebrow="Content Engine"
        title="Find missing content"
        subtitle="Coverage by board, class and subject. A chapter counts as covered only when it has notes, quick revision material and PYQs."
        actions={
          <Button
            variant="primary"
            icon={<Play />}
            onClick={() => setPlanOpen(true)}
            disabled={isDemo || plan.chapters === 0}
            className={FOCUS_RING}
          >
            Build this scope
          </Button>
        }
      />

      {isDemo && <EngineNotice />}

      {/* ------------------------------------------------------ filters */}
      <Card as="section" aria-label="Coverage filters">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Board"
            value={boardId}
            options={boardOptions}
            onChange={setBoardId}
          />
          <Select
            label="Class"
            value={classId}
            options={classOptions}
            onChange={setClassId}
          />
          <Input
            label="Search missing content"
            placeholder="Subject or chapter…"
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
          />
        </div>
      </Card>

      {/* ------------------------------------------------------ coverage */}
      <section aria-label="Coverage by subject">
        {coverageQuery.error ? (
          <ErrorState
            title="Could not load the coverage report"
            description={coverageQuery.error}
            onRetry={coverageQuery.refetch}
          />
        ) : !coverageQuery.data ? (
          <LoadingState label="Loading the coverage report" />
        ) : coverage.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No subjects to report on"
            description="Add a board, class and subject in the academic hierarchy first — the engine generates content per chapter, so it needs chapters to work from."
          />
        ) : (
          <DataTable
            caption="Content coverage by subject"
            columns={columns}
            rows={coverage}
            rowKey={(row) => row.subject_id}
          />
        )}
      </section>

      {/* -------------------------------------------------- missing list */}
      <section aria-labelledby="missing-heading">
        <Card as="section" aria-label="Missing content">
          <CardHeader
            title="Chapters that need work"
            subtitle="Only what is genuinely absent — existing material is never regenerated on top of."
          />
          {missingQuery.error ? (
            <ErrorState
              title="Could not scan for missing content"
              description={missingQuery.error}
              onRetry={missingQuery.refetch}
            />
          ) : !missingQuery.data ? (
            <LoadingState label="Scanning for missing content" />
          ) : shownMissing.length === 0 ? (
            <EmptyState
              compact
              icon={<ListChecks />}
              title={subjectFilter ? 'Nothing matches that search' : 'Everything is covered'}
              description={
                subjectFilter
                  ? 'Try a different subject or chapter name.'
                  : 'Every chapter in this scope has notes, revision material and PYQs.'
              }
            />
          ) : (
            <ul className="mt-2 max-h-[28rem] divide-y divide-border overflow-y-auto">
              {shownMissing.map((row) => (
                <li key={row.chapter_id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{row.chapter_name}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {row.subject_name} · {row.class_name}
                      {row.board_name ? ` · ${row.board_name}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {row.missing.map((item) => (
                        <Badge key={item} variant="warning">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Sparkles />}
                    onClick={() => setPlanOpen(true)}
                    className={FOCUS_RING}
                  >
                    Build
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* --------------------------------------------------------- plan */}
      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Build plan"
        description="Nothing is queued until you confirm."
      >
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
            <dt className="text-faint">Subjects</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">{plan.subjects}</dd>
            <dt className="text-faint">Chapters</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">{plan.chapters}</dd>
            <dt className="text-faint">Content per chapter</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">{plan.contentTypes.length}</dd>
            <dt className="text-faint">Total jobs</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">{plan.jobs.length}</dd>
          </dl>

          <div>
            <p className="eyebrow mb-1.5 text-faint">Content types</p>
            <div className="flex flex-wrap gap-1.5">
              {plan.contentTypes.map((type) => (
                <Badge key={type} variant="neutral">
                  {JOB_TYPE_LABELS[type] ?? type}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-muted">
            Chapters are processed independently: if one chapter fails validation, the rest of the batch
            still completes and that chapter can be retried on its own from the{' '}
            <span className="font-semibold text-foreground">job dashboard</span>.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPlanOpen(false)} disabled={queueing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Play />}
              loading={queueing}
              onClick={() => void runPlan()}
              className={FOCUS_RING}
            >
              Queue {plan.jobs.length} job{plan.jobs.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
