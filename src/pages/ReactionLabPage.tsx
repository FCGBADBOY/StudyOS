/**
 * Reaction Lab — browse named reactions and walk their mechanisms stage by
 * stage. The flow diagram is a vertical node chain (reactants → reagents →
 * products → name) that staggers in like a reaction progressing, the active
 * mechanism step fades up inside a numbered timeline, and the segmented
 * progress bar advances with `animateBar`.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  ArrowDown,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  PackageCheck,
  Search,
  Star,
  TestTube,
  Thermometer,
  X,
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
  Input,
  SectionHeader,
  SkeletonList,
} from '@/components/ui'
import { MOTION, animateBar, bookmarkPop, fadeUp, staggerIn } from '@/animations'
import { useDebouncedValue, useReducedMotion } from '@/hooks'
import { REACTIONS } from '@/data/reactions'
import { useApp, useToast } from '@/context/AppProvider'
import type { Reaction } from '@/types'
import { subjectAccent } from '@/utils/subject'
import { themeColors, type ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

const FAMILIES = ['all', ...Array.from(new Set(REACTIONS.map((reaction) => reaction.family)))]

/** The Lab speaks chemistry — every themed surface resolves through this key. */
const PAGE_THEME: ThemeKey = 'chemistry'
const PAGE_COLORS = themeColors(PAGE_THEME)

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

/* -------------------------------- diagram --------------------------------- */

/** A downward link between two stages, drawn with the chemistry accent hue. */
function FlowConnector() {
  return (
    <div data-node aria-hidden className="flex flex-col items-center py-1">
      <span
        className="h-5 w-0.5 rounded-full"
        style={{ backgroundColor: PAGE_COLORS.accentVar }}
      />
      <ArrowDown className="h-4 w-4" style={{ color: PAGE_COLORS.accentVar }} />
    </div>
  )
}

