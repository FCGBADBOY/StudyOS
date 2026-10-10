import { CalendarDays, Timer } from 'lucide-react'
import type { Exam } from '@/types'
import { Badge, Card } from './ui'
import { daysUntil, formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

const TONES = {
  brand: { chip: 'bg-brand-soft text-brand-soft-fg', bar: 'bg-brand' },
  accent: { chip: 'bg-accent-soft text-accent-fg', bar: 'bg-accent' },
  warning: { chip: 'bg-warning-soft text-warning', bar: 'bg-warning' },
  danger: { chip: 'bg-danger-soft text-danger', bar: 'bg-danger' },
} as const

export interface ExamCardProps {
  exam: Exam
  className?: string
  /** Hide the subject chips in tight layouts. */
  compact?: boolean
}

/** Exam countdown card — the number of days left is the hero of the card. */
export function ExamCard({ exam, className, compact }: ExamCardProps) {
  const days = daysUntil(exam.date)
  const tone = TONES[exam.color]

  return (
    <Card padded className={cn('relative overflow-hidden', className)}>
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', tone.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="clamp-2 text-sm font-semibold leading-snug text-foreground">{exam.name}</h3>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted">
            <CalendarDays aria-hidden className="h-3.5 w-3.5" />
            {formatDate(exam.date)}
          </p>
        </div>
        <div className={cn('shrink-0 rounded-tile px-2.5 py-1.5 text-center', tone.chip)}>
          <span className="tabular block text-lg font-bold leading-none">{days}</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide">
            {days === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {exam.subjects.map((subject) => (
            <Badge key={subject} variant="neutral" className="capitalize">
              {subject.replace('computer-science', 'CS')}
            </Badge>
          ))}
        </div>
      )}

      {days <= 21 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-warning">
          <Timer aria-hidden className="h-3.5 w-3.5" />
          Revision window open — prioritise weak chapters.
        </p>
      )}
    </Card>
  )
}
