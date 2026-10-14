import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronRight, Search, Target, Timer, TrendingUp } from 'lucide-react'
import { useBoards, useClasses, useSubject, useSubjectResources, useStagger } from '@/hooks'
import { useApp } from '@/context/AppProvider'
import { RESOURCE_TABS } from '@/data/resources'
import { ChapterCard } from '@/components/ChapterCard'
import { ResourceCard } from '@/components/ResourceCard'
import {
  BackgroundArt,
  Badge,
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  InsightCard,
  LinkButton,
  PageHeader,
  ProgressBar,
  ProgressRing,
  Skeleton,
  SkeletonList,
  StatCard,
  Tabs,
  TabPanel,
  type Crumb,
} from '@/components/ui'
import type { ResourceType } from '@/types'
import { subjectTheme, themeColors } from '@/config/visual'
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
      <Skeleton className="h-44 w-full rounded-hero" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-card" />
        ))}
      </div>
    </div>
  )

  if (hierarchyLoading) return pageSkeleton
  if (hierarchyError)
    return (
      <ErrorState
        title="We could not load this subject"
        illustration="notebook"
        theme="library"
        onRetry={refetchHierarchy}
      />
    )
  if (!boardData || !classData) return <Navigate to="/library" replace />

  if (subjectQuery.loading) return pageSkeleton
  if (subjectQuery.error)
    return (
      <ErrorState
        title="We could not load this subject"
        illustration="notebook"
        theme={subjectTheme(subjectId)}
        onRetry={subjectQuery.refetch}
      />
    )
  if (!subject) return <Navigate to="/library" replace />

  const theme = subjectTheme(subject.id)
  const colors = themeColors(theme)

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
    <div className="space-y-7 sm:space-y-9">
      {/* ------------------------------------------------------------ */}
      {/* Subject band — the hue of this page, set once at the top      */}
      {/* ------------------------------------------------------------ */}
      <section className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card">
        <span
          aria-hidden
          className={cn('pointer-events-none absolute inset-0 opacity-80', colors.field)}
        />
        <BackgroundArt theme={theme} intensity="subtle" variant="band" />

        <div className="relative p-4 sm:p-6 lg:p-8">
          <PageHeader
            eyebrow={`${boardData.name} · ${classData.name}`}
            breadcrumb={<Breadcrumb items={crumbs} />}
            title={subject.name}
            subtitle={subject.description}
            back={`/library/${boardData.id}/${classData.id}`}
            size="lg"
            actions={
              <div className="hidden shrink-0 items-center sm:flex">
                <ProgressRing
                  value={subject.progress}
                  size={72}
                  stroke={7}
                  color={colors.accentVar}
                  label={`${subject.name} progress`}
                />
              </div>
            }
          />
        </div>
      </section>

      {/* Meta strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Chapters"
          value={
            <>
              {subject.completedChapters}
              <span className="text-sm font-semibold text-faint">/{subject.totalChapters}</span>
            </>
          }
          icon={<BookOpen />}
          accent={theme}
          trend="completed"
        />
        <StatCard
          label="Questions"
          value={subject.questionCount.toLocaleString('en-IN')}
          icon={<Target />}
          accent={theme}
          trend="practice bank"
        />
        <StatCard
          label="Accuracy"
          value={`${subject.accuracy}%`}
          icon={<TrendingUp />}
          accent="success"
          trend="last 7 days"
          trendTone="positive"
        />
        <StatCard
          label="Revision time"
          value={formatDuration(subject.revisionMinutes)}
          icon={<Timer />}
          accent={theme}
          trend="full syllabus"
        />
      </div>

      {/* Progress */}
      <Card padded tone="cream">
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
      </Card>

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
                <Input
                  id="chapter-filter"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter chapters or topics…"
                  autoComplete="off"
                  icon={<Search />}
                />
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
                  illustration="empty"
                  theme={theme}
                  action={
                    <Button size="md" onClick={() => setQuery('')}>
                      Clear filter
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No chapters yet"
                  description="Chapters for this subject are still being mapped — check back soon."
                  illustration="notebook"
                  theme={theme}
                />
              )}
            </>
          ) : resourcesQuery.loading ? (
            <SkeletonList count={3} label="Loading resources" />
          ) : resourcesQuery.error ? (
            <ErrorState
              title="We could not load the resources"
              illustration="paper"
              theme={theme}
              onRetry={resourcesQuery.refetch}
            />
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
                    illustration="paper"
                    theme={theme}
                    action={
                      firstChapter ? (
                        <Link
                          to={`/library/${boardData.id}/${classData.id}/${subject.id}/${firstChapter.slug}`}
                          className="inline-flex h-11 items-center rounded-control bg-brand px-4 text-sm font-semibold text-brand-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
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

      {/* Teacher note — an explainable tip, so it gets the insight treatment */}
      <InsightCard
        tone={theme}
        marker={<BookOpen />}
        title="Teacher’s note"
        body={
          <>
            {subject.teacher && <Badge variant="neutral">{subject.teacher}</Badge>}
            <span className="mt-1.5 block text-sm leading-relaxed text-muted">
              {subject.id === 'mathematics'
                ? 'Prioritise Calculus — it carries ~44% of the paper. Solve PYQs topic-wise before attempting full papers.'
                : subject.id === 'physics'
                  ? 'Numericals from Current Electricity and EMI repeat every year. Keep a formula sheet open while practising.'
                  : subject.id === 'chemistry'
                    ? 'Organic named reactions are the highest-yield revision target. Use Reaction Lab to drill mechanisms.'
                    : subject.id === 'english'
                      ? 'Practise one extract question daily — the comprehension section is where marks are lost.'
                      : 'Code by hand before you run it. Boards award marks for trace tables and correct syntax.'}
            </span>
          </>
        }
        detail={
          <span className="flex flex-wrap items-center gap-2">
            <LinkButton to="/formula-flow" variant="outline" size="md">
              Formula Flow
            </LinkButton>
            <LinkButton to="/pyq" variant="outline" size="md">
              PYQ bank
            </LinkButton>
            <Button
              size="md"
              onClick={() =>
                toast({ title: 'Added to planner', description: `${subject.name} revision block scheduled.` })
              }
            >
              Add to planner
            </Button>
          </span>
        }
      />

      {/* Next chapter CTA */}
      {nextChapter && (
        <Link
          to={`/library/${boardData.id}/${classData.id}/${subject.id}/${nextChapter.slug}`}
          className="group relative isolate flex items-center justify-between gap-3 overflow-hidden rounded-card bg-brand-soft p-4 shadow-card outline-none transition-shadow duration-150 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring sm:p-5"
        >
          <BackgroundArt theme="brand" intensity="faint" variant="corner" />
          <span className="relative min-w-0">
            <span className="block text-[13px] font-medium text-brand-soft-fg">
              Continue where you stopped
            </span>
            <span className="mt-0.5 block truncate text-[15px] font-semibold text-foreground">
              {nextChapter.title}
            </span>
          </span>
          <ArrowRight
            aria-hidden
            className="relative h-5 w-5 shrink-0 text-brand transition-transform duration-150 group-hover:translate-x-1"
          />
        </Link>
      )}
    </div>
  )
}
