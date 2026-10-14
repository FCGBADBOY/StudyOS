import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, GraduationCap, Library, Search } from 'lucide-react'
import { useBoards, useDashboard, useSubjects, useStagger } from '@/hooks'
import { useApp } from '@/context/AppProvider'
import {
  BackgroundArt,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconTile,
  Illustration,
  Input,
  ProgressBar,
  SectionHeader,
  Skeleton,
  SkeletonList,
} from '@/components/ui'
import type { IllustrationName } from '@/components/ui'
import { subjectAccent } from '@/utils/subject'
import type { ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

/**
 * Library root: pick a board, or resume something you were already reading.
 *
 * Three visual weights, so the eye can tell them apart instantly: an editorial
 * hero that carries the search, a grid of white board tiles that are choices,
 * and a warm cream band for the thing you were already reading.
 */

/** Boards are peers — rotating the theme keeps the grid from reading as one block. */
const BOARD_THEMES: ThemeKey[] = ['library', 'exam', 'notes', 'planner', 'progress']

/** Decorative watermark behind each board tile. Never load-bearing. */
const BOARD_ART: IllustrationName[] = ['graduation', 'book', 'paper', 'journey', 'notebook']

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
    <div className="space-y-8 sm:space-y-10">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — masthead, subtitle and the two ways in                     */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="library-title"
        className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card"
      >
        <BackgroundArt theme="library" geometry intensity="subtle" />
        <span
          aria-hidden
          className="pattern-dots pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-[0.3]"
        />

        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:p-9">
          <div className="min-w-0">
            <p className="eyebrow">StudyOS</p>
            <h1
              id="library-title"
              className="text-display mt-2 text-[30px] leading-[1.02] text-foreground sm:text-[38px]"
            >
              Library
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
              Notes, PYQs, sample papers and formula sheets — organised board by board.
            </p>

            {/* Live filter — the fastest route into a board, class or chapter. */}
            <div className="mt-5 flex flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <label htmlFor="library-filter" className="sr-only">
                  Filter boards and chapters
                </label>
                <Input
                  id="library-filter"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter boards, classes or chapters…"
                  autoComplete="off"
                  icon={<Search />}
                />
              </div>
              <span className="hidden sm:block">
                <Button variant="outline" icon={<Search />} onClick={openSearch}>
                  Search library
                </Button>
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[280px] lg:max-w-none">
            <Illustration name="desk" theme="library" decorative className="w-full" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Boards                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="boards">
        <SectionHeader
          id="boards"
          eyebrow="Curricula"
          title="Choose your board"
          subtitle={`${allBoards.length} curricula · ${resourceCount.toLocaleString('en-IN')} resources indexed`}
        />
        {boardsQuery.loading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading boards…</span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-36 rounded-card" />
              ))}
            </div>
          </div>
        ) : boardsQuery.error ? (
          <ErrorState
            title="We could not load the boards"
            illustration="notebook"
            theme="library"
            onRetry={boardsQuery.refetch}
          />
        ) : !allBoards.length ? (
          <EmptyState
            title="No boards yet"
            description="Curricula show up here as soon as they are published — check back shortly."
            illustration="graduation"
            theme="library"
          />
        ) : (
          <>
            <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((board, index) => {
                const theme = BOARD_THEMES[index % BOARD_THEMES.length]
                return (
                  <Link
                    key={board.id}
                    to={`/library/${board.id}`}
                    className={cn(
                      'group relative isolate flex items-start gap-3.5 overflow-hidden rounded-card bg-surface p-4 shadow-card outline-none',
                      'transition-shadow duration-150 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring sm:gap-4 sm:p-5',
                    )}
                  >
                    <Illustration
                      name={BOARD_ART[index % BOARD_ART.length]}
                      theme={theme}
                      decorative
                      className="pointer-events-none absolute -bottom-6 -right-6 w-32 opacity-[0.16]"
                    />
                    <IconTile icon={<GraduationCap />} theme={theme} variant="gradient" size="lg" />
                    <div className="relative min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                          {board.name}
                        </h3>
                        <ChevronRight
                          aria-hidden
                          className="h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                        />
                      </div>
                      <p className="clamp-2 mt-1 text-[13px] leading-snug text-muted">
                        {board.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{board.classCount} classes</Badge>
                        <Badge theme={theme} dot>
                          {board.resourceCount.toLocaleString('en-IN')} resources
                        </Badge>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {!boards.length && (
              <EmptyState
                title={`No boards match “${query}”`}
                description="Try a shorter word — or search straight into chapters below."
                illustration="empty"
                theme="search"
                action={
                  <Button variant="primary" size="sm" onClick={() => setQuery('')}>
                    Clear filter
                  </Button>
                }
              />
            )}
          </>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Chapter quick results while filtering                              */}
      {/* ---------------------------------------------------------------- */}
      {showChapterHits && (
        <section aria-labelledby="chapter-hits">
          <SectionHeader
            id="chapter-hits"
            eyebrow="Matches"
            title="Chapters"
            subtitle="Matching your filter"
          />
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
              illustration="notebook"
              theme="library"
              compact
              onRetry={subjectsQuery.refetch}
            />
          ) : (
            <Card padded={false} className="divide-y divide-border overflow-hidden">
              {chapterMatches.map(({ subject, chapter }) => {
                const accent = subjectAccent(subject.id)
                return (
                  <Link
                    key={chapter.id}
                    to={`/library/cbse/class-12/${subject.id}/${chapter.slug}`}
                    className="flex items-center gap-3 px-3.5 py-3.5 outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:-ring-inset sm:px-4"
                  >
                    <IconTile
                      icon={
                        <span className="tabular text-[11px] font-extrabold">
                          {String(chapter.index).padStart(2, '0')}
                        </span>
                      }
                      theme={accent.theme}
                      variant="soft"
                      size="xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {chapter.title}
                      </span>
                      <span className="block text-[12px] text-faint">{subject.name}</span>
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                  </Link>
                )
              })}
            </Card>
          )}
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Resume reading — a warmer band, deliberately different from the grid */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="resume"
        className="rounded-hero bg-cream p-4 shadow-card sm:p-5 lg:p-6"
      >
        <SectionHeader
          id="resume"
          eyebrow="Resume"
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
          <ErrorState
            title="We could not load your progress"
            illustration="notebook"
            theme="library"
            onRetry={dashboardQuery.refetch}
          />
        ) : !continueStudying.length ? (
          <EmptyState
            title="Nothing to continue yet"
            description="Open a chapter from any board and it will wait for you here until it is finished."
            illustration="book"
            theme="library"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {continueStudying.map((item) => {
              const accent = subjectAccent(item.subjectId)
              return (
                <Link
                  key={item.id}
                  to={`/library/cbse/class-12/${item.subjectId}/${item.chapterSlug}`}
                  className={cn(
                    'group rounded-card bg-surface p-4 shadow-card outline-none transition-shadow duration-150',
                    'hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <IconTile
                      icon={
                        <span className="text-[13px] font-extrabold">
                          {item.subjectName.slice(0, 2)}
                        </span>
                      }
                      theme={accent.theme}
                      variant="gradient"
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-snug text-foreground">
                            {item.chapter}
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-muted">
                            {item.subjectName} · {item.lastStudied}
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden
                          className="mt-1 h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                        />
                      </div>
                      {/* Subject-hued fill so the bar reads as "this subject". */}
                      <div className={cn('mt-3', accent.text)}>
                        <ProgressBar
                          value={item.progress}
                          size="sm"
                          variant="current"
                          valueText={`${item.progress}%`}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Offline hint                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Card padded tone="cream" className="flex items-start gap-3">
        <IconTile icon={<Library />} theme="notes" size="sm" />
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
