/**
 * Reaction Lab — browse named reactions and walk their mechanisms stage by
 * stage. The diagram staggers in like a flow, the stage text fades up and the
 * segmented progress bar advances with `animateBar`.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Search,
  Star,
  Thermometer,
  X,
} from 'lucide-react'
import { Badge, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, SectionHeader, SkeletonList } from '@/components/ui'
import { MOTION, animateBar, bookmarkPop, fadeUp, staggerIn } from '@/animations'
import { useDebouncedValue, useReducedMotion } from '@/hooks'
import { REACTIONS } from '@/data/reactions'
import { useApp, useToast } from '@/context/AppProvider'
import type { Reaction } from '@/types'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

const FAMILIES = ['all', ...Array.from(new Set(REACTIONS.map((reaction) => reaction.family)))]

/* -------------------------------- diagram --------------------------------- */

type NodeTone = 'brand' | 'warning' | 'success'

const NODE_TONES: Record<NodeTone, string> = {
  brand: 'border-brand/40 bg-brand-soft text-brand-soft-fg',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  success: 'border-success/40 bg-success-soft text-success',
}

function NodeGroup({ label, items, tone }: { label: string; items: string[]; tone: NodeTone }) {
  return (
    <div data-node className={cn('rounded-tile border px-3 py-2', NODE_TONES[tone])}>
      <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </span>
      {items.map((item) => (
        <span key={item} className="block text-[13px] font-semibold leading-snug">
          {item}
        </span>
      ))}
    </div>
  )
}

