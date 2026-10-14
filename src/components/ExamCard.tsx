import { CalendarDays, Timer } from 'lucide-react'
import type { Exam } from '@/types'
import { Badge, Card } from './ui'
import { subjectTheme, themeColors, type ThemeKey } from '@/config/visual'
import { daysUntil, formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

/**
 * Exam tone → semantic theme. Every colour on the card is resolved through the
 * shared vocabulary, so an exam re-tints with the rest of the app for free.
 */
const EXAM_THEMES: Record<Exam['color'], ThemeKey> = {
  brand: 'brand',
  accent: 'quiz',
  warning: 'warning',
  danger: 'danger',
}

export interface ExamCardProps {
  exam: Exam
  className?: string
  /** Hide the subject chips in tight layouts. */
  compact?: boolean
}

/**
 * Exam countdown card — the number of days left is the hero of the card.
 *
 * A tinted ground with a soft radial wash carries the identity, while the
 * countdown sits on a lit white well so the eye lands there first. The
 * "exam soon" state leans on the warning hue calmly: a small label and a
 * coloured numeral, never a red slab.
 */
export function ExamCard({ exam, className, compact }: ExamCardProps) {
  const days = daysUntil(exam.date)
  const theme = EXAM_THEMES[exam.color]
  const colors = themeColors(theme)
  const soon = days <= 21

  return (
    <Card padded tone={theme} className={cn('relative overflow-hidden', className)}>
      {/* soft radial light over the tint so the ground never reads as flat paint */}
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-70', colors.field)} />

      <div className="relative flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          {soon && (
            <Badge theme="warning" dot uppercase emphasis>
              Exam soon
            </Badge>
          )}

          <h3 className={cn('clamp-2 mt-1.5 text-[15px] font-semibold leading-snug text-foreground sm:text-base', soon && 'mt-2')}>
            {exam.name}
          </h3>

          <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-muted">
            <CalendarDays aria-hidden className="h-3.5 w-3.5" />
            {formatDate(exam.date)}
          </p>

          {!compact && exam.subjects.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {exam.subjects.map((subject) => (
                <Badge key={subject} theme={subjectTheme(subject)} dot className="capitalize">
                  {subject.replace('computer-science', 'CS')}
                </Badge>
              ))}
            </div>
          )}

          {soon && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-warning">
              <Timer aria-hidden className="h-3.5 w-3.5" />
              Revision window open — prioritise weak chapters.
            </p>
          )}
        </div>

        {/* the countdown — big, tabular, and lifted on its own lit well */}
        <div className="grid shrink-0 place-items-center rounded-card bg-surface px-3.5 py-3 text-center shadow-raised sm:px-5 sm:py-4">
          <span
            className={cn(
              'tabular text-display text-[36px] leading-none sm:text-[44px]',
              soon ? 'text-warning' : 'text-foreground',
            )}
          >
            {days}
          </span>
          <span className="eyebrow mt-1.5">{days === 1 ? 'day' : 'days'}</span>
        </div>
      </div>
    </Card>
  )
}