/** One stage of the flow: a designed node with a label and its payload. */
function StageNode({
  label,
  icon,
  theme,
  children,
}: {
  label: string
  icon: ReactNode
  theme: ThemeKey
  children: ReactNode
}) {
  return (
    <div data-node className="rounded-card bg-surface p-3 shadow-card sm:p-4">
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} theme={theme} size="sm" />
        <p className="eyebrow min-w-0">{label}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>
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
      role="group"
      aria-label={`${reaction.name} flow: ${reaction.reactants.join(', ')} with ${reaction.reagents.join(', ')} gives ${reaction.products.join(', ')}`}
      className="rounded-hero bg-cream p-3 sm:p-5"
    >
      <p className="eyebrow mb-3">Reaction flow</p>

      <div className="flex flex-col items-stretch">
        <StageNode label="Reactants" icon={<FlaskConical />} theme={PAGE_THEME}>
          {reaction.reactants.map((reactant) => (
            <Badge key={reactant} theme={PAGE_THEME} emphasis>
              {reactant}
            </Badge>
          ))}
        </StageNode>

        <FlowConnector />

        <div data-node className="rounded-card bg-surface p-3 shadow-card sm:p-4">
          <div className="flex items-center gap-2.5">
            <IconTile icon={<TestTube />} theme="reaction" size="sm" />
            <p className="eyebrow min-w-0">Reagents</p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {reaction.reagents.map((reagent) => (
              <Badge key={reagent} theme="reaction" emphasis>
                {reagent}
              </Badge>
            ))}
          </div>
          <p className="mt-2.5 flex gap-1.5 text-[12.5px] leading-snug text-muted">
            <Thermometer aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">{reaction.conditions}</span>
          </p>
        </div>

        <FlowConnector />

        <StageNode label="Products" icon={<PackageCheck />} theme="success">
          {reaction.products.map((product) => (
            <Badge key={product} theme="success" emphasis>
              {product}
            </Badge>
          ))}
        </StageNode>

        <FlowConnector />

        <div data-node className="rounded-card bg-surface px-3 py-3 text-center shadow-card">
          <p className="eyebrow">Named reaction</p>
          <p className="mt-1 text-[15px] font-bold leading-snug text-foreground">
            {reaction.name}
          </p>
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
      className="scroll-mt-24 space-y-4 rounded-hero bg-surface p-4 shadow-raised sm:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge theme="reaction">{reaction.family}</Badge>
            <Badge theme={accent.theme}>{reaction.chapter}</Badge>
          </div>
          <h2 className="mt-2 text-lg font-bold leading-tight text-foreground">{reaction.name}</h2>
          {/* The equation gets its own plate so it reads as the subject of the panel. */}
          <div className="mt-2 rounded-tile bg-cream px-3 py-2.5 shadow-card">
            <p className="formula break-words text-[13px] leading-relaxed text-foreground sm:text-sm">
              {reaction.equation}
            </p>
          </div>
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
              FOCUS_RING,
              active
                ? cn(PAGE_COLORS.soft, PAGE_COLORS.onSoft)
                : 'text-faint hover:bg-surface-muted hover:text-foreground',
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
        <div className="rounded-tile bg-cream p-3">
          <span className="eyebrow">Reagents &amp; catalysts</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reaction.reagents.map((reagent) => (
              <Badge key={reagent} theme="reaction">
                {reagent}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-tile bg-warning-soft p-3">
          <Thermometer aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <span className="block text-[12px] font-semibold text-warning">Conditions</span>
            <p className="mt-0.5 break-words text-[13px] leading-snug text-foreground">
              {reaction.conditions}
            </p>
          </div>
        </div>
      </div>

      <section
        aria-label="Mechanism"
        onKeyDown={onKeyDown}
        className="rounded-card bg-cream p-4 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Mechanism</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral">
              Stage {stage + 1} of {stages.length}
            </Badge>
            {atLast && (
              <Badge theme="success" dot>
                Mechanism complete
              </Badge>
            )}
          </div>
        </div>

        {/* Numbered timeline — the live step is expanded, earlier steps are ticked off. */}
        <ol className="mt-3">
          {stages.map((item, index) => {
            const done = index < stage
            const currentStep = index === stage
            return (
              <li key={item} className="relative flex gap-3 pb-3 last:pb-0">
                {index < stages.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[13px] top-7 h-full w-px bg-border-strong/70"
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    'relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular',
                    currentStep
                      ? cn(PAGE_COLORS.solid, PAGE_COLORS.onSolid)
                      : done
                        ? 'bg-success-soft text-success'
                        : 'bg-surface-sunken text-faint',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {currentStep ? (
                    <div ref={stageTextRef} className="rounded-tile bg-surface p-3 shadow-card">
                      <p className="text-sm leading-relaxed text-foreground">{item}</p>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        'pt-1 text-[13px] leading-snug',
                        done ? 'text-muted' : 'text-faint',
                      )}
                    >
                      {item}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

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
      </section>

      <section aria-label="Why it matters in exams" className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
          <Star aria-hidden className="h-4 w-4 text-warning" />
          Why it matters in exams
        </h3>
        <ul role="list" className="space-y-2">
          {reaction.keyPoints.map((point) => (
            <li key={point}>
              <Card tone={PAGE_THEME} padded className="flex gap-2.5">
                <IconTile icon={<Check />} theme={PAGE_THEME} size="xs" variant="filled" />
                <p className="min-w-0 text-[13px] leading-snug text-foreground">{point}</p>
              </Card>
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
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the editorial opening                                     */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="reaction-hero"
        className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card"
      >
        <BackgroundArt theme={PAGE_THEME} geometry intensity="subtle" />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:p-10">
          <div className="min-w-0">
            <p className="eyebrow">Named reactions</p>
            <h1
              id="reaction-hero"
              className="text-display mt-2 text-[30px] leading-[1.0] text-foreground sm:text-[40px] lg:text-[46px]"
            >
              REACTION
              <br />
              <span style={{ color: PAGE_COLORS.accentVar }}>LAB.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              Named reactions as flows — reactants, reagents and products, then the mechanism one
              stage at a time.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge theme={PAGE_THEME} dot>
                <span className="tabular">{REACTIONS.length}</span>&nbsp;reactions
              </Badge>
              <Badge variant="neutral">
                <span className="tabular">{FAMILIES.length - 1}</span>&nbsp;reaction types
              </Badge>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[280px] lg:max-w-none">
            <Illustration name="molecule" theme={PAGE_THEME} decorative className="w-full" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Search & filter band                                              */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="reaction-filter-heading">
        <Card tone="cream" padded className="space-y-3">
          <SectionHeader
            id="reaction-filter-heading"
            title="Find a reaction"
            subtitle={`${results.length} of ${REACTIONS.length} reactions`}
            tight
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
        </Card>
      </section>

      {booting ? (
        <SkeletonList count={4} label="Loading reactions" />
      ) : results.length === 0 ? (
        <EmptyState
          title="No reactions match"
          description={`Nothing matches “${query}”${family === 'all' ? '' : ` in ${family}`}. Try another term or clear the filters.`}
          illustration="molecule"
          theme={PAGE_THEME}
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
              eyebrow="Library"
              title="Reactions"
              subtitle={selected ? 'Tap another reaction to switch the flow' : 'Select a reaction to open its mechanism'}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((reaction) => {
                const isCurrent = reaction.id === selectedId
                const accent = subjectAccent(reaction.subjectId)
                return (
                  <Card
                    key={reaction.id}
                    interactive
                    padded={false}
                    tone={isCurrent ? PAGE_THEME : undefined}
                    className="overflow-hidden transition-shadow duration-200"
                  >
                    <button
                      type="button"
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => selectReaction(reaction.id)}
                      className={cn(
                        'flex h-full w-full flex-col gap-2.5 p-4 text-left sm:p-5',
                        FOCUS_RING,
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <IconTile
                          icon={<FlaskConical />}
                          theme={accent.theme}
                          variant={isCurrent ? 'gradient' : 'soft'}
                          size="md"
                        />
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                          <h3 className="clamp-2 min-w-0 text-sm font-semibold leading-snug text-foreground">
                            {reaction.name}
                          </h3>
                          <ChevronRight
                            aria-hidden
                            className="mt-0.5 h-4 w-4 shrink-0 text-faint"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge theme="reaction">{reaction.family}</Badge>
                        <span className="truncate text-[12px] text-faint">
                          {reaction.chapter}
                        </span>
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