function ReactionFlow({ reaction }: { reaction: Reaction }) {
  const diagramRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(
    () =>
      staggerIn(diagramRef.current?.querySelectorAll('[data-node]'), {
        step: 80,
        distance: 14,
        duration: 340,
      }),
    [reaction.id],
  )

  return (
    <div
      ref={diagramRef}
      aria-label={`${reaction.name} flow: ${reaction.reactants.join(', ')} with ${reaction.reagents.join(', ')} gives ${reaction.products.join(', ')}`}
      className="rounded-card border border-border bg-surface-muted p-3 sm:p-4"
    >
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 sm:flex-1">
          <NodeGroup label="Reactants" items={reaction.reactants} tone="brand" />
          <div data-node className="flex items-center gap-2" aria-hidden>
            <span className="h-px flex-1 bg-border-strong" />
            <span className="text-[11px] font-bold text-faint">+</span>
            <span className="h-px flex-1 bg-border-strong" />
          </div>
          <NodeGroup label="Reagents" items={reaction.reagents} tone="warning" />
        </div>

        <div data-node className="flex items-center justify-center gap-2 sm:flex-col sm:gap-1.5">
          <ArrowRight aria-hidden className="hidden h-5 w-5 text-brand sm:block" />
          <ArrowDown aria-hidden className="h-5 w-5 text-brand sm:hidden" />
          <span className="text-center text-[11px] font-semibold leading-tight text-muted sm:max-w-[140px]">
            {reaction.name}
          </span>
        </div>

        <div className="sm:w-56">
          <NodeGroup label="Products" items={reaction.products} tone="success" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- detail panel ----------------------------- */

function ReactionPanel({
  reaction,
  stage,
  onStageChange,
  onClose,
  containerRef,
}: {
  reaction: Reaction
  stage: number
  onStageChange: (next: number) => void
  onClose: () => void
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { isFavorite, toggleFavorite } = useApp()
  const { toast } = useToast()

  const stageTextRef = useRef<HTMLDivElement>(null)
  const bookmarkRef = useRef<HTMLButtonElement>(null)
  const segmentRefs = useRef<Array<HTMLSpanElement | null>>([])

  const stages = reaction.mechanism
  const accent = subjectAccent(reaction.subjectId)
  const favoriteId = `reaction:${reaction.id}`
  const active = isFavorite(favoriteId)
  const atFirst = stage === 0
  const atLast = stage >= stages.length - 1

  /* Stage copy fades up whenever the reaction or the step changes. */
  useLayoutEffect(
    () => fadeUp(stageTextRef.current, { distance: 14, duration: MOTION.duration.base }),
    [reaction.id, stage],
  )

  /* Segmented progress: only segments whose state actually changed animate. */
  const lastReaction = useRef('')
  const lastStage = useRef(-1)

  useLayoutEffect(() => {
    const previous = lastReaction.current === reaction.id ? lastStage.current : -1
    for (let index = 0; index < stages.length; index += 1) {
      const fill = segmentRefs.current[index]
      if (!fill) continue
      const filled = index <= stage
      const wasFilled = previous >= 0 && index <= previous
      if (previous < 0 || filled !== wasFilled) {
        animateBar(fill, filled ? 100 : 0, {
          duration: previous < 0 ? MOTION.duration.epic : MOTION.duration.base,
        })
      }
    }
    lastReaction.current = reaction.id
    lastStage.current = stage
  }, [reaction.id, stage, stages.length])

  useLayoutEffect(() => {
    if (!bookmarkRef.current) return
    return bookmarkPop(bookmarkRef.current, active)
  }, [active, reaction.id])

  const onBookmark = () => {
    const added = toggleFavorite(favoriteId)
    toast({
      title: added ? 'Reaction bookmarked' : 'Bookmark removed',
      description: added
        ? `${reaction.name} joins your revision list.`
        : `${reaction.name} left your revision list.`,
      variant: added ? 'success' : 'default',
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' && !atLast) {
      event.preventDefault()
      onStageChange(stage + 1)
    }
    if (event.key === 'ArrowLeft' && !atFirst) {
      event.preventDefault()
      onStageChange(stage - 1)
    }
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`${reaction.name} detail`}
      className="scroll-mt-24 space-y-4 rounded-card border border-border bg-surface p-4 shadow-raised sm:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="brand">{reaction.family}</Badge>
            <Badge variant="neutral" className={accent.text}>
              {reaction.chapter}
            </Badge>
          </div>
          <h2 className="mt-2 text-lg font-bold leading-tight text-foreground">{reaction.name}</h2>
          <p className="formula mt-1 break-words text-[13px] leading-relaxed text-muted">
            {reaction.equation}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            ref={bookmarkRef}
            type="button"
            aria-pressed={active}
            aria-label={active ? `Remove bookmark for ${reaction.name}` : `Bookmark ${reaction.name}`}
            onClick={onBookmark}
            className={cn(
              'grid h-11 w-11 place-items-center rounded-control transition-colors duration-150',
              active ? 'bg-brand-soft text-brand-soft-fg' : 'text-faint hover:bg-surface-muted hover:text-foreground',
            )}
          >
            <Bookmark
              aria-hidden
              className="h-5 w-5"
              fill={active ? 'currentColor' : 'none'}
              strokeWidth={1.8}
            />
          </button>
          <IconButton label="Close reaction detail" size="lg" variant="outline" onClick={onClose}>
            <X />
          </IconButton>
        </div>
      </header>

      <ReactionFlow reaction={reaction} />

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-tile border border-border bg-surface-muted p-3">
          <span className="text-[12px] font-semibold text-foreground">Reagents & catalysts</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {reaction.reagents.map((reagent) => (
              <Badge key={reagent} variant="accent">
                {reagent}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-tile border border-warning/40 bg-warning-soft p-3">
          <Thermometer aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <span className="block text-[12px] font-semibold text-warning">Conditions</span>
            <p className="mt-0.5 break-words text-[13px] leading-snug text-foreground">
              {reaction.conditions}
            </p>
          </div>
        </div>
      </div>

      <div
        onKeyDown={onKeyDown}
        className="rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="neutral">
            Stage {stage + 1} of {stages.length}
          </Badge>
          {atLast && <Badge variant="success">Mechanism complete</Badge>}
        </div>

        <div ref={stageTextRef} className="mt-3">
          <p className="text-sm leading-relaxed text-foreground">{stages[stage]}</p>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {stages.map((item, index) => (
              <span key={item} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                <span
                  ref={(node) => {
                    segmentRefs.current[index] = node
                  }}
                  className="block h-full rounded-full bg-brand"
                  style={{ width: '0%' }}
                />
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-faint">
            Use the buttons or arrow keys to walk through the mechanism.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            icon={<ChevronLeft />}
            disabled={atFirst}
            onClick={() => onStageChange(stage - 1)}
          >
            Previous
          </Button>
          <Button
            fullWidth
            iconRight={<ChevronRight />}
            disabled={atLast}
            onClick={() => onStageChange(stage + 1)}
          >
            Next stage
          </Button>
        </div>
      </div>

      <section aria-label="Why it matters in exams" className="rounded-tile bg-brand-soft p-3.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-soft-fg">
          <Star aria-hidden className="h-4 w-4" />
          Why it matters in exams
        </h3>
        <ul role="list" className="mt-2 space-y-1.5">
          {reaction.keyPoints.map((point) => (
            <li key={point} className="flex gap-2 text-[13px] leading-snug text-foreground">
              <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span className="min-w-0">{point}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/* --------------------------------- page ----------------------------------- */

export default function ReactionLabPage() {
  const reduced = useReducedMotion()
  const [booting, setBooting] = useState(true)
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string>(REACTIONS[0].id)
  const [stage, setStage] = useState(0)
  const debouncedQuery = useDebouncedValue(query, 220)

  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 420)
    return () => window.clearTimeout(timer)
  }, [])

  const results = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase()
    return REACTIONS.filter((reaction) => {
      if (family !== 'all' && reaction.family !== family) return false
      if (!term) return true
      const haystack = [
        reaction.name,
        reaction.family,
        reaction.chapter,
        reaction.equation,
        reaction.conditions,
        ...reaction.reactants,
        ...reaction.reagents,
        ...reaction.products,
        ...reaction.mechanism,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [debouncedQuery, family])

  const selected = results.find((reaction) => reaction.id === selectedId) ?? null

  const selectReaction = (id: string) => {
    setSelectedId(id)
    setStage(0)
    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const clearFilters = () => {
    setQuery('')
    setFamily('all')
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Reaction Lab"
        subtitle="Named reactions as flows — reactants, reagents and products, then the mechanism one stage at a time."
      />

      <section aria-labelledby="reaction-filter-heading" className="space-y-3">
        <SectionHeader
          id="reaction-filter-heading"
          title="Find a reaction"
          subtitle={`${results.length} of ${REACTIONS.length} reactions`}
        />
        <Input
          label="Search reactions"
          type="search"
          icon={<Search />}
          placeholder="Reimer, aldol, aniline…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          role="group"
          aria-label="Filter by reaction type"
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          {FAMILIES.map((entry) => (
            <Chip
              key={entry}
              selected={family === entry}
              onClick={() => setFamily(entry)}
              className="min-h-11 shrink-0"
            >
              {entry === 'all' ? 'All types' : entry}
            </Chip>
          ))}
        </div>
      </section>

      {booting ? (
        <SkeletonList count={4} label="Loading reactions" />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title="No reactions match"
          description={`Nothing matches “${query}”${family === 'all' ? '' : ` in ${family}`}. Try another term or clear the filters.`}
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {selected && (
            <ReactionPanel
              reaction={selected}
              stage={stage}
              onStageChange={setStage}
              onClose={() => setSelectedId('')}
              containerRef={panelRef}
            />
          )}

          <section aria-labelledby="reaction-list-heading" className="space-y-3">
            <SectionHeader
              id="reaction-list-heading"
              title="Reactions"
              subtitle={selected ? 'Tap another reaction to switch the flow' : 'Select a reaction to open its mechanism'}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((reaction) => {
                const isCurrent = reaction.id === selectedId
                return (
                  <Card
                    key={reaction.id}
                    interactive
                    padded={false}
                    className={cn('overflow-hidden transition-colors duration-200', isCurrent && 'border-brand')}
                  >
                    <button
                      type="button"
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => selectReaction(reaction.id)}
                      className="flex h-full w-full flex-col gap-2 p-4 text-left sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 text-sm font-semibold leading-snug text-foreground">
                          {reaction.name}
                        </h3>
                        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="neutral">{reaction.family}</Badge>
                        <span className="truncate text-[12px] text-faint">{reaction.chapter}</span>
                      </div>
                      <p className="formula clamp-2 break-words text-[12px] leading-relaxed text-muted">
                        {reaction.equation}
                      </p>
                    </button>
                  </Card>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
