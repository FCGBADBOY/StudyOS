import type { ReactNode } from 'react'
import { Flame, Target } from 'lucide-react'
import type { ConceptFrequency, PriorityLevel } from '@/types'
import { Badge, Card, ProgressBar } from './ui'
import { subjectAccent } from '@/utils/subject'
import type { ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'
import { useStagger } from '@/hooks'

/** Priority is a status, so it resolves through the theme vocabulary. */
const PRIORITY: Record<PriorityLevel, { theme: ThemeKey; icon: ReactNode }> = {
  'HIGH PRIORITY': { theme: 'danger', icon: <Flame /> },
  'MEDIUM PRIORITY': { theme: 'warning', icon: <Target /> },
  'LOW PRIORITY': { theme: 'neutral', icon: <Target /> },
}

export interface ConceptCardProps {
  concept: ConceptFrequency
  className?: string
  onOpen?: (concept: ConceptFrequency) => void
}

/**
 * PYQ "concept frequency" card — appearances, priority and a per-year trend.
 *
 * The subject owns the ground colour (trend panel, chapter label, bar fill) and
 * the priority owns the stamp, so a grid of these scans as "which subject,
 * how urgent" before a single word is read. The trend bars stagger in with
 * Anime.js.
 */
export function ConceptCard({ concept, className, onOpen }: ConceptCardProps) {
  const accent = subjectAccent(concept.subjectId)
  const priority = PRIORITY[concept.priority]
  const trendRef = useStagger<HTMLDivElement>({ step: 45, distance: 8, scale: false })
  const maxTrend = Math.max(1, ...concept.trend)

  return (
    <Card
      padded
      interactive={Boolean(onOpen)}
      onClick={onOpen ? () => onOpen(concept) : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(concept)
              }
            }
          : undefined
      }
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Open PYQ analysis for ${concept.title}` : undefined}
      className={cn('relative overflow-hidden', className)}
    >
      {/* Subject rail down the left edge — the card's identity at a glance. */}
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', accent.solid)} />

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <Badge theme={priority.theme} uppercase emphasis icon={priority.icon}>
            {concept.priority}
          </Badge>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground">
            {concept.title}
          </h3>
          <p className={cn('mt-1 flex items-center gap-1.5 text-[12px] font-medium', accent.text)}>
            <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', accent.solid)} />
            <span className="min-w-0 truncate">{concept.chapter}</span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span className="tabular block text-3xl font-bold leading-none text-foreground">
            {concept.appearances}
          </span>
          <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
            appearances
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 pl-2 text-[11px]">
        <Badge variant="neutral" className="tabular">
          {concept.marks} marks
        </Badge>
        <Badge variant="neutral">{concept.difficulty}</Badge>
        <Badge variant="neutral" className="tabular">
          {concept.years.length} years
        </Badge>
      </div>

      {/* Trend lives on the subject's own tint so the series reads as "this subject". */}
      <div className={cn('mt-3 rounded-tile p-3 pl-2', accent.soft)}>
        <p className={cn('mb-1.5 text-[11px] font-semibold uppercase tracking-wide', accent.text)}>
          Year-on-year appearances
        </p>
        <div ref={trendRef} className="flex h-10 items-end gap-1" aria-hidden>
          {concept.trend.map((value, index) => (
            <div
              key={index}
              className={cn('flex-1 rounded-[3px]', value ? accent.solid : 'bg-surface')}
              style={{ height: `${28 + (value / maxTrend) * 72}%` }}
            />
          ))}
        </div>
        <div className={cn('mt-1 flex justify-between text-[10px] tabular', accent.text)}>
          <span>{concept.years[0]}</span>
          <span>{concept.years[concept.years.length - 1]}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 pl-2 text-[12px] text-muted">
        <span>Frequency vs. subject average</span>
        <span className="tabular font-semibold text-foreground">
          {Math.round((concept.appearances / 8) * 100)}%
        </span>
      </div>
      <div className="pl-2">
        <ProgressBar
          value={Math.round((concept.appearances / 8) * 100)}
          size="xs"
          variant={concept.priority === 'HIGH PRIORITY' ? 'danger' : 'warning'}
          className="mt-1.5"
        />
      </div>
    </Card>
  )
}
