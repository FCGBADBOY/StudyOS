import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight, Target, Timer, TrendingUp } from 'lucide-react'
import { useBoards, useClasses, useStreams, useSubjects, useStagger } from '@/hooks'
import {
  BackgroundArt,
  Breadcrumb,
  EmptyState,
  ErrorState,
  IconTile,
  Illustration,
  PageHeader,
  ProgressBar,
  SectionHeader,
  Skeleton,
  SkeletonList,
  type Crumb,
} from '@/components/ui'
import type { IllustrationName } from '@/components/ui'
import { subjectAccent } from '@/utils/subject'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

/** Editorial art per subject — decorative, never load-bearing. */
const SUBJECT_ART: Record<string, IllustrationName> = {
  physics: 'target',
  chemistry: 'molecule',
  mathematics: 'formula',
  english: 'book',
  'computer-science': 'notebook',
}

/** Class → stream (senior classes) + subjects. */
export default function LibraryClassPage() {
  const { board, class: classId } = useParams<{ board: string; class: string }>()
  const gridRef = useStagger<HTMLDivElement>({ step: 45 })

  const boardsQuery = useBoards()
  const classesQuery = useClasses()
  const streamsQuery = useStreams()
  const subjectsQuery = useSubjects({ board, classId })

  const boardData = boardsQuery.data?.find((entry) => entry.id === board)
  const classData = classesQuery.data?.find((entry) => entry.id === classId)
  const streams = streamsQuery.data ?? []
  const subjects = subjectsQuery.data ?? []

  const hierarchyLoading = boardsQuery.loading || classesQuery.loading
  const hierarchyError = boardsQuery.error || classesQuery.error
  const refetchHierarchy = () => {
    if (boardsQuery.error) boardsQuery.refetch()
    if (classesQuery.error) classesQuery.refetch()
  }

  if (hierarchyLoading) {
    return (
      <div className="space-y-8 sm:space-y-10">
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading class…</span>
          <Skeleton className="h-32 w-full rounded-hero" />
          <Skeleton className="h-5 w-52" />
        </div>
        <SkeletonList count={2} label="Loading subjects" />
      </div>
    )
  }

  if (hierarchyError)
    return (
      <ErrorState
        title="We could not load this class"
        illustration="notebook"
        theme="library"
        onRetry={refetchHierarchy}
      />
    )

  if (!boardData || !classData) return <Navigate to="/library" replace />

  const crumbs: Crumb[] = [
    { label: 'Library', to: '/library' },
    { label: boardData.name, to: `/library/${boardData.id}` },
    { label: classData.name },
  ]

  /* The first subject is the one students open most — give it the wide slot. */
  const featuredId = subjects[0]?.id

  return (
    <div className="space-y-8 sm:space-y-10">
      <PageHeader
        eyebrow={boardData.name}
        breadcrumb={<Breadcrumb items={crumbs} />}
        title={classData.name}
        subtitle={classData.description}
        back={`/library/${boardData.id}`}
      />

      {/* Streams — senior classes pick a stream first */}
      {classData.senior && (
        <section aria-labelledby="streams">
          <SectionHeader id="streams" title="Stream" tight />
          {streamsQuery.loading ? (
            <div role="status" aria-live="polite" className="flex flex-wrap gap-2">
              <span className="sr-only">Loading streams…</span>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-36 rounded-full" />
              ))}
            </div>
          ) : streamsQuery.error ? (
            <ErrorState
              title="We could not load the streams"
              illustration="journey"
              theme="library"
              compact
              onRetry={streamsQuery.refetch}
            />
          ) : !streams.length ? (
            <EmptyState
              compact
              title="No streams yet"
              description="Stream options appear here once this class offers more than one track."
              illustration="journey"
              theme="library"
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {streams.map((stream) => {
                  const active = stream.id === 'science'
                  return (
                    <button
                      key={stream.id}
                      type="button"
                      disabled={!active}
                      aria-pressed={active}
                      onClick={() => undefined}
                      className={cn(
                        'inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-colors duration-150',
                        'focus-visible:ring-2 focus-visible:ring-brand-ring',
                        active
                          ? 'bg-brand text-brand-fg shadow-card'
                          : 'cursor-not-allowed bg-surface-muted text-faint opacity-70',
                      )}
                    >
                      {stream.name}
                      <span className="tabular text-[12px] opacity-80">
                        {stream.subjects.length} subjects
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-[12.5px] text-faint">
                Science is active for this demo dataset. Commerce and Humanities ship with the full curriculum in the
                next content drop.
              </p>
            </>
          )}
        </section>
      )}

      {/* Subjects */}
      <section aria-labelledby="subjects">
        <SectionHeader
          id="subjects"
          eyebrow="Subjects"
          title="Study a subject"
          subtitle={`${subjects.length} subjects in ${classData.name}`}
        />

        {subjectsQuery.loading ? (
          <SkeletonList count={4} label="Loading subjects" />
        ) : subjectsQuery.error ? (
          <ErrorState
            title="We could not load the subjects"
            illustration="notebook"
            theme="library"
            onRetry={subjectsQuery.refetch}
          />
        ) : !subjects.length ? (
          <EmptyState
            title="No subjects yet"
            description={`The full syllabus for ${classData.name} is being mapped chapter-by-chapter. Class 12 Science is complete and ready.`}
            illustration="graduation"
            theme="library"
            action={
              classId !== 'class-12' ? (
                <Link
                  to={`/library/${boardData.id}/class-12`}
                  className="inline-flex h-11 items-center rounded-control bg-brand px-4 text-sm font-semibold text-brand-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  Open Class 12
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div ref={gridRef} className="grid gap-3 sm:grid-cols-2">
            {subjects.map((subject) => {
              const accent = subjectAccent(subject.id)
              const featured = subject.id === featuredId
              const art = SUBJECT_ART[subject.id] ?? 'graduation'

              return (
                <Link
                  key={subject.id}
                  to={`/library/${boardData.id}/${classData.id}/${subject.id}`}
                  className={cn(
                    'group relative isolate flex items-start gap-3.5 overflow-hidden rounded-card bg-surface p-4 shadow-card outline-none',
                    'transition-shadow duration-150 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring sm:gap-4 sm:p-5',
                    featured && 'sm:col-span-2 sm:p-6',
                  )}
                >
                  {featured && (
                    <BackgroundArt theme={accent.theme} intensity="faint" variant="corner" />
                  )}

                  <div className="relative flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <IconTile
                      icon={
                        <span className={cn('font-extrabold', featured ? 'text-base' : 'text-[13px]')}>
                          {subject.short}
                        </span>
                      }
                      theme={accent.theme}
                      variant={featured ? 'filled' : 'gradient'}
                      size={featured ? 'xl' : 'lg'}
                      glow={featured}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-[15px] font-semibold text-foreground sm:text-base">
                          {subject.name}
                        </h3>
                        <ChevronRight
                          aria-hidden
                          className="h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                        />
                      </div>
                      <p className="clamp-2 mt-1 text-[13px] leading-snug text-muted">
                        {subject.description}
                      </p>

                      <div className={cn('mt-3.5', accent.text)}>
                        <ProgressBar
                          value={subject.progress}
                          size="sm"
                          variant="current"
                          valueText={`${subject.progress}%`}
                          label={`${subject.completedChapters}/${subject.totalChapters} chapters`}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-faint">
                        <span className="inline-flex items-center gap-1">
                          <Target aria-hidden className="h-3.5 w-3.5" />
                          <span className="tabular">{subject.questionCount.toLocaleString('en-IN')} questions</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp aria-hidden className="h-3.5 w-3.5" />
                          <span className="tabular">{subject.accuracy}% accuracy</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Timer aria-hidden className="h-3.5 w-3.5" />
                          {formatDuration(subject.revisionMinutes)} revision
                        </span>
                      </div>
                    </div>

                    {featured && (
                      <Illustration
                        name={art}
                        theme={accent.theme}
                        decorative
                        className="hidden w-40 shrink-0 self-center sm:block lg:w-52"
                      />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
