import { useEffect, useRef, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { animate } from 'animejs'
import { MOTION, canAnimate, checkComplete, stop } from '@/animations'
import type { StudySession } from '@/types'
import { Badge, Card } from './ui'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

export interface StudySessionCardProps {
  session: StudySession
  onToggle?: (id: string) => void
  className?: string
  /** Show the planned time chip (Today view). */
  showTime?: boolean
  /** Visual rank used to stagger a list of sessions. */
  index?: number
}

const PRIORITY_TONE = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
} as const

/**
 * A planned study session with an animated completion checkbox.
 * Completing a session plays the check-draw + subtle celebration.
 */
export function StudySessionCard({ session, onToggle, className, showTime = true }: StudySessionCardProps) {
  const [completed, setCompleted] = useState(session.completed)
  const [celebrating, setCelebrating] = useState(false)
  const checkRef = useRef<HTMLSpanElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const accent = subjectAccent(session.subjectId)

  useEffect(() => {
    setCompleted(session.completed)
  }, [session.completed])

  useEffect(() => {
    if (pathRef.current) {
      pathRef.current.style.visibility = completed ? 'visible' : 'hidden'
      pathRef.current.style.strokeDasharray = ''
      pathRef.current.style.strokeDashoffset = ''
    }
  }, [completed])

  const toggle = () => {
    const next = !completed
    setCompleted(next)
    onToggle?.(session.id)

    if (next) {
      setCelebrating(true)
      checkComplete(checkRef.current, pathRef.current)
      if (cardRef.current && canAnimate()) {
        animate(cardRef.current, {
          x: [0, 4, 0],
          duration: MOTION.duration.slow,
          ease: MOTION.ease.spring,
        })
      }
      window.setTimeout(() => setCelebrating(false), 900)
    }
  }

  return (
    <Card
      ref={cardRef as never}
      padded={false}
      className={cn(
        'transition-colors duration-200',
        completed && 'border-success/40 bg-success-soft/40',
        className,
      )}
    >
      <div className="flex items-start gap-3 p-3.5 sm:p-4">
        <button
          ref={checkRef as never}
          type="button"
          role="checkbox"
          aria-checked={completed}
          aria-label={`Mark ${session.topic} as ${completed ? 'not done' : 'done'}`}
          onClick={toggle}
          className={cn(
            'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
            completed ? 'border-success bg-success' : 'border-border-strong bg-surface hover:border-brand',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="var(--brand-fg, #fff)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path ref={pathRef} d="M5 12.5l4.5 4.5L19 7" style={{ visibility: 'hidden' }} />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral" className={cn(accent.text)}>
              {session.subjectName}
            </Badge>
            <Badge variant={PRIORITY_TONE[session.priority]}>{session.priority}</Badge>
            {showTime && session.time && (
              <span className="inline-flex items-center gap-1 text-[12px] text-faint">
                <Clock aria-hidden className="h-3 w-3" />
                <span className="tabular">{session.time}</span>
              </span>
            )}
          </div>

          <p
            className={cn(
              'mt-1.5 text-sm font-semibold leading-snug text-foreground transition-colors',
              completed && 'text-muted line-through decoration-success/60',
            )}
          >
            {session.topic}
          </p>

          {session.notes && (
            <p className="clamp-1 mt-0.5 text-[13px] text-muted">{session.notes}</p>
          )}

          <div className="mt-2 flex items-center gap-2 text-[12px] text-faint">
            <span className="tabular font-medium text-muted">{session.duration} min</span>
            {celebrating && (
              <span className="font-semibold text-success">Nice — session logged</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
