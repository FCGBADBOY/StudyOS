import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight, Target, Timer, TrendingUp } from 'lucide-react'
import { useBoards, useClasses, useStreams, useSubjects, useStagger } from '@/hooks'
import {
  Breadcrumb,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  Skeleton,
  SkeletonList,
  type Crumb,
} from '@/components/ui'
import { subjectAccent } from '@/utils/subject'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

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
      <div className="space-y-7 sm:space-y-9">
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading class…</span>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-5 w-52" />
        </div>
        <SkeletonList count={2} label="Loading subjects" />
      </div>
    )
  }

  if (hierarchyError)
    return <ErrorState title="We could not load this class" onRetry={refetchHierarchy} />

  if (!boardData || !classData) return <Navigate to="/library" replace />

  const crumbs: Crumb[] = [
    { label: 'Library', to: '/library' },
    { label: boardData.name, to: `/library/${boardData.id}` },
    { label: classData.name },
  ]

  return (
    <div className="space-y-7 sm:space-y-9">
      <PageHeader
        breadcrumb={<Breadcrumb items={crumbs} />}
        title={classData.name}
        subtitle={classData.description}
        back={`/library/${boardData.id}`}
      />

      {/* Streams — senior classes pick a stream first */}
      {classData.senior && (
        <section aria-labelledby="streams">
          <h2 id="streams" className="mb-3 text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
            Stream
          </h2>
          {streamsQuery.loading ? (
            <div role="status" aria-live="polite" className="flex flex-wrap gap-2">
              <span className="sr-only">Loading streams…</span>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-36 rounded-full" />
              ))}
            </div>
          ) : streamsQuery.error ? (
            <ErrorState
              title="We could not load the streams"
              compact
              onRetry={streamsQuery.refetch}
            />
          ) : !streams.length ? (
            <EmptyState
              compact
              title="No streams yet"
              description="Stream options appear here once this class offers more than one track."
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
                        'rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors duration-150',
                        'focus-visible:ring-2 focus-visible:ring-brand-ring',
                        active
                          ? 'border-brand bg-brand-soft text-brand-soft-fg'
                          : 'cursor-not-allowed border-border bg-surface text-faint opacity-70',
                      )}
                    >
                      {stream.name}
                      <span className="ml-2 text-[12px] opacity-80">{stream.subjects.length} subjects</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[12.5px] text-faint">
                Science is active for this demo dataset. Commerce and Humanities ship with the full curriculum in the
                next content drop.
              </p>
            </>
          )}
        </section>
      )}

      {/* Subjects */}
      <section aria-labelledby="subjects">
        <h2 id="subjects" className="mb-3 text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          Subjects
        </h2>

        {subjectsQuery.loading ? (
          <SkeletonList count={4} label="Loading subjects" />
        ) : subjectsQuery.error ? (
          <ErrorState title="We could not load the subjects" onRetry={subjectsQuery.refetch} />
        ) : !subjects.length ? (
          <EmptyState
            title="No subjects yet"
            description={`The full syllabus for ${classData.name} is being mapped chapter-by-chapter. Class 12 Science is complete and ready.`}
            action={
              classId !== 'class-12' ? (
                <Link
                  to={`/library/${boardData.id}/class-12`}
                  className="rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
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
              return (
                <Link
                  key={subject.id}
                  to={`/library/${boardData.id}/${classData.id}/${subject.id}`}
                  className={cn(
                    'group rounded-card border border-border bg-surface p-4 shadow-card outline-none transition-colors duration-150',
                    'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand-ring sm:p-5',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-tile text-sm font-bold',
                        accent.soft,
                        accent.text,
                      )}
                    >
                      {subject.short}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-[15px] font-semibold text-foreground">{subject.name}</h3>
                        <ChevronRight
                          aria-hidden
                          className="h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                        />
                      </div>
                      <p className="mt-1 clamp-2 text-[13px] leading-snug text-muted">{subject.description}</p>

                      <div className="mt-3">
                        <ProgressBar
                          value={subject.progress}
                          size="sm"
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
