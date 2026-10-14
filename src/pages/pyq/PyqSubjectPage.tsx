import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ChevronRight, FileText, Repeat } from 'lucide-react'
import type { ConceptFrequency, PyqDifficulty, PyqPaper, PyqQuestion } from '@/types'
import {
  BackgroundArt,
  Badge,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  IconTile,
  IconButton,
  LinkButton,
  PageHeader,
  ProgressBar,
  SectionHeader,
  SkeletonList,
  StatCard,
  TabPanel,
  Tabs,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { ConceptCard } from '@/components/ConceptCard'
import { QuestionCard } from '@/components/QuestionCard'
import { usePyqOverview, usePyqPapers, usePyqQuestions, useStagger, useSubject } from '@/hooks'
import { useToast } from '@/context/AppProvider'
import { subjectAccent } from '@/utils/subject'
import { themeColors, type ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

/* --------------------------------- config --------------------------------- */

type TabId = 'questions' | 'concepts' | 'papers'
type Filter = 'All' | PyqDifficulty

const TAB_ITEMS: TabItem<TabId>[] = [
  { id: 'questions', label: 'Questions' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'papers', label: 'Papers' },
]

const FILTERS: Filter[] = ['All', 'Easy', 'Medium', 'Hard']

const MIX_ORDER: PyqDifficulty[] = ['Easy', 'Medium', 'Hard']

const MIX_TONE: Record<PyqDifficulty, 'success' | 'warning' | 'danger'> = {
  Easy: 'success',
  Medium: 'warning',
  Hard: 'danger',
}

/** How many chapters the frequency panel lists before it truncates. */
const CHAPTER_ROWS = 6

/** Shared async-state props every panel renders the same way. */
interface PanelStateProps {
  loading: boolean
  error: string | null
  onRetry: () => void
}

/** The first render happens before a query subscribes — read it as loading. */
function isPending(query: { data: unknown; error: string | null; source: string | undefined }): boolean {
  return query.data === undefined && !query.error && !query.source
}

/* -------------------------------- questions -------------------------------- */

interface QuestionsPanelProps extends PanelStateProps {
  questions: PyqQuestion[]
  counts: Record<Filter, number>
  filter: Filter
  onFilterChange: (filter: Filter) => void
  onSave: (question: PyqQuestion) => void
  theme: ThemeKey
}

function QuestionsPanel({
  questions,
  counts,
  filter,
  onFilterChange,
  onSave,
  loading,
  error,
  onRetry,
  theme,
}: QuestionsPanelProps) {
  const listRef = useStagger<HTMLDivElement>({ step: 55, distance: 14 })

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Filter questions by difficulty"
        className="flex flex-wrap items-center gap-2"
      >
        {FILTERS.map((entry) => (
          <Chip key={entry} selected={filter === entry} onClick={() => onFilterChange(entry)}>
            {entry}
            <span className="tabular text-[12px] opacity-70">{counts[entry]}</span>
          </Chip>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} label="Loading questions" />
      ) : error ? (
        <ErrorState
          title="We could not load these questions"
          description="The PYQ bank did not respond. Check your connection and try again."
          onRetry={onRetry}
          illustration="paper"
          theme={theme}
        />
      ) : questions.length === 0 ? (
        <EmptyState
          title="No questions match this filter."
          description="Pick another difficulty to see the rest of this subject's PYQ bank."
          illustration="paper"
          theme={theme}
        />
      ) : (
        <div ref={listRef} className="grid gap-3">
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} onSave={onSave} />
          ))}
        </div>
      )}
    </div>
  )
}

/* --------------------------------- concepts -------------------------------- */

