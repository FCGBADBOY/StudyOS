/**
 * Formula Flow — searchable formula sheet plus a spaced-repetition flow deck.
 *
 * Browse mode is a filterable grid; Flow mode grades each card ("Got it" /
 * "Revise again") and animates the deck mastery bar with `animateBar`.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { ChevronLeft, ChevronRight, Check, RotateCcw, Search, Sigma, TriangleAlert } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Input,
  Modal,
  BottomSheet,
  PageHeader,
  SectionHeader,
  SkeletonList,
  TabPanel,
  Tabs,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { MOTION, animateBar, enterStep, exitStep, fadeUp } from '@/animations'
import { useDebouncedValue, useIsMobile, useStagger } from '@/hooks'
import { FORMULAS, searchFormulas } from '@/data/formulas'
import { getSubjectName } from '@/data/subjects'
import type { Formula, SubjectId } from '@/types'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

type ViewMode = 'browse' | 'flow'

const VIEW_TABS: TabItem<ViewMode>[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'flow', label: 'Flow' },
]

const SUBJECT_IDS = Array.from(new Set(FORMULAS.map((formula) => formula.subjectId)))

/* ------------------------------- browse ---------------------------------- */

function FormulaCard({ formula, onOpen }: { formula: Formula; onOpen: (formula: Formula) => void }) {
  const accent = subjectAccent(formula.subjectId)

  return (
    <Card interactive padded={false} data-card className="h-full overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(formula)}
        className="flex h-full w-full flex-col gap-3 p-4 text-left sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-tile',
              accent.soft,
              accent.text,
            )}
          >
            <Sigma className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug text-foreground">{formula.title}</h3>
            <p className="mt-0.5 text-[12px] text-faint">
              {formula.chapter} · {formula.topic}
            </p>
          </div>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
        </div>

        <p className="formula break-words rounded-tile bg-surface-sunken px-3 py-2.5 text-center text-[15px] font-semibold text-foreground">
          {formula.expression}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 text-[12px] text-faint">
          <Badge variant="neutral">{formula.siUnit}</Badge>
          <span className="tabular">{formula.variables.length} variables</span>
          <span aria-hidden>·</span>
          <span className="tabular">{formula.related.length} linked</span>
        </div>
      </button>
    </Card>
  )
}

function FormulaGrid({
  items,
  onOpen,
}: {
  items: Formula[]
  onOpen: (formula: Formula) => void
}) {
  const gridRef = useStagger<HTMLDivElement>({ selector: '[data-card]', step: 60, distance: 16 })

  return (
    <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((formula) => (
        <FormulaCard key={formula.id} formula={formula} onOpen={onOpen} />
      ))}
    </div>
  )
}

/* -------------------------------- detail --------------------------------- */

