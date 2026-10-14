import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleX, Lightbulb, Repeat2 } from 'lucide-react'
import { bookmarkPop } from '@/animations'
import type { Mistake } from '@/types'
import { Badge, Card } from './ui'
import { severityTheme, themeColors } from '@/config/visual'
import { subjectAccent } from '@/utils/subject'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

/**
 * Mistake type → the warm severity vocabulary (`severityTheme`). A mistake is
 * information, not a failure, so the card tints warmly and never turns red.
 */
const KIND_BY_TYPE: Record<Mistake['type'], string> = {
  Conceptual: 'Concept',
  Calculation: 'Calculation',
  Formula: 'Formula',
  'Sign error': 'Careful',
  'Careless mistake': 'Careful',
  Memory: 'Memory',
  Other: 'Other',
}

export interface MistakeCardProps {
  mistake: Mistake
  onReview?: (mistake: Mistake) => void
  className?: string
  /** Show the compact "revised" toggle (Review flow). */
  reviewable?: boolean
}

/**
 * A single logged mistake: the wrong answer, the right concept, the meta.
 *
 * The whole card takes the severity tint, and the three pieces of content are
 * hierarchised by surface — question first on the tint, then the wrong answer
 * on white with a calm red label, then the fix on a soft green ground.
 */
export function MistakeCard({ mistake, onReview, className, reviewable = true }: MistakeCardProps) {
  const [revised, setRevised] = useState(false)
  const accent = subjectAccent(mistake.subjectId)
  const theme = severityTheme(KIND_BY_TYPE[mistake.type])
  const colors = themeColors(theme)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!revised || !buttonRef.current) return
    return bookmarkPop(buttonRef.current, true)
  }, [revised])

  return (
    <Card padded tone={theme} className={cn('relative overflow-hidden', className)}>
      {/* soft radial light so the tint reads as a lit surface, not flat paint */}
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-70', colors.field)} />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge theme={accent.theme} dot>
            {mistake.subjectName}
          </Badge>
          <Badge variant="neutral">{mistake.chapter}</Badge>
          <Badge theme={theme} uppercase emphasis>
            {mistake.type}
          </Badge>
          <Badge variant="neutral" className="tabular">
            {mistake.marks} marks
          </Badge>
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-faint">
            <Repeat2 aria-hidden className="h-3.5 w-3.5" />
            {mistake.solvedCount}× wrong
          </span>
        </div>

        <p className="mt-3 text-[15px] font-medium leading-relaxed text-foreground">{mistake.question}</p>

        <div className="mt-3 space-y-2">
          <div className="rounded-tile bg-surface p-3 shadow-card">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-danger">
              <CircleX aria-hidden className="h-3.5 w-3.5" />
              Your answer
            </p>
            <p className="mt-1 text-[13px] leading-snug text-foreground/90">{mistake.myAnswer}</p>
          </div>

          <div className="rounded-tile bg-success-soft p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-success">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
              Correct concept
            </p>
            <p className="mt-1 text-[13px] leading-snug text-foreground/90">{mistake.correctConcept}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
            <Lightbulb aria-hidden className="h-3.5 w-3.5" />
            Logged {formatDate(mistake.date)}
          </span>

          {reviewable && (
            <button
              ref={buttonRef}
              type="button"
              onClick={() => {
                setRevised((value) => !value)
                onReview?.(mistake)
              }}
              aria-pressed={revised}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-[12px] font-semibold shadow-card transition-colors duration-150',
                'outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
                revised
                  ? 'bg-success-soft text-success'
                  : 'bg-surface text-muted hover:text-foreground hover:shadow-raised',
              )}
            >
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
              {revised ? 'Revised' : 'Mark revised'}
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
