import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, CircleCheck, CircleX, Lightbulb, Sparkles } from 'lucide-react'
import type { Mistake, MistakeType } from '@/types'
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  ProgressBar,
  SectionHeader,
  SegmentedControl,
  SkeletonList,
} from '@/components/ui'
import { MistakeCard } from '@/components/MistakeCard'
import { useCountUp, useMistakes, useStagger } from '@/hooks'
import { celebrate } from '@/animations'
import { useToast } from '@/context/AppProvider'
import { invalidateQueries } from '@/lib/query'
import { updateMistake } from '@/services/mistakebook.service'
import { MISTAKE_TYPES } from '@/data/mistakes'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

type SubjectFilter = 'all' | 'physics' | 'chemistry' | 'mathematics'
type SortId = 'newest' | 'repeated'
type ReviewResult = 'cleared' | 'practice'

const SUBJECT_FILTERS: { id: SubjectFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'physics', label: 'Physics' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'mathematics', label: 'Mathematics' },
]

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'repeated', label: 'Most repeated' },
]

const TYPE_TONE: Record<MistakeType, 'current' | 'brand' | 'accent' | 'warning' | 'danger' | 'success'> = {
  Conceptual: 'brand',
  Calculation: 'warning',
  Formula: 'accent',
  'Sign error': 'danger',
  'Careless mistake': 'success',
  Memory: 'accent',
  Other: 'current',
}

/** The first render happens before a query subscribes — read it as loading. */
function isPending(query: { data: unknown; error: string | null; source: string | undefined }): boolean {
  return query.data === undefined && !query.error && !query.source
}

/* ------------------------------- review flow ------------------------------ */

interface ReviewFlowProps {
  open: boolean
  mistakes: Mistake[]
  onClose: () => void
  /** "Got it" resolves the mistake in the backend. */
  onResolve: (mistake: Mistake) => void
}

/** One mistake inside the modal — re-animates on every step. */
function ReviewStep({ mistake }: { mistake: Mistake }) {
  const ref = useStagger<HTMLDivElement>({ step: 45, distance: 12 })

  return (
    <div ref={ref} className="space-y-3">
      <div className="rounded-tile border border-border bg-surface-muted p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
          <Lightbulb aria-hidden className="h-3.5 w-3.5" />
          Question
        </p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">{mistake.question}</p>
        <p className="mt-2 text-[12px] text-faint">
          {mistake.subjectName} · {mistake.chapter} · {mistake.marks} marks
        </p>
      </div>

      <div className="rounded-tile border border-danger/30 bg-danger-soft p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-danger">
          <CircleX aria-hidden className="h-3.5 w-3.5" />
          Your answer
        </p>
        <p className="mt-1 text-[13px] leading-snug text-foreground/90">{mistake.myAnswer}</p>
      </div>

      <div className="rounded-tile border border-success/30 bg-success-soft p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success">
          <CircleCheck aria-hidden className="h-3.5 w-3.5" />
          Correct concept
        </p>
        <p className="mt-1 text-[13px] leading-snug text-foreground/90">{mistake.correctConcept}</p>
      </div>
    </div>
  )
}

