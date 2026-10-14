import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarRange, ChevronRight, FileText, Repeat, ScanLine } from 'lucide-react'
import type { PyqDifficulty } from '@/types'
import {
  BackgroundArt,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  IconTile,
  Illustration,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  SkeletonList,
} from '@/components/ui'
import { ConceptCard } from '@/components/ConceptCard'
import { useCountUp, usePyqOverview, usePyqPapers, useReveal, useStagger, useSubjects } from '@/hooks'
import { animateBar } from '@/animations'
import { subjectAccent } from '@/utils/subject'
import { themeColors } from '@/config/visual'
import { cn } from '@/utils/cn'

/* --------------------------------- static --------------------------------- */

/** Chapter frequency is charted against a 150-question ceiling. */
const CHAPTER_CEILING = 150

/** Recent papers list on the home screen. */
const RECENT_PAPERS = 5

const SLICE_TONE: Record<PyqDifficulty, string> = {
  Easy: 'bg-success',
  Medium: 'bg-warning',
  Hard: 'bg-danger',
}

/** Accent handles for the archive's own identity. */
const PYQ_COLORS = themeColors('pyq')

interface HeroStat {
  label: string
  hint: string
  icon: ReactNode
  value: RefObject<HTMLSpanElement | null>
}

/** The first render happens before a query subscribes — read it as loading. */
function isPending(query: { data: unknown; error: string | null; source: string | undefined }): boolean {
  return query.data === undefined && !query.error && !query.source
}

/* ---------------------------------- page ---------------------------------- */

