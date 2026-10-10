import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate } from 'animejs'
import { MOTION, canAnimate, stop } from '@/animations'
import { cn } from '@/utils/cn'

export interface ProgressBarProps {
  /** 0 – 100 */
  value: number
  label?: string
  valueText?: string
  variant?: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'current'
  size?: 'xs' | 'sm' | 'md'
  className?: string
  /** Animate from 0 on mount (default true). */
  animated?: boolean
}

const BAR_COLORS = {
  brand: 'bg-brand',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  current: 'bg-current',
}

const BAR_HEIGHTS = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
}

/**
 * Horizontal progress bar. The fill width is written directly by Anime.js —
 * no React re-renders while it animates.
 */
export function ProgressBar({
  value,
  label,
  valueText,
  variant = 'brand',
  size = 'md',
  className,
  animated = true,
}: ProgressBarProps) {
  const fillRef = useRef<HTMLDivElement>(null)
  const clamped = Math.max(0, Math.min(100, Math.round(value)))

  useLayoutEffect(() => {
    const fill = fillRef.current
    if (!fill) return

    if (!animated) {
      fill.style.width = `${clamped}%`
      return
    }

    if (!canAnimate()) {
      fill.style.width = `${clamped}%`
      return
    }

    fill.style.width = '0%'
    const state = { v: 0 }
    const instance = animate(state, {
      v: clamped,
      duration: MOTION.duration.epic,
      ease: MOTION.ease.enter,
      onUpdate: () => {
        fill.style.width = `${state.v}%`
      },
      onComplete: () => {
        fill.style.width = `${clamped}%`
      },
    })
    return stop(instance)
  }, [clamped, animated])

  return (
    <div className={cn('w-full', className)}>
      {(label || valueText) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
          {label && <span className="font-medium text-muted">{label}</span>}
          {valueText && <span className="tabular font-semibold text-foreground">{valueText}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className={cn(
          'w-full overflow-hidden rounded-full bg-surface-sunken',
          BAR_HEIGHTS[size],
        )}
      >
        <div
          ref={fillRef}
          className={cn('h-full rounded-full transition-colors', BAR_COLORS[variant])}
          style={{ width: animated ? '0%' : `${clamped}%` }}
        />
      </div>
    </div>
  )
}

export interface ProgressRingProps {
  /** 0 – 100 */
  value: number
  size?: number
  stroke?: number
  variant?: 'brand' | 'accent' | 'warning' | 'success' | 'danger'
  color?: string
  label?: string
  children?: ReactNode
  className?: string
  showValue?: boolean
}

const RING_COLORS = {
  brand: 'var(--brand)',
  accent: 'var(--accent)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  danger: 'var(--danger)',
}

/** Circular progress ring — animates stroke-dashoffset from 0 to its value. */
export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  variant = 'brand',
  color,
  label,
  children,
  className,
  showValue = true,
}: ProgressRingProps) {
  const circleRef = useRef<SVGCircleElement>(null)
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  useLayoutEffect(() => {
    const circle = circleRef.current
    if (!circle) return

    circle.style.strokeDasharray = `${circumference}`
    circle.style.strokeDashoffset = `${circumference}`

    if (!canAnimate()) {
      circle.style.strokeDashoffset = `${circumference * (1 - clamped / 100)}`
      return
    }

    const state = { v: 0 }
    const instance = animate(state, {
      v: clamped,
      duration: MOTION.duration.epic + 200,
      ease: MOTION.ease.enter,
      onUpdate: () => {
        circle.style.strokeDashoffset = `${circumference * (1 - state.v / 100)}`
      },
      onComplete: () => {
        circle.style.strokeDashoffset = `${circumference * (1 - clamped / 100)}`
      },
    })
    return stop(instance)
  }, [clamped, circumference])

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-sunken"
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ stroke: color ?? RING_COLORS[variant] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {children ?? (
          <span className="tabular text-lg font-bold text-foreground">{clamped}%</span>
        )}
      </div>
    </div>
  )
}
