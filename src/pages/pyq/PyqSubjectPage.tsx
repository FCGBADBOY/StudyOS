import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, FileText } from 'lucide-react'
import type { ConceptFrequency, PyqDifficulty, PyqPaper, PyqQuestion } from '@/types'
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  ProgressBar,
  SectionHeader,
  SkeletonList,
  TabPanel,
  Tabs,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { ConceptCard } from '@/components/ConceptCard'
import { QuestionCard } from '@/components/QuestionCard'
import { usePyqOverview, usePyqPapers, usePyqQuestions, useStagger, useSubject } from '@/hooks'
import { useToast } from '@/context/AppProvider'

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
        />
      ) : questions.length === 0 ? (
        <EmptyState
          title="No questions match this filter."
          description="Pick another difficulty to see the rest of this subject's PYQ bank."
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
      />
    )
  }

  if (concepts.length === 0) {
    return <EmptyState title="No concept frequency data for this subject yet." />
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
      />
    )
  }

  if (papers.length === 0) {
    return (
      <EmptyState
        title="No papers indexed for this subject yet."
        description="Sample papers land here as soon as they are scanned into the bank."
      />
    )
  }

  return (
    <ul ref={listRef} className="space-y-3">
      {papers.map((paper) => (
        <li key={paper.id}>
          <Link to={`/pyq/${subjectId}/${paper.slug}`} className="block">
            <Card padded className="flex items-center gap-3 transition-colors hover:border-border-strong">
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-tile bg-surface-muted text-muted [&_svg]:h-5 [&_svg]:w-5"
              >
                <FileText />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {paper.year} {paper.subjectName} · {paper.set}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted">
                  {paper.board} · {paper.duration} · {paper.questions.length} questions
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="tabular block text-sm font-bold text-foreground">{paper.marks}</span>
                <span className="text-[11px] text-faint">marks</span>
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
        <PageHeader back title="Subject unavailable" subtitle="We could not open this subject right now." />
        <ErrorState
          title="We could not load this subject"
          description="Check your connection and try again — the PYQ Intelligence home lists every subject we cover."
          onRetry={subjectQuery.refetch}
        />
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          back
          title="Subject not found"
          subtitle="That PYQ subject is not part of the archive."
        />
        <EmptyState
          title="No analysis for this subject"
          description="The link may be out of date — the PYQ Intelligence home lists every subject we cover."
          action={<LinkButton to="/pyq">Back to PYQ Intelligence</LinkButton>}
        />
      </div>
    )
  }

  const chaptersCovered = stat?.chaptersCovered ?? subject.totalChapters
  const repeatRate = stat?.repeatRate ?? 0

  const summary: { label: string; value: ReactNode; hint: string }[] = [
    {
      label: 'Questions in bank',
      value: questions.length,
      hint: 'Tagged CBSE PYQs',
    },
    {
      label: 'Chapters covered',
      value: chaptersCovered,
      hint: `of ${subject.totalChapters} in the syllabus`,
    },
    {
      label: 'Repeat rate',
      value: `${repeatRate}%`,
      hint: 'Reappear across years',
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        back
        title={`${subject.name} PYQs`}
        subtitle={subject.description}
        actions={
          <span className="tabular rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand-soft-fg">
            {questions.length} PYQs
          </span>
        }
      />

      {/* ------------------------------ summary ------------------------------- */}
      <section aria-label="Subject summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label} padded>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              {item.label}
            </p>
            <p className="tabular mt-2 text-2xl font-bold leading-none text-foreground">
              {item.value}
            </p>
            <p className="mt-2 text-[12px] leading-snug text-muted">{item.hint}</p>
          </Card>
        ))}

        <Card padded className="flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Difficulty mix
            </p>
            <p className="mt-2 text-[12px] leading-snug text-muted">
              Across {questions.length} questions
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

      {/* ------------------------------- analysis ----------------------------- */}
      <section aria-labelledby="subject-analysis-heading">
        <SectionHeader
          id="subject-analysis-heading"
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