export default function PyqHomePage() {
  const navigate = useNavigate()

  /* data layer — every panel below reads from the service, never from mocks */
  const overviewQuery = usePyqOverview()
  const papersQuery = usePyqPapers()
  const subjectsQuery = useSubjects()

  const overview = overviewQuery.data
  const difficulty = useMemo(() => overview?.difficulty ?? [], [overview])
  const topConcepts = useMemo(
    () =>
      overview
        ? [...overview.topConcepts].sort((a, b) => b.appearances - a.appearances).slice(0, 5)
        : [],
    [overview],
  )
  const recentPapers = useMemo(
    () => (papersQuery.data ?? []).slice(0, RECENT_PAPERS),
    [papersQuery.data],
  )
  const questionsAnalyzed = overview?.questionsAnalyzed ?? 0

  /* subject names + chapter totals, resolved from the academic service */
  const subjectLookup = useMemo(() => {
    const map = new Map<string, { name: string; totalChapters?: number }>()
    overview?.subjectStats.forEach((stat) =>
      map.set(stat.subjectId, { name: stat.subjectName }),
    )
    subjectsQuery.data?.forEach((subject) =>
      map.set(subject.id, { name: subject.name, totalChapters: subject.totalChapters }),
    )
    return map
  }, [overview, subjectsQuery.data])

  /* hero counters — each element starts at 0 and ticks to its target */
  const questionsRef = useCountUp<HTMLSpanElement>(questionsAnalyzed)
  const papersRef = useCountUp<HTMLSpanElement>(overview?.papersScanned ?? 0, { delay: 80 })
  const yearsRef = useCountUp<HTMLSpanElement>(overview?.yearsCovered ?? 0, { delay: 160 })
  const repeatRef = useCountUp<HTMLSpanElement>(overview?.repeatRate ?? 0, {
    delay: 240,
    suffix: '%',
  })

  /* entrance motion */
  const statsRef = useStagger<HTMLDivElement>({ step: 60, distance: 16 })
  const legendRef = useStagger<HTMLUListElement>({ step: 70, distance: 10 })
  const conceptsRef = useReveal<HTMLElement>({ selector: '[data-reveal]' })
  const chaptersRef = useReveal<HTMLElement>({ selector: '[data-reveal]' })
  const subjectsRef = useReveal<HTMLElement>({ selector: '[data-reveal]' })
  const papersSectionRef = useReveal<HTMLElement>({ selector: '[data-reveal]' })

  /* difficulty segments grow left → right */
  const sliceRefs = useRef<Array<HTMLDivElement | null>>([])

  useLayoutEffect(() => {
    if (!difficulty.length) return
    const cleanups = difficulty.map((slice, index) =>
      animateBar(sliceRefs.current[index], slice.value, { delay: 120 + index * 130 }),
    )
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [difficulty])

  const heroStats: HeroStat[] = [
    {
      label: 'Questions analyzed',
      hint: 'Tagged item by item against the syllabus',
      icon: <ScanLine />,
      value: questionsRef,
    },
    {
      label: 'Papers scanned',
      hint: 'Across five Class 12 subjects and every set',
      icon: <FileText />,
      value: papersRef,
    },
    {
      label: 'Years covered',
      hint: 'Consecutive CBSE board exam sessions',
      icon: <CalendarRange />,
      value: yearsRef,
    },
    {
      label: 'Repeat rate',
      hint: 'Questions that come back near-verbatim',
      icon: <Repeat />,
      value: repeatRef,
    },
  ]

  const difficultySummary = difficulty
    .map((slice) => `${slice.label} ${slice.value}%`)
    .join(', ')

  /* ---------------------------------------------------------------------- */
  /* Header — an editorial hero band with the four ticking counters.         */
  /* Rendered in every state so loading and error screens keep their frame.  */
  /* ---------------------------------------------------------------------- */
  const header = (
    <section
      aria-labelledby="pyq-hero"
      className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card"
    >
      <BackgroundArt theme="pyq" geometry intensity="subtle" />
      <span
        aria-hidden
        className="pattern-grid pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 opacity-60 sm:block"
      />

      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="eyebrow">Exam analysis</p>
            <h1
              id="pyq-hero"
              className="text-display mt-2 text-[30px] leading-[1.0] text-foreground sm:text-[40px] lg:text-[46px]"
            >
              PYQ{' '}
              <span className="text-brand">INTELLIGENCE.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              15 years of CBSE papers, decomposed into what actually repeats.
            </p>
            <div className="mt-4">
              <Badge theme="pyq" size="md" dot>
                Class 12 · CBSE
              </Badge>
            </div>
          </div>

          <div className="hidden w-[200px] shrink-0 sm:block lg:w-[260px]">
            <Illustration name="paper" theme="pyq" decorative />
          </div>
        </div>

        <section aria-label="PYQ corpus at a glance" className="mt-7">
          <div ref={statsRef} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-card bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <p className="eyebrow min-w-0">{stat.label}</p>
                  <span
                    aria-hidden
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-tile [&_svg]:h-4 [&_svg]:w-4',
                      PYQ_COLORS.soft,
                      PYQ_COLORS.onSoft,
                    )}
                  >
                    {stat.icon}
                  </span>
                </div>
                <p className="mt-3">
                  <span
                    ref={stat.value}
                    className="tabular text-[30px] font-extrabold leading-none text-foreground"
                  >
                    0
                  </span>
                </p>
                <p className="mt-2 text-[12px] leading-snug text-muted">{stat.hint}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )

  /* -------------------------------- states -------------------------------- */

  if (overviewQuery.loading || isPending(overviewQuery)) {
    return (
      <div className="space-y-6 sm:space-y-8">
        {header}
        <SkeletonList count={4} label="Loading PYQ intelligence" />
      </div>
    )
  }

  if (overviewQuery.error && !overview) {
    return (
      <div className="space-y-6 sm:space-y-8">
        {header}
        <ErrorState
          title="We could not load PYQ intelligence"
          description="The question archive did not respond. Check your connection and try again."
          onRetry={overviewQuery.refetch}
          illustration="paper"
          theme="pyq"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {header}

      {/* ------------------------ difficulty distribution ----------------------- */}
      <section aria-labelledby="difficulty-heading">
        <SectionHeader
          id="difficulty-heading"
          eyebrow="Paper load"
          title="Difficulty distribution"
          subtitle="How the whole question bank splits by paper load"
        />
        {difficulty.length === 0 ? (
          <EmptyState
            title="Not enough data yet"
            description="Difficulty splits appear once the archive has tagged questions by paper load."
            illustration="paper"
            theme="pyq"
          />
        ) : (
          <Card padded>
            <div
              role="img"
              aria-label={`Difficulty distribution: ${difficultySummary}`}
              className="flex h-4 w-full overflow-hidden rounded-full bg-surface-sunken"
            >
              {difficulty.map((slice, index) => (
                <div
                  key={slice.label}
                  ref={(node) => {
                    sliceRefs.current[index] = node
                  }}
                  className={cn('h-full', SLICE_TONE[slice.label])}
                  style={{ width: '0%' }}
                />
              ))}
            </div>

            <ul ref={legendRef} className="mt-4 grid gap-2 sm:grid-cols-3">
              {difficulty.map((slice) => {
                const count = Math.round((questionsAnalyzed * slice.value) / 100)
                return (
                  <li
                    key={slice.label}
                    className="flex items-center justify-between gap-3 rounded-tile bg-cream px-3 py-2.5 shadow-card"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className={cn('h-2.5 w-2.5 shrink-0 rounded-full', SLICE_TONE[slice.label])}
                      />
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {slice.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-[13px] font-bold text-foreground">
                        {slice.value}%
                      </span>
                      <span className="tabular block text-[11px] text-faint">
                        ≈{count.toLocaleString('en-IN')} questions
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>

      {/* ---------------------------- most repeated ---------------------------- */}
      <section ref={conceptsRef} aria-labelledby="concepts-heading">
        <SectionHeader
          id="concepts-heading"
          eyebrow="Repeats"
          title="Most repeated concepts"
          subtitle="Ranked by appearances across the full archive"
        />
        {topConcepts.length === 0 ? (
          <EmptyState
            title="No repeated concepts yet"
            description="Concept groups appear once questions share the same tags across years."
            illustration="paper"
            theme="pyq"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topConcepts.map((concept) => (
              <div key={concept.id} data-reveal className="h-full">
                <ConceptCard
                  concept={concept}
                  className="h-full"
                  onOpen={() => navigate(`/pyq/${concept.subjectId}`)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------- frequent chapters -------------------------- */}
      <section ref={chaptersRef} aria-labelledby="chapters-heading">
        <SectionHeader
          id="chapters-heading"
          eyebrow="Frequency by chapter"
          title="Most frequent chapters"
          subtitle={`Question volume measured against a ${CHAPTER_CEILING}-question ceiling`}
        />
        {!overview || overview.frequentChapters.length === 0 ? (
          <EmptyState
            title="Not enough data yet"
            description="Chapter frequency shows up once the archive has questions filed against the syllabus."
            illustration="paper"
            theme="pyq"
          />
        ) : (
          <ul className="space-y-3">
            {overview.frequentChapters.map((entry) => {
              const accent = subjectAccent(entry.subjectId)
              const percent = Math.min(
                100,
                Math.round((entry.count / CHAPTER_CEILING) * 100),
              )
              return (
                <li key={entry.chapter} data-reveal>
                  <Card padded className="relative overflow-hidden pl-5 sm:pl-6">
                    <span
                      aria-hidden
                      className={cn('absolute inset-y-0 left-0 w-1.5', accent.solid)}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {entry.chapter}
                        </p>
                        <p className={cn('mt-0.5 truncate text-[12px] font-medium', accent.text)}>
                          {subjectLookup.get(entry.subjectId)?.name ?? entry.subjectId}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="tabular block text-lg font-bold leading-none text-foreground">
                          {entry.count}
                        </span>
                        <span className="mt-1 block text-[11px] text-faint">questions</span>
                      </div>
                    </div>
                    <div className={cn('mt-3', accent.text)}>
                      <ProgressBar
                        value={percent}
                        size="sm"
                        variant="current"
                        valueText={`${percent}%`}
                        label={`${entry.chapter} share`}
                      />
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------ by subject ----------------------------- */}
      <section ref={subjectsRef} aria-labelledby="subjects-heading">
        <SectionHeader
          id="subjects-heading"
          eyebrow="Frequency by subject"
          title="By subject"
          subtitle="Volume, syllabus coverage and how much repeats"
        />
        {!overview || overview.subjectStats.length === 0 ? (
          <EmptyState
            title="Not enough data yet"
            description="Per-subject analysis appears once questions are linked to their subjects."
            illustration="paper"
            theme="pyq"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.subjectStats.map((stat) => {
              const accent = subjectAccent(stat.subjectId)
              const totalChapters =
                subjectLookup.get(stat.subjectId)?.totalChapters ?? stat.chaptersCovered
              return (
                <Link
                  key={stat.subjectId}
                  to={`/pyq/${stat.subjectId}`}
                  data-reveal
                  className="group block h-full rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  <Card padded className="h-full transition-shadow group-hover:shadow-raised">
                    <div className="flex items-start justify-between gap-3">
                      <Badge theme={accent.theme} uppercase dot>
                        {stat.subjectName}
                      </Badge>
                      <div className="flex shrink-0 flex-col items-center">
                        <ProgressRing
                          value={stat.repeatRate}
                          size={64}
                          stroke={6}
                          color={themeColors(accent.theme).accentVar}
                          label={`${stat.subjectName} repeat rate`}
                        >
                          <span className="tabular text-[12px] font-bold text-foreground">
                            {stat.repeatRate}%
                          </span>
                        </ProgressRing>
                        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
                          repeat
                        </span>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <dt className="eyebrow">Questions</dt>
                        <dd className="tabular mt-1 text-xl font-bold text-foreground">
                          {stat.questions.toLocaleString('en-IN')}
                        </dd>
                      </div>
                      <div>
                        <dt className="eyebrow">Chapters</dt>
                        <dd className="tabular mt-1 text-xl font-bold text-foreground">
                          {stat.chaptersCovered}
                          <span className="text-sm font-semibold text-faint">/{totalChapters}</span>
                        </dd>
                      </div>
                    </dl>

                    <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand">
                      Open analysis
                      <ChevronRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ---------------------------- recent papers ---------------------------- */}
      <section ref={papersSectionRef} aria-labelledby="recent-papers-heading">
        <SectionHeader
          id="recent-papers-heading"
          eyebrow="Exam papers"
          title="Recent papers"
          subtitle="Full papers with section breakdowns and solutions"
        />
        {papersQuery.loading || isPending(papersQuery) ? (
          <SkeletonList count={2} label="Loading recent papers" />
        ) : papersQuery.error && !papersQuery.data ? (
          <ErrorState
            title="We could not load recent papers"
            description="The paper archive did not respond. Check your connection and try again."
            onRetry={papersQuery.refetch}
            illustration="paper"
            theme="pyq"
          />
        ) : recentPapers.length === 0 ? (
          <EmptyState
            title="No papers in the archive yet"
            description="Full papers appear here as soon as they are scanned into the bank."
            illustration="paper"
            theme="pyq"
          />
        ) : (
          <ul className="space-y-3">
            {recentPapers.map((paper) => {
              const accent = subjectAccent(paper.subjectId)
              return (
                <li key={paper.id} data-reveal>
                  <Link
                    to={`/pyq/${paper.subjectId}/${paper.slug}`}
                    className="block rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  >
                    <Card padded className="flex items-center gap-3 transition-shadow hover:shadow-raised">
                      <IconTile
                        icon={<FileText />}
                        theme={accent.theme}
                        variant="gradient"
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge theme={accent.theme} uppercase className="tabular">
                            {paper.year}
                          </Badge>
                          <Badge variant="neutral">{paper.set}</Badge>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
                          {paper.subjectName}
                        </p>
                        <p className={cn('mt-0.5 truncate text-[12px]', accent.text)}>
                          {paper.board} · {paper.duration} · {paper.sections.length} sections
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="tabular block text-lg font-bold leading-none text-foreground">
                          {paper.marks}
                        </span>
                        <span className="mt-1 block text-[11px] text-faint">marks</span>
                      </div>
                      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
