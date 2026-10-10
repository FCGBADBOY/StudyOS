import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, GraduationCap, Library, Search } from 'lucide-react'
import { useBoards, useDashboard, useSubjects, useStagger } from '@/hooks'
import { useApp } from '@/context/AppProvider'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  SectionHeader,
  Skeleton,
  SkeletonList,
} from '@/components/ui'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

/**
 * Library root: pick a board, or resume something you were already reading.
 */
export default function LibraryPage() {
  const navigate = useNavigate()
  const { openSearch, toast } = useApp()
  const gridRef = useStagger<HTMLDivElement>({ step: 45 })
  const [query, setQuery] = useState('')

  const boardsQuery = useBoards()
  const subjectsQuery = useSubjects()
  const dashboardQuery = useDashboard()

  const allBoards = boardsQuery.data ?? []
  const subjects = subjectsQuery.data ?? []
  const continueStudying = dashboardQuery.data?.continueStudying ?? []

  const boards = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if (!clean) return allBoards
    return allBoards.filter((board) =>
      `${board.name} ${board.description}`.toLowerCase().includes(clean),
    )
  }, [allBoards, query])

  const chapterMatches = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if (!clean) return []
    return subjects
      .flatMap((subject) => subject.chapters.map((chapter) => ({ subject, chapter })))
      .filter((row) => row.chapter.title.toLowerCase().includes(clean))
      .slice(0, 5)
  }, [subjects, query])

  const resourceCount = useMemo(
    () => allBoards.reduce((total, board) => total + board.resourceCount, 0),
    [allBoards],
  )

  /* Chapter quick results only matter while a filter is typed in. */
  const showChapterHits =
    Boolean(query.trim()) &&
    (subjectsQuery.loading || Boolean(subjectsQuery.error) || chapterMatches.length > 0)

  return (
    <div className="space-y-7 sm:space-y-9">
      <PageHeader
        title="Library"
        subtitle="Notes, PYQs, sample papers and formula sheets — organised board by board."
        actions={
          <button
            type="button"
            onClick={openSearch}
            className="hidden rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground sm:inline-flex"
          >
            <Search aria-hidden className="mr-1.5 inline h-4 w-4" />
            Search library
          </button>
        }
      />

      {/* Live filter */}
      <div className="sm:max-w-lg">
        <label htmlFor="library-filter" className="sr-only">
          Filter boards and chapters
        </label>
        <input
          id="library-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter boards, classes or chapters…"
          autoComplete="off"
          className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-brand"
        />
      </div>

      {/* Boards */}
      <section aria-labelledby="boards">
        <SectionHeader
          id="boards"
          title="Choose your board"
          subtitle={`${allBoards.length} curricula · ${resourceCount.toLocaleString('en-IN')} resources indexed`}
        />
        {boardsQuery.loading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading boards…</span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-32" />
              ))}
            </div>
          </div>
        ) : boardsQuery.error ? (
          <ErrorState title="We could not load the boards" onRetry={boardsQuery.refetch} />
        ) : !allBoards.length ? (
          <EmptyState
            title="No boards yet"
            description="Curricula show up here as soon as they are published — check back shortly."
          />
        ) : (
          <>
            <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  to={`/library/${board.id}`}
                  className={cn(
                    'group flex items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-card outline-none',
                    'transition-colors duration-150 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand-ring sm:p-5',
                  )}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg">
                    <GraduationCap aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-[15px] font-semibold text-foreground">{board.name}</h3>
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                      />
                    </div>
                    <p className="mt-1 clamp-2 text-[13px] leading-snug text-muted">{board.description}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{board.classCount} classes</Badge>
                      <Badge variant="brand">{board.resourceCount.toLocaleString('en-IN')} resources</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {!boards.length && (
              <EmptyState
                icon={<Search />}
                title={`No boards match “${query}”`}
                description="Try a shorter word — or search straight into chapters below."
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
            )}
          </>
        )}
      </section>

      {/* Chapter quick results while filtering */}
      {showChapterHits && (
        <section aria-labelledby="chapter-hits">
          <SectionHeader id="chapter-hits" title="Chapters" subtitle="Matching your filter" />
          {subjectsQuery.loading ? (
            <div role="status" aria-live="polite" className="space-y-2">
              <span className="sr-only">Loading chapters…</span>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : subjectsQuery.error ? (
            <ErrorState
              title="We could not search chapters"
              compact
              onRetry={subjectsQuery.refetch}
            />
          ) : (
            <div className="space-y-2">
              {chapterMatches.map(({ subject, chapter }) => {
                const accent = subjectAccent(subject.id)
                return (
                  <Link
                    key={chapter.id}
                    to={`/library/cbse/class-12/${subject.id}/${chapter.slug}`}
                    className="flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 transition-colors hover:border-border-strong"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-tile text-xs font-bold tabular',
                        accent.soft,
                        accent.text,
                      )}
                    >
                      {String(chapter.index).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{chapter.title}</span>
                      <span className="block text-[12px] text-faint">{subject.name}</span>
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Resume reading */}
      <section aria-labelledby="resume">
        <SectionHeader
          id="resume"
          title="Continue reading"
          subtitle="Your four most recent chapters"
          action={
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-[13px] font-semibold text-brand hover:underline"
            >
              Go home
            </button>
          }
        />
        {dashboardQuery.loading ? (
          <SkeletonList count={2} label="Loading chapters you were reading" />
        ) : dashboardQuery.error ? (
          <ErrorState title="We could not load your progress" onRetry={dashboardQuery.refetch} />
        ) : !continueStudying.length ? (
          <EmptyState
            title="Nothing to continue yet"
            description="Open a chapter from any board and it will wait for you here until it is finished."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {continueStudying.map((item) => {
              const accent = subjectAccent(item.subjectId)
              return (
                <Card key={item.id} padded className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-tile text-xs font-bold', accent.soft, accent.text)}
                  >
                    {item.subjectName.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/library/cbse/class-12/${item.subjectId}/${item.chapterSlug}`}
                      className="truncate text-[15px] font-semibold text-foreground hover:text-brand"
                    >
                      {item.chapter}
                    </Link>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {item.subjectName} · {item.lastStudied}
                    </p>
                    <ProgressBar
                      value={item.progress}
                      size="sm"
                      className="mt-2.5"
                      valueText={`${item.progress}%`}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Offline hint */}
      <Card padded className="flex items-start gap-3 bg-surface-muted">
        <Library aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Downloads stay available offline</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            Anything marked <Badge variant="success">Offline</Badge> opens without a connection — perfect for the
            bus ride to school.
          </p>
          <button
            type="button"
            onClick={() => toast({ title: 'Downloads opened', description: '24 resources are available offline.' })}
            className="mt-2 text-[13px] font-semibold text-brand hover:underline"
          >
            Manage downloads
          </button>
        </div>
      </Card>
    </div>
  )
}
