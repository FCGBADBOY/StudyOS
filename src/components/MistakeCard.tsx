import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleX, Lightbulb, Repeat2 } from 'lucide-react'
import { bookmarkPop } from '@/animations'
import type { Mistake } from '@/types'
import { Badge, Card } from './ui'
import { subjectAccent } from '@/utils/subject'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

export interface MistakeCardProps {
  mistake: Mistake
  onReview?: (mistake: Mistake) => void
  className?: string
  /** Show the compact "revised" toggle (Review flow). */
  reviewable?: boolean
}

const TYPE_TONE: Record<Mistake['type'], 'brand' | 'accent' | 'warning' | 'danger' | 'neutral'> = {
  Conceptual: 'brand',
  Calculation: 'warning',
  Formula: 'accent',
  'Sign error': 'danger',
  'Careless mistake': 'neutral',
  Memory: 'accent',
  Other: 'neutral',
}

/** A single logged mistake: the wrong answer, the right concept, the meta. */
export function MistakeCard({ mistake, onReview, className, reviewable = true }: MistakeCardProps) {
  const [revised, setRevised] = useState(false)
  const accent = subjectAccent(mistake.subjectId)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!revised || !buttonRef.current) return
    return bookmarkPop(buttonRef.current, true)
  }, [revised])

  return (
    <Card padded className={cn('relative overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="neutral" className={cn(accent.text)}>
          {mistake.subjectName}
        </Badge>
        <Badge variant="neutral">{mistake.chapter}</Badge>
        <Badge variant={TYPE_TONE[mistake.type]}>{mistake.type}</Badge>
        <Badge variant="outline" className="tabular">
          {mistake.marks} marks
        </Badge>
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-faint">
          <Repeat2 aria-hidden className="h-3.5 w-3.5" />
          {mistake.solvedCount}× wrong
        </span>
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">{mistake.question}</p>

      <div className="mt-3 space-y-2">
        <div className="rounded-tile border border-danger/30 bg-danger-soft p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-danger">
            <CircleX aria-hidden className="h-3.5 w-3.5" />
            Your answer
          </p>
          <p className="mt-1 text-[13px] leading-snug text-foreground/90">{mistake.myAnswer}</p>
        </div>

        <div className="rounded-tile border border-success/30 bg-success-soft p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
            Correct concept
          </p>
          <p className="mt-1 text-[13px] leading-snug text-foreground/90">
            {mistake.correctConcept}
          </p>
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
              'inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
              revised
                ? 'border-success bg-success-soft text-success'
                : 'border-border text-muted hover:border-border-strong hover:text-foreground',
            )}
          >
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
            {revised ? 'Revised' : 'Mark revised'}
          </button>
        )}
      </div>
    </Card>
  )
}
