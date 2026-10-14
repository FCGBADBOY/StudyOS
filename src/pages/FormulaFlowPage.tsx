/**
 * Formula Flow — searchable formula sheet plus a spaced-repetition flow deck.
 *
 * Browse mode is a filterable grid of subject-tinted reference cards where the
 * equation is the typographic hero; Flow mode grades each card ("Got it" /
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
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Play,
  RotateCcw,
  Search,
  Sigma,
  TriangleAlert,
} from 'lucide-react'
import {
  BackgroundArt,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  IconTile,
  IconButton,
  Illustration,
  InsightCard,
  Input,
  Modal,
  BottomSheet,
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

/** Focus treatment for every hand-rolled control on this page. */
const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

/* ------------------------------- browse ---------------------------------- */

function FormulaCard({ formula, onOpen }: { formula: Formula; onOpen: (formula: Formula) => void }) {
  const accent = subjectAccent(formula.subjectId)

  return (
    <Card
      interactive
      padded={false}
      tone={accent.theme}
      data-card
      className="h-full overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onOpen(formula)}
        className={cn('flex h-full w-full flex-col gap-4 p-4 text-left sm:p-5', FOCUS_RING)}
      >
        <div className="flex items-start gap-3">
          <IconTile icon={<Sigma />} theme={accent.theme} variant="gradient" size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="clamp-2 text-sm font-semibold leading-snug text-foreground">
              {formula.title}
            </h3>
            <p className="mt-0.5 clamp-1 text-[12px] text-faint">
              {formula.chapter} · {formula.topic}
            </p>
          </div>
          <ChevronRight aria-hidden className="mt-1 h-4 w-4 shrink-0 text-faint" />
        </div>

        {/* The equation is the card's hero — large, monospaced, on a white plate. */}
        <div className="rounded-card bg-surface px-3 py-5 text-center shadow-card sm:py-6">
          <p className="eyebrow mb-2">{getSubjectName(formula.subjectId)}</p>
          <p className="formula text-[21px] font-bold leading-tight break-words text-foreground sm:text-[25px]">
            {formula.expression}
          </p>
        </div>

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

/** A three-column symbol / meaning / unit row that collapses cleanly at 360px. */
function VariableRow({
  symbol,
  meaning,
  unit,
  tone,
}: {
  symbol: string
  meaning: string
  unit: string
  tone: string
}) {
  return (
    <li className="grid grid-cols-[44px_1fr] items-baseline gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[56px_1fr_110px]">
      <span className={cn('formula text-[13px] font-bold', tone)}>{symbol}</span>
      <span className="min-w-0 text-[13px] leading-snug text-muted">{meaning}</span>
      <span className="tabular col-start-2 text-[12px] text-faint sm:col-start-3 sm:text-right">
        {unit}
      </span>
    </li>
  )
}

function FormulaDetail({
  formula,
  onOpenRelated,
  onPractice,
}: {
  formula: Formula
  onOpenRelated: (formula: Formula) => void
  onPractice?: (formula: Formula) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const accent = subjectAccent(formula.subjectId)

  useLayoutEffect(
    () => fadeUp(containerRef.current, { distance: 12, duration: MOTION.duration.base }),
    [formula.id],
  )

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Subject-coloured ground, then the equation as the hero. */}
      <Card tone={accent.theme} padded className="space-y-4">
        <div className="rounded-card bg-surface px-4 py-6 text-center shadow-card sm:py-7">
          <p className="eyebrow mb-2">{getSubjectName(formula.subjectId)}</p>
          <p className="formula text-[24px] font-bold leading-tight break-words text-foreground sm:text-[32px]">
            {formula.expression}
          </p>
        </div>

        <div className="flex items-start gap-3">
          <IconTile icon={<Sigma />} theme={accent.theme} variant="gradient" size="md" />
          <div className="min-w-0">
            <p className="eyebrow">Meaning</p>
            <h3 className="mt-1 text-[15px] font-semibold leading-tight text-foreground">
              {formula.title}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">{formula.chapter}</Badge>
              <Badge variant="brand">{formula.siUnit}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <section aria-label="Variables">
        <div className="flex items-end justify-between gap-3">
          <h4 className="text-[13px] font-bold text-foreground">Variables</h4>
          <span className="eyebrow">Symbol · meaning · unit</span>
        </div>
        <div className="mt-2 overflow-hidden rounded-tile bg-surface shadow-card">
          <div className="hidden grid-cols-[56px_1fr_110px] gap-x-3 border-b border-border bg-cream px-3 py-2 sm:grid">
            <span className="eyebrow">Symbol</span>
            <span className="eyebrow">Meaning</span>
            <span className="eyebrow text-right">Unit</span>
          </div>
          <ul role="list" className="divide-y divide-border">
            {formula.variables.map((variable) => (
              <VariableRow
                key={`${formula.id}-${variable.symbol}`}
                symbol={variable.symbol}
                meaning={variable.meaning}
                unit={variable.unit}
                tone={accent.text}
              />
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Common mistakes">
        <InsightCard
          tone="warning"
          marker={<TriangleAlert aria-hidden className="h-4 w-4" />}
          title="Common mistakes"
          body={
            <span className="block space-y-1">
              {formula.commonMistakes.map((mistake) => (
                <span key={mistake} className="block text-[13px] leading-snug">
                  · {mistake}
                </span>
              ))}
            </span>
          }
        />
      </section>

      <section aria-label="Related formulae">
        <h4 className="text-[13px] font-bold text-foreground">Related formulae</h4>
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
                    className={cn(
                      'flex w-full items-center gap-2 rounded-tile bg-surface px-3 py-2.5 text-left shadow-card',
                      'transition-shadow duration-150 hover:shadow-raised',
                      FOCUS_RING,
                    )}
                  >
                    {content}
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-2 rounded-tile bg-surface-muted px-3 py-2.5">
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <Button
        fullWidth
        size="lg"
        icon={<Play />}
        onClick={() => onPractice?.(formula)}
        className="w-full"
      >
        Practice this
      </Button>
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
  const accent = subjectAccent(formula.subjectId)

  useLayoutEffect(() => animateBar(fillRef.current, mastery), [mastery])

  /* A springy entrance sells the "card dealt from the deck" feeling. */
  useLayoutEffect(
    () =>
      enterStep(cardRef.current, direction, {
        distance: 18,
        duration: MOTION.duration.slow,
        ease: MOTION.ease.spring,
      }),
    [formula.id, direction, tick],
  )

  /** Animate the card out, then hand control back to the page. */
  const step = (delta: number) => {
    exitStep(cardRef.current, delta > 0 ? 'forward' : 'back', () => onStep(delta), {
      distance: 22,
      duration: MOTION.duration.base,
    })
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
            <Badge variant={graded === 'got' ? 'success' : 'warning'} dot>
              {graded === 'got' ? 'Got it' : 'Needs a re-look'}
            </Badge>
          )}
        </div>
        <span className="tabular text-[12px] font-semibold text-faint">
          {index + 1} / {total}
        </span>
      </div>

      {/* Two offset leaves behind the live card read as a physical stack. */}
      <div className="relative">
        <span
          aria-hidden
          className="absolute inset-x-2 top-2 -bottom-2 rounded-hero bg-surface-muted shadow-card"
        />
        <span
          aria-hidden
          className="absolute inset-x-1 top-1 -bottom-1 rounded-hero bg-surface shadow-card"
        />
        <div
          ref={cardRef}
          className="relative rounded-hero bg-surface p-4 shadow-raised sm:p-6"
        >
          <div className="flex items-start gap-3">
            <IconTile icon={<Sigma />} theme={accent.theme} variant="gradient" size="md" />
            <div className="min-w-0">
              <p className="eyebrow">{formula.chapter}</p>
              <h3 className="mt-1 text-base font-semibold leading-tight text-foreground">
                {formula.title}
              </h3>
              <p className="mt-0.5 text-[12px] text-faint">{formula.topic}</p>
            </div>
          </div>

          <div className={cn('mt-4 rounded-card px-3 py-6 text-center shadow-card', accent.soft)}>
            <p className="formula text-[24px] font-bold leading-tight break-words text-foreground sm:text-[30px]">
              {formula.expression}
            </p>
          </div>

          <ul role="list" className="mt-4 space-y-1.5">
            {formula.variables.slice(0, 4).map((variable) => (
              <li
                key={`${formula.id}-${variable.symbol}`}
                className="flex gap-2 text-[13px] text-muted"
              >
                <span className={cn('formula w-10 shrink-0 font-semibold', accent.text)}>
                  {variable.symbol}
                </span>
                <span className="min-w-0">{variable.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-card bg-cream p-4 shadow-card">
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
        <p className="text-center text-[12px] text-faint">
          Arrow keys also move through the deck
        </p>
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

  /** "Practice this" closes the reader and deals that card into the flow deck. */
  const practice = (formula: Formula) => {
    setDetailOpen(false)
    const position = results.findIndex((entry) => entry.id === formula.id)
    if (position >= 0) {
      setDirection('forward')
      setFlowIndex(position)
      setFlowTick((tick) => tick + 1)
    }
    setMode('flow')
  }

  const detailNode = detail && (
    <FormulaDetail formula={detail} onOpenRelated={setDetail} onPractice={practice} />
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the editorial opening                                     */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="formula-hero"
        className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card"
      >
        <BackgroundArt theme="formula" geometry intensity="subtle" />
        <span
          aria-hidden
          className="pattern-dots pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-[0.35]"
        />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:p-10">
          <div className="min-w-0">
            <p className="eyebrow">Formula sheet</p>
            <h1
              id="formula-hero"
              className="text-display mt-2 text-[30px] leading-[1.0] text-foreground sm:text-[40px] lg:text-[46px]"
            >
              FORMULA
              <br />
              <span className="text-brand">FLOW.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              Every formula that carries marks — search it, open the variable notes, then run the
              flow deck until mastery hits 100%.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge theme="formula" dot>
                <span className="tabular">{FORMULAS.length}</span>&nbsp;formulae
              </Badge>
              <Badge variant="neutral">
                <span className="tabular">{SUBJECT_IDS.length}</span>&nbsp;subjects
              </Badge>
              <Badge variant="neutral">Spaced-repetition flow deck</Badge>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[280px] lg:max-w-none">
            <Illustration name="formula" theme="formula" decorative className="w-full" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Search & filter band                                              */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="formula-filter-heading">
        <Card tone="cream" padded className="space-y-3">
          <SectionHeader
            id="formula-filter-heading"
            title="Search & filter"
            subtitle={`${results.length} of ${FORMULAS.length} formulae`}
            tight
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
        </Card>
      </section>

      {booting ? (
        <SkeletonList count={4} label="Loading formulae" />
      ) : results.length === 0 ? (
        <EmptyState
          title="No formulae match"
          description={`Nothing matches “${query}” with the current subject filter. Try a different term or clear the filters.`}
          illustration="formula"
          theme="formula"
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
            eyebrow="Your sheet"
            title="Formula sheet"
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
          {detailNode}
        </BottomSheet>
      ) : (
        <Modal
          open={detailOpen}
          onClose={closeDetail}
          title={detail?.title ?? 'Formula'}
          description={detail ? `${detail.chapter} · ${detail.topic}` : undefined}
        >
          {detailNode}
        </Modal>
      )}
    </div>
  )
}
