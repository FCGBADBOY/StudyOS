import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  Play,
  Sigma,
  Target,
} from 'lucide-react'
import { useBoards, useChapter, useChapterResources, useClasses, useStagger } from '@/hooks'
import { useApp } from '@/context/AppProvider'
import { RESOURCE_TABS } from '@/data/resources'
import { ResourceCard } from '@/components/ResourceCard'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  ProgressBar,
  SectionHeader,
  Skeleton,
  SkeletonList,
  TabPanel,
  Tabs,
  type Crumb,
} from '@/components/ui'
import { FavoriteButton } from '@/components/FavoriteButton'
import { difficultyTone, subjectAccent } from '@/utils/subject'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { ResourceType } from '@/types'

type Mode = 'overview' | ResourceType

/** Chapter detail: concept outline, resources, and actions into tutor/PYQ. */
export default function LibraryChapterPage() {
  const { board, class: classId, subject: subjectId, chapter: chapterSlug } = useParams<{
    board: string
    class: string
    subject: string
    chapter: string
  }>()
  const { toast } = useApp()
  const [mode, setMode] = useState<Mode>('overview')
  const bodyRef = useStagger<HTMLDivElement>({ step: 40, distance: 12 })

  const boardsQuery = useBoards()
  const classesQuery = useClasses()
  const chapterQuery = useChapter(subjectId, chapterSlug, { board, classId })
  const resourcesQuery = useChapterResources(subjectId, chapterSlug)

  const boardData = boardsQuery.data?.find((entry) => entry.id === board)
  const classData = classesQuery.data?.find((entry) => entry.id === classId)
  const resolved = chapterQuery.data
  const resources = resourcesQuery.data ?? []

  const hierarchyLoading = boardsQuery.loading || classesQuery.loading
  const hierarchyError = boardsQuery.error || classesQuery.error
  const refetchHierarchy = () => {
    if (boardsQuery.error) boardsQuery.refetch()
    if (classesQuery.error) classesQuery.refetch()
  }

  const pageSkeleton = (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Loading chapter…</span>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    </div>
  )

  if (hierarchyLoading) return pageSkeleton
  if (hierarchyError)
    return <ErrorState title="We could not load this chapter" onRetry={refetchHierarchy} />
  if (!boardData || !classData) return <Navigate to="/library" replace />

  if (chapterQuery.loading) return pageSkeleton
  if (chapterQuery.error)
    return <ErrorState title="We could not load this chapter" onRetry={chapterQuery.refetch} />
  if (!resolved) return <Navigate to="/library" replace />

  const { subject, chapter } = resolved
  const accent = subjectAccent(subject.id)
  const basePath = `/library/${boardData.id}/${classData.id}/${subject.id}/${chapter.slug}`

  const crumbs: Crumb[] = [
    { label: 'Library', to: '/library' },
    { label: subject.name, to: `/library/${boardData.id}/${classData.id}/${subject.id}` },
    { label: chapter.title },
  ]

  const tabItems = [
    { id: 'overview' as const, label: 'Overview' },
    ...RESOURCE_TABS.map((tab) => ({ id: tab.id, label: tab.label })),
  ]

  const visibleResources = mode === 'overview' ? [] : resources.filter((resource) => resource.type === mode)

  const related = subject.chapters.filter((entry) => entry.slug !== chapter.slug).slice(0, 4)

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        breadcrumb={<Breadcrumb items={crumbs} />}
        title={chapter.title}
        subtitle={chapter.description}
        back={`/library/${boardData.id}/${classData.id}/${subject.id}`}
        actions={
          <FavoriteButton
            id={`chapter:${subject.id}:${chapter.slug}`}
            label="Save chapter"
            size="md"
          />
        }
      />

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'grid h-9 w-9 place-items-center rounded-tile text-sm font-bold tabular',
            accent.soft,
            accent.text,
          )}
        >
          {String(chapter.index).padStart(2, '0')}
        </span>
        <Badge variant={difficultyTone(chapter.difficulty)}>{chapter.difficulty}</Badge>
        {chapter.weak && <Badge variant="danger" icon={<Flame />}>Weak chapter</Badge>}
        <Badge variant="neutral" icon={<Target />}>
          <span className="tabular">{chapter.questionCount}</span> questions
        </Badge>
        <Badge variant="neutral">
          <span className="tabular">{chapter.pyqCount}</span> PYQs
        </Badge>
        <Badge variant="neutral" icon={<Clock />}>
          {formatDuration(chapter.estimatedMinutes)}
        </Badge>
      </div>

      {/* Progress */}
      <Card padded>
        <ProgressBar
          value={chapter.progress}
          label="Chapter progress"
          valueText={`${chapter.progress}%`}
          size="md"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            icon={<Play />}
            onClick={() =>
              toast({ title: 'Study session started', description: `${chapter.title} · focus timer running.` })
            }
          >
            {chapter.progress ? 'Resume chapter' : 'Start chapter'}
          </Button>
          <Button
            variant="soft"
            icon={<Bot />}
            onClick={() => toast({ title: 'AI Tutor ready', description: `Ask me anything about ${chapter.title}.` })}
          >
            Explain with AI
          </Button>
          <LinkButton to="/pyq" variant="outline" size="md" icon={<HelpCircle />}>
            Practise PYQs
          </LinkButton>
          <button
            type="button"
            onClick={() => toast({ title: 'Marked complete', description: 'Nice — progress updated to 100%.', variant: 'success' })}
            className="inline-flex h-11 items-center gap-2 rounded-control border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4 text-success" />
            Mark complete
          </button>
        </div>
      </Card>

      {/* Tabs */}
      <div>
        <Tabs items={tabItems} value={mode} onChange={(id) => setMode(id as Mode)} label="Chapter sections" />

        <TabPanel id={mode} className="pt-5">
          {mode === 'overview' ? (
            <div ref={bodyRef} className="space-y-6">
              {/* Topics */}
              <section aria-labelledby="topics">
                <SectionHeader
                  id="topics"
                  title="Topics in this chapter"
                  subtitle={`${chapter.topics.length} concept blocks`}
                  action={
                    <Link to="/planner" className="text-[13px] font-semibold text-brand hover:underline">
                      Schedule revision
                    </Link>
                  }
                />
                {chapter.topics.length ? (
                  <ol className="grid gap-2 sm:grid-cols-2">
                    {chapter.topics.map((topic, index) => (
                      <li
                        key={topic}
                        className="flex items-start gap-3 rounded-card border border-border bg-surface px-3.5 py-3"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular',
                            accent.soft,
                            accent.text,
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">{topic}</span>
                          <span className="mt-0.5 block text-[12px] text-faint">
                            {index < Math.ceil(chapter.topics.length / 2) ? 'Core concept' : 'Application'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState
                    compact
                    title="No topics listed yet"
                    description="Concept blocks for this chapter are still being written."
                  />
                )}
              </section>

              {/* Why it matters */}
              <section aria-labelledby="why">
                <SectionHeader id="why" title="Why this chapter matters" />
                <Card padded className="bg-surface-muted">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand" icon={<Sigma />}>
                      Exam weight
                    </Badge>
                    <Badge variant="warning">
                      <span className="tabular">{chapter.pyqCount}</span> appearances
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {chapter.weak
                      ? `This is one of your weak chapters — accuracy is below your average. Two focused sessions typically move it into the green.`
                      : `Steady progress here. Solve the PYQ set once more before the exam to lock in the ${chapter.questionCount}-question bank.`}
                  </p>
                </Card>
              </section>

              {/* Related */}
              <section aria-labelledby="related">
                <SectionHeader id="related" title="More from this subject" />
                {related.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {related.map((entry) => (
                      <Link
                        key={entry.id}
                        to={`/library/${boardData.id}/${classData.id}/${subject.id}/${entry.slug}`}
                        className="flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 transition-colors hover:border-border-strong"
                      >
                        <span
                          aria-hidden
                          className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-tile text-xs font-bold tabular', accent.soft, accent.text)}
                        >
                          {String(entry.index).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{entry.title}</span>
                          <span className="block text-[12px] text-faint tabular">{entry.progress}% done</span>
                        </span>
                        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    compact
                    title="No other chapters yet"
                    description="This subject has a single chapter so far — more are on the way."
                  />
                )}
              </section>
            </div>
          ) : resourcesQuery.loading ? (
            <SkeletonList count={4} label="Loading resources" />
          ) : resourcesQuery.error ? (
            <ErrorState title="We could not load the resources" onRetry={resourcesQuery.refetch} />
          ) : (
            <div ref={bodyRef} className="grid gap-3 sm:grid-cols-2">
              {visibleResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  subjectId={subject.id}
                  onOpen={(item) =>
                    toast({ title: 'Opening resource', description: `${item.title} · ${item.meta}` })
                  }
                />
              ))}
              {!visibleResources.length && (
                <div className="sm:col-span-2">
                  <EmptyState
                    title={resources.length ? 'Nothing filed here yet' : 'No resources for this chapter'}
                    description={
                      resources.length
                        ? 'Resources are built per chapter — try another tab.'
                        : 'Notes, PYQs and formula sheets will appear here once they are uploaded.'
                    }
                    action={
                      <Button variant="outline" size="sm" onClick={() => setMode('overview')}>
                        Back to overview
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          )}
        </TabPanel>
      </div>

      {/* Prev / next */}
      <nav aria-label="Chapter navigation" className="flex items-center justify-between gap-3 pt-1">
        <Link
          to={`/library/${boardData.id}/${classData.id}/${subject.id}/${subject.chapters[chapter.index - 2]?.slug ?? chapter.slug}`}
          className="min-w-0 flex-1 rounded-control border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          <span className="block truncate">← {subject.chapters[chapter.index - 2]?.title ?? 'First chapter'}</span>
        </Link>
        <Link
          to={`/library/${boardData.id}/${classData.id}/${subject.id}/${subject.chapters[chapter.index]?.slug ?? chapter.slug}`}
          className="min-w-0 flex-1 rounded-control border border-border bg-surface px-3.5 py-2.5 text-right text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          <span className="block truncate">
            {subject.chapters[chapter.index]?.title ?? 'Last chapter'} →
          </span>
        </Link>
      </nav>
    </div>
  )
}