/** Step-by-step revision session: one mistake at a time, then a summary. */
function ReviewFlow({ open, mistakes, onClose, onResolve }: ReviewFlowProps) {
  const { toast } = useToast()
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<ReviewResult[]>([])
  const celebrationRef = useRef<HTMLDivElement>(null)

  const total = mistakes.length
  const finished = index >= total
  const cleared = results.filter((result) => result === 'cleared').length
  const revisit = results.length - cleared
  const current = finished ? undefined : mistakes[index]

  /* A fresh session starts from the first mistake (runs before paint, so the
     summary of the previous run never flashes on reopen). */
  useLayoutEffect(() => {
    if (!open) return
    setIndex(0)
    setResults([])
  }, [open])

  useLayoutEffect(() => {
    if (!finished) return
    return celebrate(celebrationRef.current)
  }, [finished])

  const close = () => {
    if (finished) {
      toast({
        title: 'Review complete',
        description: `${cleared} cleared · ${revisit} to revisit`,
        variant: 'success',
      })
    }
    onClose()
  }

  const advance = (result: ReviewResult) => {
    if (!current) return
    setResults((prev) => [...prev, result])
    setIndex((value) => value + 1)
    if (result === 'cleared') {
      onResolve(current)
      toast({ title: 'Marked as cleared', description: `${current.subjectName} · ${current.chapter}` })
    } else {
      toast({
        title: 'Kept for practice',
        description: `${current.subjectName} · ${current.chapter}`,
        variant: 'warning',
      })
    }
  }

  const goBack = () => {
    setIndex((value) => Math.max(0, value - 1))
    setResults((prev) => prev.slice(0, -1))
  }

  const progress = total > 0 ? (Math.min(index, total) / total) * 100 : 0

  return (
    <Modal
      open={open}
      onClose={close}
      title={finished ? 'Review complete' : 'Reviewing your mistakes'}
      description={
        finished ? 'Session summarised — revisit whatever still feels shaky.' : `${total} mistake${total === 1 ? '' : 's'} in this view`
      }
      footer={
        finished ? (
          <Button icon={<Check />} onClick={close}>
            Close
          </Button>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" icon={<ChevronLeft />} disabled={index === 0} onClick={goBack}>
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => advance('practice')}>
                Still confusing
              </Button>
              <Button size="sm" icon={<CircleCheck />} onClick={() => advance('cleared')}>
                Got it
              </Button>
            </div>
          </div>
        )
      }
    >
      {finished ? (
        <div className="flex flex-col items-center py-2 text-center">
          <div ref={celebrationRef} className="relative grid h-32 w-32 place-items-center">
            <span
              data-celebrate-ring
              aria-hidden
              className="absolute left-[calc(50%-34px)] top-[calc(50%-34px)] h-[68px] w-[68px] rounded-full border-2 border-brand"
            />
            <span
              data-celebrate-ring
              aria-hidden
              className="absolute left-[calc(50%-34px)] top-[calc(50%-34px)] h-[68px] w-[68px] rounded-full border-2 border-accent"
            />
            <span
              data-celebrate-icon
              aria-hidden
              className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success"
            >
              <CircleCheck className="h-8 w-8" />
            </span>
            {['bg-brand', 'bg-accent', 'bg-warning', 'bg-success', 'bg-brand', 'bg-accent', 'bg-warning', 'bg-success'].map(
              (colour, particle) => (
                <span
                  key={`${colour}-${particle}`}
                  data-celebrate-particle
                  aria-hidden
                  className={cn(
                    'absolute left-[calc(50%-4px)] top-[calc(50%-4px)] h-2 w-2 rounded-full',
                    colour,
                  )}
                />
              ),
            )}
          </div>

          <p className="mt-4 text-lg font-bold text-foreground">
            <span className="tabular">{cleared}</span> cleared · <span className="tabular">{revisit}</span> to revisit
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {revisit > 0
              ? 'Those mistakes are still open in your book — give them another pass today.'
              : 'Every mistake in this view is cleared. Keep the streak alive.'}
          </p>
        </div>
      ) : (
        current && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="tabular text-[13px] font-semibold text-foreground">
                {index + 1} of {total}
              </span>
              <Badge variant="outline">{current.type}</Badge>
            </div>

            <ProgressBar
              value={progress}
              size="sm"
              label="Review progress"
              valueText={`${Math.min(index, total)} / ${total}`}
            />

            <div className="mt-4">
              <ReviewStep key={current.id} mistake={current} />
            </div>
          </>
        )
      )}
    </Modal>
  )
}

/* --------------------------------- grid ---------------------------------- */

/** Remounts whenever the filter key changes so the list re-animates. */
function MistakeGrid({
  filterKey,
  items,
  onReview,
}: {
  filterKey: string
  items: Mistake[]
  onReview: (mistake: Mistake) => void
}) {
  const ref = useStagger<HTMLDivElement>({ step: 55, distance: 16 })

  return (
    <div key={filterKey} ref={ref} className="grid gap-3 lg:grid-cols-2">
      {items.map((mistake) => (
        <MistakeCard key={mistake.id} mistake={mistake} onReview={onReview} />
      ))}
    </div>
  )
}

/* --------------------------------- page ---------------------------------- */

