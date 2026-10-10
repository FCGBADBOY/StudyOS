import { createElement, forwardRef, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { pressable } from '@/animations'
import { cn } from '@/utils/cn'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Adds press/hover affordance — use for tappable cards. */
  interactive?: boolean
  padded?: boolean
  elevation?: 'flat' | 'card' | 'raised'
  as?: 'div' | 'article' | 'section'
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { interactive = false, padded = true, elevation = 'card', as = 'div', className, ...rest },
  forwardedRef,
) {
  const localRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!interactive) return
    return pressable(localRef.current)
  }, [interactive])

  const setRefs = (node: HTMLElement | null) => {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  return createElement(as, {
    ...rest,
    ref: setRefs,
    className: cn(
      'rounded-card border border-border bg-surface',
      elevation === 'card' && 'shadow-card',
      elevation === 'raised' && 'shadow-raised',
      padded && 'p-4 sm:p-5',
      interactive &&
        'cursor-pointer transition-colors duration-150 hover:border-border-strong focus-within:border-brand-ring',
      className,
    ),
  })
})

/** Small heading + optional trailing action, used inside cards. */
export function CardHeader({
  title,
  subtitle,
  action,
  className,
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            aria-hidden
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg [&_svg]:h-[18px] [&_svg]:w-[18px]"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export interface StatCardProps {
  label: string
  value: ReactNode
  /** Small unit rendered after the value ("min", "%"). */
  unit?: string
  icon?: ReactNode
  /** Delta line under the value — "+12% this week". */
  trend?: string
  trendTone?: 'positive' | 'negative' | 'neutral'
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'
  className?: string
}

const STAT_ACCENTS = {
  brand: 'bg-brand-soft text-brand-soft-fg',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-muted text-muted',
} as const

const TREND_TONES = {
  positive: 'text-success',
  negative: 'text-danger',
  neutral: 'text-muted',
} as const

/** Compact KPI tile used across Dashboard, Progress and Profile. */
export function StatCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendTone = 'neutral',
  accent = 'brand',
  className,
}: StatCardProps) {
  return (
    <Card padded className={cn('flex items-start gap-3', className)}>
      {icon && (
        <span
          aria-hidden
          className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-tile [&_svg]:h-[18px] [&_svg]:w-[18px]', STAT_ACCENTS[accent])}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-muted">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1">
          <span className="text-xl font-bold tracking-tight tabular text-foreground sm:text-2xl">{value}</span>
          {unit && <span className="text-[13px] font-semibold text-faint">{unit}</span>}
        </p>
        {trend && <p className={cn('mt-0.5 text-[12px] font-medium', TREND_TONES[trendTone])}>{trend}</p>}
      </div>
    </Card>
  )
}