function FormulaDetail({
  formula,
  onOpenRelated,
}: {
  formula: Formula
  onOpenRelated: (formula: Formula) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const accent = subjectAccent(formula.subjectId)

  useLayoutEffect(
    () => fadeUp(containerRef.current, { distance: 12, duration: MOTION.duration.base }),
    [formula.id],
  )

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-tile',
            accent.soft,
            accent.text,
          )}
        >
          <Sigma className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-foreground">{formula.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral">{formula.chapter}</Badge>
            <Badge variant="brand">{formula.siUnit}</Badge>
          </div>
        </div>
      </div>

      <p className="formula break-words rounded-tile bg-surface-sunken px-4 py-3 text-center text-base font-bold text-foreground">
        {formula.expression}
      </p>

      <section aria-label="Variables">
        <h4 className="text-[13px] font-semibold text-foreground">Variables</h4>
        <ul role="list" className="mt-2 space-y-1.5">
          {formula.variables.map((variable) => (
            <li
              key={`${formula.id}-${variable.symbol}`}
              className="flex items-baseline gap-2 rounded-tile bg-surface-muted px-3 py-2"
            >
              <span className="formula w-12 shrink-0 text-[13px] font-bold text-brand-soft-fg">
                {variable.symbol}
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted">
                {variable.meaning}
              </span>
              <span className="tabular shrink-0 text-[12px] text-faint">{variable.unit}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Common mistakes" className="rounded-tile border border-warning/40 bg-warning-soft/60 p-3">
        <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-warning">
          <TriangleAlert aria-hidden className="h-4 w-4" />
          Common mistakes
        </h4>
        <ul role="list" className="mt-1.5 space-y-1">
          {formula.commonMistakes.map((mistake) => (
            <li key={mistake} className="text-[13px] leading-snug text-foreground/90">
              · {mistake}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Related formulae">
        <h4 className="text-[13px] font-semibold text-foreground">Related formulae</h4>
        <ul role="list" className="mt-2 space-y-2">
          {formula.related.map((relation) => {
            const target = FORMULAS.find((entry) => entry.expression === relation.expression)
            const content = (
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground">
                  {relation.title}
                </span>
                <span className="formula block break-words text-[12px] text-muted">
                  {relation.expression}
                </span>
              </span>
            )

            return (
              <li key={`${formula.id}-${relation.title}`}>
                {target ? (
                  <button
                    type="button"
                    onClick={() => onOpenRelated(target)}
                    className="flex w-full items-center gap-2 rounded-tile border border-border bg-surface px-3 py-2.5 text-left transition-colors duration-150 hover:border-border-strong"
                  >
                    {content}
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-2 rounded-tile border border-dashed border-border bg-surface px-3 py-2.5">
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/* --------------------------------- flow ----------------------------------- */

function FlowDeck({
  formula,
  index,
  total,
  mastery,
  graded,
  direction,
  tick,
  onGrade,
  onStep,
}: {
  formula: Formula
  index: number
  total: number
  mastery: number
  graded: 'got' | 'revise' | null
  direction: 'forward' | 'back'
  tick: number
  onGrade: (result: 'got' | 'revise') => void
  onStep: (delta: number) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => animateBar(fillRef.current, mastery), [mastery])

  useLayoutEffect(() => enterStep(cardRef.current, direction), [formula.id, direction, tick])

  /** Animate the card out, then hand control back to the page. */
  const step = (delta: number) => {
    exitStep(cardRef.current, delta > 0 ? 'forward' : 'back', () => onStep(delta))
  }

  const handleGrade = (result: 'got' | 'revise') => {
    onGrade(result)
    step(1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
  }

  return (
    <div role="group" aria-label="Flow deck controls" onKeyDown={onKeyDown} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral">{formula.chapter}</Badge>
          <Badge variant="brand">{formula.siUnit}</Badge>
          {graded && (
            <Badge variant={graded === 'got' ? 'success' : 'warning'}>
              {graded === 'got' ? 'Got it' : 'Needs a re-look'}
            </Badge>
          )}
        </div>
        <span className="tabular text-[12px] font-semibold text-faint">
          {index + 1} / {total}
        </span>
      </div>

      <div ref={cardRef} className="rounded-card border border-border bg-surface p-4 shadow-raised sm:p-5">
        <h3 className="text-base font-semibold leading-tight text-foreground">{formula.title}</h3>
        <p className="mt-0.5 text-[12px] text-faint">{formula.topic}</p>
        <p className="formula mt-3 break-words rounded-tile bg-surface-sunken px-4 py-4 text-center text-lg font-bold text-foreground">
          {formula.expression}
        </p>
        <ul role="list" className="mt-3 space-y-1">
          {formula.variables.slice(0, 4).map((variable) => (
            <li key={`${formula.id}-${variable.symbol}`} className="flex gap-2 text-[13px] text-muted">
              <span className="formula w-10 shrink-0 font-semibold text-brand-soft-fg">
                {variable.symbol}
              </span>
              <span className="min-w-0">{variable.meaning}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-foreground">Deck mastery</span>
          <span className="tabular text-[13px] font-bold text-brand">{mastery}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Deck mastery"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={mastery}
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken"
        >
          <div ref={fillRef} className="h-full rounded-full bg-brand" style={{ width: '0%' }} />
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Grade each card — “Got it” pushes mastery up, “Revise again” keeps it in rotation.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => handleGrade('revise')} icon={<RotateCcw />}>
          Revise again
        </Button>
        <Button onClick={() => handleGrade('got')} icon={<Check />}>
          Got it
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <IconButton
          label="Previous formula"
          size="lg"
          variant="outline"
          onClick={() => step(-1)}
        >
          <ChevronLeft />
        </IconButton>
        <p className="text-[12px] text-faint">Arrow keys also move through the deck</p>
        <IconButton label="Next formula" size="lg" variant="outline" onClick={() => step(1)}>
          <ChevronRight />
        </IconButton>
      </div>
    </div>
  )
}

/* --------------------------------- page ----------------------------------- */

export default function FormulaFlowPage() {
  const [booting, setBooting] = useState(true)
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState<SubjectId | 'all'>('all')
  const [mode, setMode] = useState<ViewMode>('browse')
  const [detail, setDetail] = useState<Formula | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [flowIndex, setFlowIndex] = useState(0)
  const [flowTick, setFlowTick] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [scores, setScores] = useState<Record<string, number>>({})

  const debouncedQuery = useDebouncedValue(query, 250)
  const isMobile = useIsMobile()

  const results = useMemo(() => {
    const found = searchFormulas(debouncedQuery)
    return subject === 'all' ? found : found.filter((formula) => formula.subjectId === subject)
  }, [debouncedQuery, subject])

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 420)
    return () => window.clearTimeout(timer)
  }, [])

  const index = results.length ? Math.min(flowIndex, results.length - 1) : 0
  const current = results[index]
  const mastery = results.length
    ? Math.round(
        results.reduce((sum, formula) => sum + (scores[formula.id] ?? 0), 0) / results.length,
      )
    : 0
  const score = current ? scores[current.id] : undefined
  const graded: 'got' | 'revise' | null = score == null ? null : score > 0 ? 'got' : 'revise'

  const openDetail = (formula: Formula) => {
    setDetail(formula)
    setDetailOpen(true)
  }

  const clearFilters = () => {
    setQuery('')
    setSubject('all')
  }

  /** The card exit animation lives in <FlowDeck> — this only moves the pointer. */
  const advance = (delta: number) => {
    if (!results.length) return
    setDirection(delta > 0 ? 'forward' : 'back')
    setFlowIndex((prev) => (((prev + delta) % results.length) + results.length) % results.length)
    setFlowTick((tick) => tick + 1)
  }

  const grade = (result: 'got' | 'revise') => {
    if (!current) return
    setScores((prev) => ({ ...prev, [current.id]: result === 'got' ? 100 : 0 }))
  }

  const closeDetail = () => setDetailOpen(false)

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Formula Flow"
        subtitle="Every formula that carries marks — search it, open the variable notes, then run the flow deck until mastery hits 100%."
      />

      <section aria-labelledby="formula-filter-heading" className="space-y-3">
        <SectionHeader
          id="formula-filter-heading"
          title="Search & filter"
          subtitle={`${results.length} of ${FORMULAS.length} formulae`}
        />
        <Input
          label="Search formulae"
          type="search"
          icon={<Search />}
          placeholder="Nernst, capacitor, by parts…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          role="group"
          aria-label="Filter by subject"
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          <Chip
            selected={subject === 'all'}
            onClick={() => setSubject('all')}
            className="min-h-11 shrink-0"
          >
            All subjects
          </Chip>
          {SUBJECT_IDS.map((id) => (
            <Chip
              key={id}
              selected={subject === id}
              onClick={() => setSubject(id)}
              className="min-h-11 shrink-0"
            >
              {getSubjectName(id)}
            </Chip>
          ))}
        </div>
      </section>

      {booting ? (
        <SkeletonList count={4} label="Loading formulae" />
      ) : results.length === 0 ? (
        <EmptyState
          title="No formulae match"
          description={`Nothing matches “${query}” with the current subject filter. Try a different term or clear the filters.`}
          action={
            <Button variant="outline" icon={<RotateCcw />} onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <section aria-labelledby="formula-view-heading" className="space-y-4">
          <SectionHeader
            id="formula-view-heading"
            title="Your formula sheet"
            subtitle={
              mode === 'flow'
                ? 'Spaced-repetition flow — grade every card honestly'
                : 'Tap a card for variables, mistakes and linked formulae'
            }
          />
          <Tabs items={VIEW_TABS} value={mode} onChange={setMode} variant="pills" label="Formula view" />
          <TabPanel id={mode}>
            {mode === 'browse' ? (
              <FormulaGrid key={subject} items={results} onOpen={openDetail} />
            ) : (
              <FlowDeck
                formula={current}
                index={index}
                total={results.length}
                mastery={mastery}
                graded={graded}
                direction={direction}
                tick={flowTick}
                onGrade={grade}
                onStep={advance}
              />
            )}
          </TabPanel>
        </section>
      )}

      {isMobile ? (
        <BottomSheet
          open={detailOpen}
          onClose={closeDetail}
          title={detail?.title ?? 'Formula'}
          description={detail ? `${detail.chapter} · ${detail.topic}` : undefined}
        >
          {detail && <FormulaDetail formula={detail} onOpenRelated={setDetail} />}
        </BottomSheet>
      ) : (
        <Modal
          open={detailOpen}
          onClose={closeDetail}
          title={detail?.title ?? 'Formula'}
          description={detail ? `${detail.chapter} · ${detail.topic}` : undefined}
        >
          {detail && <FormulaDetail formula={detail} onOpenRelated={setDetail} />}
        </Modal>
      )}
    </div>
  )
}