function ConceptsPanel({ concepts, loading, error, onRetry }: PanelStateProps & { concepts: ConceptFrequency[] }) {
  const gridRef = useStagger<HTMLDivElement>({ step: 55, distance: 14 })

  if (loading) return <SkeletonList count={3} label="Loading concepts" />

  if (error) {
    return (
      <ErrorState
        title="We could not load concept frequency"
        description="The intelligence views did not respond. Check your connection and try again."
        onRetry={onRetry}
        illustration="paper"
        theme="pyq"
      />
    )
  }

  if (concepts.length === 0) {
    return (
      <EmptyState
        title="No concept frequency data for this subject yet."
        illustration="paper"
        theme="pyq"
      />
    )
  }

  return (
    <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {concepts.map((concept) => (
        <div key={concept.id} className="h-full">
          <ConceptCard concept={concept} className="h-full" />
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------- papers --------------------------------- */

function PapersPanel({
  papers,
  subjectId,
  loading,
  error,
  onRetry,
}: PanelStateProps & { papers: PyqPaper[]; subjectId: string }) {
  const listRef = useStagger<HTMLUListElement>({ step: 55, distance: 14 })

  if (loading) return <SkeletonList count={3} label="Loading papers" />

  if (error) {
    return (
      <ErrorState
        title="We could not load papers"
        description="The paper archive did not respond. Check your connection and try again."
        onRetry={onRetry}
        illustration="paper"
        theme="pyq"
      />
    )
  }

  if (papers.length === 0) {
    return (
      <EmptyState
        title="No papers indexed for this subject yet."
        description="Sample papers land here as soon as they are scanned into the bank."
        illustration="paper"
        theme="pyq"
      />
    )
  }

  return (
    <ul ref={listRef} className="space-y-3">
      {papers.map((paper) => (
        <li key={paper.id}>
          <Link
            to={`/pyq/${subjectId}/${paper.slug}`}
            className="block rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <Card padded className="flex items-center gap-3 transition-shadow hover:shadow-raised">
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-tile bg-surface-muted text-muted [&_svg]:h-5 [&_svg]:w-5"
              >
                <FileText />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge theme="pyq" uppercase className="tabular">
                    {paper.year}
                  </Badge>
                  <Badge variant="neutral">{paper.set}</Badge>
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
                  {paper.subjectName}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted">
                  {paper.board} · {paper.duration} · {paper.questions.length} questions
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
      ))}
    </ul>
  )
}

/* ---------------------------------- page ----------------------------------- */

export default function PyqSubjectPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const subjectQuery = useSubject(slug)
  const questionsQuery = usePyqQuestions({ subjectSlug: slug })
  const papersQuery = usePyqPapers(slug)
  const overviewQuery = usePyqOverview()
  const { toast } = useToast()

  const [tab, setTab] = useState<TabId>('questions')
  const [filter, setFilter] = useState<Filter>('All')

  const subject = subjectQuery.data
  const questions = questionsQuery.data ?? []
  const papers = papersQuery.data ?? []
  const overview = overviewQuery.data

  const subjectLoading = Boolean(slug) && (subjectQuery.loading || isPending(subjectQuery))
  const questionsLoading = questionsQuery.loading || isPending(questionsQuery)
  const papersLoading = papersQuery.loading || isPending(papersQuery)
  const overviewLoading = overviewQuery.loading || isPending(overviewQuery)

  /* Concept frequency comes from the intelligence overview payload — the
     service only exposes the archive's top concepts, so this subject's slice
     is filtered client-side (its empty state is the panel's own). */
  const concepts = useMemo(
    () => (overview?.topConcepts ?? []).filter((concept) => concept.subjectId === slug),
    [overview, slug],
  )
  const stat = overview?.subjectStats.find((entry) => entry.subjectId === slug)

  /* Historical trend — the same question rows, bucketed by year and chapter. */
  const yearTrend = useMemo(() => {
    const counts = new Map<number, number>()
    for (const question of questions) counts.set(question.year, (counts.get(question.year) ?? 0) + 1)
    const rows = Array.from(counts, ([year, count]) => ({ year, count })).sort(
      (a, b) => a.year - b.year,
    )
    const max = Math.max(1, ...rows.map((row) => row.count))
    return rows.map((row) => ({
      ...row,
      percent: Math.max(4, Math.round((row.count / max) * 78)),
    }))
  }, [questions])

  const chapterTrend = useMemo(() => {
    const counts = new Map<string, number>()
    for (const question of questions) counts.set(question.chapter, (counts.get(question.chapter) ?? 0) + 1)
    const rows = Array.from(counts, ([chapter, count]) => ({ chapter, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, CHAPTER_ROWS)
    const max = Math.max(1, ...rows.map((row) => row.count))
    return rows.map((row) => ({ ...row, percent: Math.round((row.count / max) * 100) }))
  }, [questions])

  const counts: Record<Filter, number> = {
    All: questions.length,
    Easy: 0,
    Medium: 0,
    Hard: 0,
  }
  for (const question of questions) counts[question.difficulty] += 1

  const filtered =
    filter === 'All' ? questions : questions.filter((question) => question.difficulty === filter)

  if (subjectLoading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <SkeletonList count={4} label="Loading subject analysis" />
      </div>
    )
  }

  if (subjectQuery.error && !subject) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-4">
          <PageHeader back title="Subject unavailable" subtitle="We could not open this subject right now." />
        </div>
        <ErrorState
          title="We could not load this subject"
          description="Check your connection and try again — the PYQ Intelligence home lists every subject we cover."
          onRetry={subjectQuery.refetch}
          illustration="paper"
          theme="pyq"
        />
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-4">
          <PageHeader back title="Subject not found" subtitle="That PYQ subject is not part of the archive." />
        </div>
        <EmptyState
          title="No analysis for this subject"
          description="The link may be out of date — the PYQ Intelligence home lists every subject we cover."
          illustration="paper"
          theme="pyq"
          action={<LinkButton to="/pyq">Back to PYQ Intelligence</LinkButton>}
        />
      </div>
    )
  }

  const accent = subjectAccent(subject.id)
  const pageColors = themeColors(accent.theme)
  const chaptersCovered = stat?.chaptersCovered ?? subject.totalChapters
  const repeatRate = stat?.repeatRate ?? 0

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Subject band — the dominant, subject-coloured opening             */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="subject-hero"
        className={cn('relative isolate overflow-hidden rounded-hero shadow-card', accent.soft)}
      >
        <BackgroundArt theme={accent.theme} geometry intensity="subtle" />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:p-10">
          <div className="min-w-0">
            <p className="eyebrow">PYQ intelligence</p>
            <h1
              id="subject-hero"
              className="text-display mt-2 text-[28px] leading-[1.02] text-foreground sm:text-[38px] lg:text-[44px]"
            >
              {subject.name} <span className={accent.text}>PYQs</span>
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
              {subject.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge theme={accent.theme} size="md" dot>
                <span className="tabular">{questions.length}</span>&nbsp;PYQs
              </Badge>
              <Badge variant="neutral">
                <span className="tabular">{papers.length}</span>&nbsp;papers
              </Badge>
            </div>
          </div>

          {/* The repeat rate gets its own oversized treatment — this page's hero number. */}
          <div className="rounded-card bg-surface p-4 shadow-raised sm:p-5">
            <div className="flex items-center gap-2.5">
              <IconTile icon={<Repeat />} theme={accent.theme} variant="gradient" size="sm" />
              <p className="eyebrow">Repeat rate</p>
            </div>
            <p className="mt-3 flex items-baseline gap-1">
              <span
                className="tabular text-display text-[46px] leading-none sm:text-[56px]"
                style={{ color: pageColors.accentVar }}
              >
                {repeatRate}
              </span>
              <span className="text-xl font-bold text-faint">%</span>
            </p>
            <p className="mt-2 text-[12.5px] leading-snug text-muted">
              Reappear across years, near-verbatim
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Summary                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section aria-label="Subject summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Questions in bank"
          value={questions.length}
          icon={<FileText />}
          accent={accent.theme}
          trend="Tagged CBSE PYQs"
        />
        <StatCard
          label="Chapters covered"
          value={
            <>
              {chaptersCovered}
              <span className="text-sm font-semibold text-faint">/{subject.totalChapters}</span>
            </>
          }
          icon={<BookOpen />}
          accent={accent.theme}
          trend={`of ${subject.totalChapters} in the syllabus`}
        />
        <Card padded className="col-span-2 flex flex-col justify-between lg:col-span-1">
          <div>
            <p className="eyebrow">Difficulty mix</p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">
              Across <span className="tabular font-semibold text-foreground">{questions.length}</span> questions
            </p>
          </div>
          <div className="mt-3 space-y-2.5">
            {MIX_ORDER.map((entry) => (
              <ProgressBar
                key={entry}
                value={questions.length ? (counts[entry] / questions.length) * 100 : 0}
                size="xs"
                variant={MIX_TONE[entry]}
                label={entry}
                valueText={`${counts[entry]}`}
              />
            ))}
          </div>
        </Card>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Historical trend — per-year volume and chapter weight             */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="subject-trends-heading">
        <SectionHeader
          id="subject-trends-heading"
          eyebrow="Historical trend"
          title="Where the questions come from"
          subtitle={`Year-on-year volume and chapter weight across ${questions.length} PYQs`}
        />
        {questions.length === 0 ? (
          <EmptyState
            title="Not enough questions to chart yet"
            description="The per-year and chapter trends appear once this subject's bank is linked."
            illustration="paper"
            theme={accent.theme}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card padded>
              <p className="eyebrow">Questions by year</p>
              <div className="mt-3 flex h-32 items-end gap-1.5 sm:gap-2" aria-hidden>
                {yearTrend.map((row) => (
                  <div key={row.year} className="flex h-full flex-1 flex-col justify-end">
                    <span className="tabular mb-1 text-center text-[10px] font-semibold text-faint">
                      {row.count}
                    </span>
                    <span
                      className={cn('w-full rounded-t-md', accent.solid)}
                      style={{ height: `${row.percent}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5 sm:gap-2">
                {yearTrend.map((row) => (
                  <span key={row.year} className="tabular flex-1 text-center text-[10px] text-faint">
                    {row.year}
                  </span>
                ))}
              </div>
              <p className="sr-only">
                {yearTrend.map((row) => `${row.year}: ${row.count} questions`).join(', ')}
              </p>
            </Card>

            <Card padded>
              <p className="eyebrow">Chapter frequency</p>
              <ul className="mt-3 space-y-3">
                {chapterTrend.map((row) => (
                  <li key={row.chapter}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="clamp-1 min-w-0 text-[13px] font-semibold text-foreground">
                        {row.chapter}
                      </span>
                      <span className="tabular shrink-0 text-[13px] font-bold text-foreground">
                        {row.count}
                      </span>
                    </div>
                    <div className={cn('mt-1.5', accent.text)}>
                      <ProgressBar
                        value={row.percent}
                        size="xs"
                        variant="current"
                        label={`${row.chapter} frequency`}
                        valueText={`${row.percent}%`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Analysis                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="subject-analysis-heading">
        <SectionHeader
          id="subject-analysis-heading"
          eyebrow="Archive views"
          title="Analysis"
          subtitle="Questions, recurring concepts and full papers"
        />
        <Tabs<TabId>
          items={TAB_ITEMS.map((item) => ({
            ...item,
            count:
              item.id === 'questions'
                ? questions.length
                : item.id === 'concepts'
                  ? concepts.length
                  : papers.length,
          }))}
          value={tab}
          onChange={setTab}
          variant="underline"
          label={`${subject.name} PYQ views`}
        />

        <div className="mt-4">
          {tab === 'questions' && (
            <TabPanel id="questions">
              <QuestionsPanel
                key={filter}
                questions={filtered}
                counts={counts}
                filter={filter}
                onFilterChange={setFilter}
                loading={questionsLoading}
                error={questionsQuery.error}
                onRetry={questionsQuery.refetch}
                theme={accent.theme}
                onSave={(question) =>
                  toast({
                    title: 'Added to MistakeBook',
                    description: `${question.chapter} · CBSE ${question.year}`,
                    variant: 'success',
                  })
                }
              />
            </TabPanel>
          )}

          {tab === 'concepts' && (
            <TabPanel id="concepts">
              <ConceptsPanel
                concepts={concepts}
                loading={overviewLoading}
                error={overviewQuery.error}
                onRetry={overviewQuery.refetch}
              />
            </TabPanel>
          )}

          {tab === 'papers' && (
            <TabPanel id="papers">
              <PapersPanel
                papers={papers}
                subjectId={subject.id}
                loading={papersLoading}
                error={papersQuery.error}
                onRetry={papersQuery.refetch}
              />
            </TabPanel>
          )}
        </div>
      </section>
    </div>
  )
}
