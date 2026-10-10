import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight, GraduationCap, Library } from 'lucide-react'
import { useBoards, useClasses, useStagger } from '@/hooks'
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
import { cn } from '@/utils/cn'

/** Board → classes. Senior classes link on to the stream/subject picker. */
export default function LibraryBoardPage() {
  const { board } = useParams<{ board: string }>()
  const gridRef = useStagger<HTMLDivElement>({ step: 45 })

  const boardsQuery = useBoards()
  const classesQuery = useClasses()

  const boardData = boardsQuery.data?.find((entry) => entry.id === board)
  const classes = classesQuery.data ?? []

  if (boardsQuery.loading) {
    return (
      <div className="space-y-7 sm:space-y-9">
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading board…</span>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <SkeletonList count={3} label="Loading classes" />
      </div>
    )
  }

  if (boardsQuery.error)
    return <ErrorState title="We could not load this board" onRetry={boardsQuery.refetch} />

  if (!boardData) return <Navigate to="/library" replace />

  const crumbs: Crumb[] = [
    { label: 'Library', to: '/library' },
    { label: boardData.name },
  ]

  return (
    <div className="space-y-7 sm:space-y-9">
      <PageHeader
        breadcrumb={<Breadcrumb items={crumbs} />}
        title={boardData.name}
        subtitle={boardData.description}
        actions={<span className="hidden text-sm font-medium text-muted sm:block tabular">{boardData.resourceCount.toLocaleString('en-IN')} resources</span>}
      />

      <section aria-labelledby="classes">
        <h2 id="classes" className="mb-3 text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          Choose a class
        </h2>
        {classesQuery.loading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading classes…</span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-40" />
              ))}
            </div>
          </div>
        ) : classesQuery.error ? (
          <ErrorState title="We could not load the classes" onRetry={classesQuery.refetch} />
        ) : !classes.length ? (
          <EmptyState
            title="No classes yet"
            description="Classes appear here as soon as this board’s syllabus is mapped."
          />
        ) : (
          <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((option) => {
              const isClass12 = option.id === 'class-12'
              const done = isClass12 ? 58 : option.id === 'class-11' ? 12 : 0
              return (
                <Link
                  key={option.id}
                  to={`/library/${boardData.id}/${option.id}`}
                  className={cn(
                    'group flex items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-card outline-none',
                    'transition-colors duration-150 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand-ring sm:p-5',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-11 w-11 shrink-0 place-items-center rounded-tile',
                      isClass12 ? 'bg-brand text-brand-fg' : 'bg-surface-muted text-muted',
                    )}
                  >
                    <GraduationCap aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-[15px] font-semibold text-foreground">{option.name}</h3>
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                      />
                    </div>
                    <p className="mt-1 text-[13px] leading-snug text-muted">{option.description}</p>
                    <div className="mt-3">
                      <ProgressBar
                        value={done}
                        size="xs"
                        label={done ? 'Syllabus covered' : 'Not started'}
                        valueText={done ? `${done}%` : '—'}
                      />
                    </div>
                    {isClass12 && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand">
                        <Library aria-hidden className="h-3.5 w-3.5" />
                        5 subjects · 51 chapters mapped
                      </p>
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