export default function MistakeBookPage() {
  const { toast } = useToast()
  const rootRef = useStagger<HTMLDivElement>({ step: 55, distance: 16 })

  const mistakesQuery = useMistakes()
  const mistakes = useMemo(() => mistakesQuery.data ?? [], [mistakesQuery.data])

  const [subject, setSubject] = useState<SubjectFilter>('all')
  const [type, setType] = useState<MistakeType | 'all'>('all')
  const [sort, setSort] = useState<SortId>('newest')
  const [reviewOpen, setReviewOpen] = useState(false)

  /* Every count on this screen is derived from the fetched list. */
  const TOTAL = mistakes.length
  const SUBJECT_COUNTS = useMemo(() => {
    const counts = new Map<string, number>()
    for (const mistake of mistakes) {
      counts.set(mistake.subjectId, (counts.get(mistake.subjectId) ?? 0) + 1)
    }
    return counts
  }, [mistakes])
  const TYPE_COUNTS = useMemo(
    () =>
      MISTAKE_TYPES.map((mistakeType) => ({
        type: mistakeType,
        count: mistakes.filter((mistake) => mistake.type === mistakeType).length,
      })),
    [mistakes],
  )
  const TYPE_LOOKUP = useMemo(
    () =>
      Object.fromEntries(TYPE_COUNTS.map((row) => [row.type, row.count])) as Record<
        MistakeType,
        number
      >,
    [TYPE_COUNTS],
  )
  const MOST_COMMON = TYPE_COUNTS.reduce((best, row) => (row.count > best.count ? row : best), TYPE_COUNTS[0])

  const heroCount = useCountUp<HTMLSpanElement>(TOTAL)

  const filtered = useMemo(() => {
    const rows = mistakes.filter(
      (mistake) =>
        (subject === 'all' || mistake.subjectId === subject) &&
        (type === 'all' || mistake.type === type),
    )
    return rows.sort((a, b) =>
      sort === 'newest' ? b.date.localeCompare(a.date) : b.solvedCount - a.solvedCount || b.date.localeCompare(a.date),
    )
  }, [mistakes, subject, type, sort])

  const filterKey = `${subject}:${type}:${sort}`
  const filtersActive = subject !== 'all' || type !== 'all' || sort !== 'newest'

  const clearFilters = () => {
    setSubject('all')
    setType('all')
    setSort('newest')
  }

  /** Resolve a mistake (card toggle + review flow) and refresh the lists. */
  const reviseMistake = (mistake: Mistake) => {
    void updateMistake(mistake.id, { resolved: true })
      .then(() => {
        invalidateQueries('mistakes')
        toast({ title: 'Revision logged', description: `${mistake.subjectName} · ${mistake.chapter}` })
      })
      .catch(() => {
        toast({
          title: 'Could not save that revision',
          description: 'Check your connection and try again.',
          variant: 'warning',
        })
      })
  }

  const header = (
    <PageHeader
      size="lg"
      title="Your MistakeBook"
      subtitle="Every wrong answer, turned into a revision plan."
      actions={
        <Button
          variant="soft"
          size="sm"
          icon={<Sparkles />}
          onClick={() => setReviewOpen(true)}
          disabled={filtered.length === 0}
        >
          Review Mistakes
        </Button>
      }
    />
  )

  if (mistakesQuery.loading || isPending(mistakesQuery)) {
    return (
      <div ref={rootRef} className="space-y-6 sm:space-y-8">
        {header}
        <SkeletonList count={4} label="Loading your mistake book" />
      </div>
    )
  }

  if (mistakesQuery.error && !mistakesQuery.data) {
    return (
      <div ref={rootRef} className="space-y-6 sm:space-y-8">
        {header}
        <ErrorState
          title="We could not load your mistakes"
          description="Your mistake book did not respond. Check your connection and try again."
          onRetry={mistakesQuery.refetch}
        />
      </div>
    )
  }

  if (TOTAL === 0) {
    return (
      <div ref={rootRef} className="space-y-6 sm:space-y-8">
        {header}
        <EmptyState
          title="No mistakes logged yet"
          description="Log a wrong answer while practising and it lands here as a revision card."
        />
      </div>
    )
  }

  return (
    <div ref={rootRef} className="space-y-6 sm:space-y-8">
      {header}

      {/* hero stat panel */}
      <Card
        as="section"
        aria-labelledby="mb-overview"
        className="overflow-hidden border-brand/25 bg-brand-soft p-4 sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-soft-fg/70">Revision queue</p>
            <h2 id="mb-overview" className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span
                ref={heroCount}
                aria-hidden
                className="tabular text-4xl font-bold leading-none text-brand-soft-fg"
              >
                0
              </span>
              <span className="sr-only">{TOTAL}</span>
              <span className="text-base font-semibold text-foreground sm:text-lg">mistakes to revise</span>
            </h2>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUBJECT_FILTERS.filter((option) => option.id !== 'all').map((option) => {
                const accent = subjectAccent(option.id)
                return (
                  <Badge key={option.id} variant="outline" className={cn('gap-1', accent.text)}>
                    {option.label}
                    <span className="tabular font-bold">{SUBJECT_COUNTS.get(option.id) ?? 0}</span>
                  </Badge>
                )
              })}
            </div>

            <p className="mt-3 text-[13px] text-muted">
              Most common type:{' '}
              <span className="font-semibold text-foreground">
                {MOST_COMMON.type} ({MOST_COMMON.count})
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button
              size="lg"
              icon={<Sparkles />}
              onClick={() => setReviewOpen(true)}
              disabled={filtered.length === 0}
              className="w-full sm:w-auto"
            >
              Review Mistakes
            </Button>
            <p className="text-center text-[12px] text-brand-soft-fg/80 sm:text-left lg:text-center">
              {filtered.length} of {TOTAL} in view
            </p>
          </div>
        </div>
      </Card>

      {/* filters */}
      <section aria-labelledby="mb-filters">
        <SectionHeader
          id="mb-filters"
          title="Filters"
          subtitle="Subject and mistake type combine — only matching mistakes show."
          action={
            filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />

        <Card className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">Subject</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_FILTERS.map((option) => (
                <Chip key={option.id} selected={subject === option.id} onClick={() => setSubject(option.id)}>
                  {option.label}
                  <span className="tabular text-[12px] font-bold opacity-70">
                    {option.id === 'all' ? TOTAL : (SUBJECT_COUNTS.get(option.id) ?? 0)}
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">Mistake type</p>
            <div className="flex flex-wrap gap-2">
              <Chip selected={type === 'all'} onClick={() => setType('all')}>
                All
                <span className="tabular text-[12px] font-bold opacity-70">{TOTAL}</span>
              </Chip>
              {MISTAKE_TYPES.map((mistakeType) => (
                <Chip key={mistakeType} selected={type === mistakeType} onClick={() => setType(mistakeType)}>
                  {mistakeType}
                  <span className="tabular text-[12px] font-bold opacity-70">{TYPE_LOOKUP[mistakeType]}</span>
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Sort by</p>
            <SegmentedControl<SortId>
              className="w-full sm:w-64"
              label="Sort mistakes"
              options={SORT_OPTIONS}
              value={sort}
              onChange={setSort}
            />
          </div>
        </Card>
      </section>

      {/* list */}
      <section aria-labelledby="mb-list">
        <SectionHeader
          id="mb-list"
          title="Your mistakes"
          subtitle={`${filtered.length} of ${TOTAL} shown`}
        />

        {filtered.length > 0 ? (
          <MistakeGrid key={filterKey} filterKey={filterKey} items={filtered} onReview={reviseMistake} />
        ) : (
          <EmptyState
            title="No mistakes here."
            description="Nothing matches these filters — try a different subject or clear the filters."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        )}
      </section>

      {/* by type */}
      <Card as="section" aria-labelledby="mb-types">
        <SectionHeader
          id="mb-types"
          title="By type"
          subtitle="Where your marks are leaking"
        />
        <div className="space-y-4">
          {TYPE_COUNTS.map((row) => (
            <ProgressBar
              key={row.type}
              value={(row.count / TOTAL) * 100}
              size="sm"
              variant={TYPE_TONE[row.type]}
              label={row.type}
              valueText={`${row.count} of ${TOTAL}`}
            />
          ))}
        </div>
      </Card>

      <ReviewFlow
        open={reviewOpen}
        mistakes={filtered}
        onClose={() => setReviewOpen(false)}
        onResolve={reviseMistake}
      />
    </div>
  )
}
