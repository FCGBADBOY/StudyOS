import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Flame, Target } from 'lucide-react'
import type { ConceptFrequency, PriorityLevel } from '@/types'
import { Badge, Card, ProgressBar } from './ui'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'
import { useStagger } from '@/hooks'

const PRIORITY_STYLE: Record<PriorityLevel, { className: string; icon: ReactNode }> = {
  'HIGH PRIORITY': { className: 'border-danger/40 bg-danger-soft text-danger', icon: <Flame /> },
  'MEDIUM PRIORITY': { className: 'border-warning/40 bg-warning-soft text-warning', icon: <Target /> },
  'LOW PRIORITY': { className: 'border-border bg-surface-muted text-muted', icon: <Target /> },
}

export interface ConceptCardProps {
  concept: ConceptFrequency
  className?: string
  onOpen?: (concept: ConceptFrequency) => void
}

/**
 * PYQ "concept frequency" card — appearances, priority and a per-year trend.
 * The trend bars stagger in with Anime.js.
 */
export function ConceptCard({ concept, className, onOpen }: ConceptCardProps) {
  const accent = subjectAccent(concept.subjectId)
  const priority = PRIORITY_STYLE[concept.priority]
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              priority.className,
            )}
          >
            {priority.icon}
            {concept.priority}
          </span>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground">
            {concept.title}
          </h3>
          <p className={cn('mt-0.5 text-[12px] font-medium', accent.text)}>{concept.chapter}</p>
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

      <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
        <Badge variant="outline" className="tabular">
          {concept.marks} marks
        </Badge>
        <Badge variant="outline">{concept.difficulty}</Badge>
        <Badge variant="outline" className="tabular">
          {concept.years.length} years
        </Badge>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Year-on-year appearances
        </p>
        <div ref={trendRef} className="flex h-10 items-end gap-1" aria-hidden>
          {concept.trend.map((value, index) => (
            <div
              key={index}
              className={cn('flex-1 rounded-[3px]', value ? accent.solid : 'bg-surface-sunken')}
              style={{ height: `${28 + (value / maxTrend) * 72}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular text-faint">
          <span>{concept.years[0]}</span>
          <span>{concept.years[concept.years.length - 1]}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-muted">
        <span>Frequency vs. subject average</span>
        <span className="tabular font-semibold text-foreground">
          {Math.round((concept.appearances / 8) * 100)}%
        </span>
      </div>
      <ProgressBar
        value={Math.round((concept.appearances / 8) * 100)}
        size="xs"
        variant={concept.priority === 'HIGH PRIORITY' ? 'danger' : 'warning'}
        className="mt-1.5"
      />
    </Card>
  )
}
