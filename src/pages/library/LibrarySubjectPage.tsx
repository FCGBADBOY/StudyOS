import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight, Search, Target, Timer, TrendingUp } from 'lucide-react'
import { useBoards, useClasses, useSubject, useSubjectResources, useStagger } from '@/hooks'
import { useApp } from '@/context/AppProvider'
import { RESOURCE_TABS } from '@/data/resources'
import { ChapterCard } from '@/components/ChapterCard'
import { ResourceCard } from '@/components/ResourceCard'
import {
  Badge,
  Breadcrumb,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  ProgressRing,
  Skeleton,
  SkeletonList,
  Tabs,
  TabPanel,
  type Crumb,
} from '@/components/ui'
import type { ResourceType } from '@/types'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

type Mode = 'chapters' | ResourceType

/** Subject overview: chapters by default, plus the full resource library. */
export default function LibrarySubjectPage() {
  const { board, class: classId, subject: subjectId } = useParams<{
    board: string
    class: string
    subject: string
  }>()
  const { toast } = useApp()
  const [mode, setMode] = useState<Mode>('chapters')
  const [query, setQuery] = useState('')
  const listRef = useStagger<HTMLDivElement>({ step: 40, distance: 12 })

  const boardsQuery = useBoards()
  const classesQuery = useClasses()
  const subjectQuery = useSubject(subjectId, { board, classId })
  const resourcesQuery = useSubjectResources(subjectId)

  const boardData = boardsQuery.data?.find((entry) => entry.id === board)
  const classData = classesQuery.data?.find((entry) => entry.id === classId)
  const subject = subjectQuery.data
  const resources = resourcesQuery.data ?? []

  const chapters = useMemo(() => {
    if (!subject) return []
    const clean = query.trim().toLowerCase()
    return clean
      ? subject.chapters.filter((chapter) =>
          `${chapter.title} ${chapter.topics.join(' ')}`.toLowerCase().includes(clean),
        )
      : subject.chapters
  }, [subject, query])

  const hierarchyLoading = boardsQuery.loading || classesQuery.loading
  const hierarchyError = boardsQuery.error || classesQuery.error
  const refetchHierarchy = () => {
    if (boardsQuery.error) boardsQuery.refetch()
    if (classesQuery.error) classesQuery.refetch()
  }

  const pageSkeleton = (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Loading subject…</span>
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    </div>
  )

  if (hierarchyLoading) return pageSkeleton
  if (hierarchyError)
    return <ErrorState title="We could not load this subject" onRetry={refetchHierarchy} />
  if (!boardData || !classData) return <Navigate to="/library" replace />

  if (subjectQuery.loading) return pageSkeleton
  if (subjectQuery.error)
    return <ErrorState title="We could not load this subject" onRetry={subjectQuery.refetch} />
  if (!subject) return <Navigate to="/library" replace />

  const crumbs: Crumb[] = [
    { label: 'Library', to: '/library' },
    { label: boardData.name, to: `/library/${boardData.id}` },
    { label: classData.name, to: `/library/${boardData.id}/${classData.id}` },
    { label: subject.name },
  ]

  const tabItems = [
    { id: 'chapters' as const, label: 'Chapters', count: subject.totalChapters },
    ...RESOURCE_TABS.map((tab) => ({ id: tab.id, label: tab.label })),
  ]

  const visibleResources =
    mode === 'chapters' ? [] : resources.filter((resource) => resource.type === mode)

  const firstChapter = subject.chapters[0]
  const nextChapter =
    subject.chapters.find((chapter) => chapter.progress < 100) ?? subject.chapters[0]

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        breadcrumb={<Breadcrumb items={crumbs} />}
        title={subject.name}
        subtitle={subject.description}
        back={`/library/${boardData.id}/${classData.id}`}
        actions={
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <ProgressRing value={subject.progress} size={72} stroke={7} label={`${subject.name} progress`} />
          </div>
        }
      />

      {/* Meta strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="text-[12.5px] text-muted">Chapters</p>
          <p className="mt-1 text-xl font-bold tabular text-foreground">
            {subject.completedChapters}
            <span className="text-sm font-semibold text-faint">/{subject.totalChapters}</span>
          </p>
          <p className="mt-1 text-[12px] text-faint">completed</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="text-[12.5px] text-muted">Questions</p>
          <p className="mt-1 text-xl font-bold tabular text-foreground">
            {subject.questionCount.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-faint">
            <Target aria-hidden className="h-3.5 w-3.5" /> practice bank
          </p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="text-[12.5px] text-muted">Accuracy</p>
          <p className="mt-1 text-xl font-bold tabular text-foreground">{subject.accuracy}%</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-success">
            <TrendingUp aria-hidden className="h-3.5 w-3.5" /> last 7 days
          </p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="text-[12.5px] text-muted">Revision time</p>
          <p className="mt-1 text-xl font-bold tabular text-foreground">
            {formatDuration(subject.revisionMinutes)}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-faint">
            <Timer aria-hidden className="h-3.5 w-3.5" /> full syllabus
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
        <ProgressBar
          value={subject.progress}
          label="Syllabus progress"
          valueText={`${subject.progress}%`}
          className="max-w-2xl"
        />
        <p className="mt-2 text-[13px] text-muted">
          {subject.teacher ? (
            <>
              Taught by <span className="font-medium text-foreground">{subject.teacher}</span> ·{' '}
            </>
          ) : null}
          Next milestone:{' '}
          {subject.progress >= 70 ? 'complete the PYQ bank' : 'finish the first three chapters'}
        </p>
      </div>

      {/* Tabs */}
      <div>
        <Tabs
          items={tabItems}
          value={mode}
          onChange={(id) => setMode(id as Mode)}
          label={`${subject.name} sections`}
        />

        <TabPanel id={mode} className="pt-5">
          {mode === 'chapters' ? (
            <>
              <div className="mb-4 sm:max-w-md">
                <label htmlFor="chapter-filter" className="sr-only">
                  Filter chapters
                </label>
                <div className="flex h-11 items-center gap-2 rounded-control border border-border bg-surface px-3.5 transition-colors focus-within:border-brand">
                  <Search aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                  <input
                    id="chapter-filter"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter chapters or topics…"
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
                  />
                </div>
              </div>

              {chapters.length ? (
                <div ref={listRef} className="grid gap-3 lg:grid-cols-2">
                  {chapters.map((chapter) => (
                    <ChapterCard
                      key={chapter.id}
                      chapter={chapter}
                      subject={subject}
                      to={`/library/${boardData.id}/${classData.id}/${subject.id}/${chapter.slug}`}
                    />
                  ))}
                </div>
              ) : query.trim() ? (
                <EmptyState
                  title={`No chapters match “${query}”`}
                  description="Try a topic name instead — every chapter is indexed by its key concepts."
                  action={
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="rounded-control bg-brand px-4 py-2 text-sm font-semibold text-brand-fg"
                    >
                      Clear filter
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="No chapters yet"
                  description="Chapters for this subject are still being mapped — check back soon."
                />
              )}
            </>
          ) : resourcesQuery.loading ? (
            <SkeletonList count={3} label="Loading resources" />
          ) : resourcesQuery.error ? (
            <ErrorState title="We could not load the resources" onRetry={resourcesQuery.refetch} />
          ) : (
            <div ref={listRef} className="grid gap-3 sm:grid-cols-2">
              {visibleResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  subjectId={subject.id}
                  onOpen={(item) =>
                    toast({
                      title: 'Opening resource',
                      description: `${item.title} · ${item.meta}`,
                    })
                  }
                />
              ))}
              {!visibleResources.length && (
                <div className="sm:col-span-2">
                  <EmptyState
                    title="Nothing filed here yet"
                    description="This resource type is generated per chapter — open one below."
                    action={
                      firstChapter ? (
                        <Link
                          to={`/library/${boardData.id}/${classData.id}/${subject.id}/${firstChapter.slug}`}
                          className="rounded-control bg-brand px-4 py-2 text-sm font-semibold text-brand-fg"
                        >
                          Open first chapter
                        </Link>
                      ) : undefined
                    }
                  />
                </div>
              )}
            </div>
          )}
        </TabPanel>
      </div>

      {/* Teacher note */}
      <div className={cn('rounded-card border border-border bg-surface-muted p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">Teacher’s note</Badge>
          {subject.teacher && <Badge variant="neutral">{subject.teacher}</Badge>}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {subject.id === 'mathematics'
            ? 'Prioritise Calculus — it carries ~44% of the paper. Solve PYQs topic-wise before attempting full papers.'
            : subject.id === 'physics'
              ? 'Numericals from Current Electricity and EMI repeat every year. Keep a formula sheet open while practising.'
              : subject.id === 'chemistry'
                ? 'Organic named reactions are the highest-yield revision target. Use Reaction Lab to drill mechanisms.'
                : subject.id === 'english'
                  ? 'Practise one extract question daily — the comprehension section is where marks are lost.'
                  : 'Code by hand before you run it. Boards award marks for trace tables and correct syntax.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/formula-flow"
            className="rounded-control border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-border-strong"
          >
            Formula Flow
          </Link>
          <Link
            to="/pyq"
            className="rounded-control border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-border-strong"
          >
            PYQ bank
          </Link>
          <button
            type="button"
            onClick={() => toast({ title: 'Added to planner', description: `${subject.name} revision block scheduled.` })}
            className="rounded-control bg-brand px-3 py-2 text-[13px] font-semibold text-brand-fg"
          >
            Add to planner
          </button>
        </div>
      </div>

      {/* Next chapter CTA */}
      {nextChapter && (
        <Link
          to={`/library/${boardData.id}/${classData.id}/${subject.id}/${nextChapter.slug}`}
          className="flex items-center justify-between gap-3 rounded-card border border-brand/40 bg-brand-soft p-4 outline-none transition-colors hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-brand-soft-fg">Continue where you stopped</span>
            <span className="block truncate text-[15px] font-semibold text-foreground">
              {nextChapter.title}
            </span>
          </span>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-brand" />
        </Link>
      )}
    </div>
  )
}
