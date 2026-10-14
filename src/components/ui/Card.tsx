import {
  createElement,
  forwardRef,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { pressable, cardHover } from '@/animations'
import { themeColors, type ThemeKey } from '@/config/visual'
import { IconTile } from './IconTile'
import { cn } from '@/utils/cn'

export type CardElevation = 'flat' | 'card' | 'raised' | 'hero'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Adds press/hover affordance — use for tappable cards. */
  interactive?: boolean
  padded?: boolean
  /**
   * Depth level. `card` (default) is the everyday soft shadow; nothing carries
   * a visible border unless you ask for one.
   */
  elevation?: CardElevation
  /** Opt back into a hairline edge — useful on already-tinted surfaces. */
  bordered?: boolean
  /**
   * Tinted surface. Pass a theme key (`'chemistry'`, `'ai'`, `'coral'`) to get
   * that hue's soft ground, or `'cream'` for a warm neutral band.
   */
  tone?: ThemeKey | 'cream' | 'default'
  as?: 'div' | 'article' | 'section'
}

const ELEVATIONS: Record<CardElevation, string> = {
  flat: 'shadow-none',
  card: 'shadow-card',
  raised: 'shadow-raised',
  hero: 'shadow-hero',
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    interactive = false,
    padded = true,
    elevation = 'card',
    bordered = false,
    tone = 'default',
    as = 'div',
    className,
    ...rest
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!interactive) return
    /* Press on tap; lift on hover-capable pointers only (see `cardHover`). */
    const stopPress = pressable(localRef.current)
    const stopHover = cardHover(localRef.current)
    return () => {
      stopPress()
      stopHover()
    }
  }, [interactive])

  const setRefs = (node: HTMLElement | null) => {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  const tint =
    tone === 'default'
      ? 'bg-surface'
      : tone === 'cream'
        ? 'bg-cream'
        : themeColors(tone).soft

  return createElement(as, {
    ...rest,
    ref: setRefs,
    className: cn(
      'rounded-card',
      tint,
      ELEVATIONS[elevation],
      bordered && 'border border-border',
      padded && 'p-4 sm:p-5',
      interactive &&
        'cursor-pointer outline-none transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-brand-ring',
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
  theme,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
  /** When `icon` is set, pick the tile's colour here. */
  theme?: ThemeKey
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <IconTile icon={icon} theme={theme ?? 'brand'} size="sm" />}
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
  /** Kept as the original union for compatibility; any theme key also works. */
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | ThemeKey
  className?: string
}

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
      {icon && <IconTile icon={icon} theme={accent as ThemeKey} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-muted">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1">
          <span className="text-xl font-bold tracking-tight tabular text-foreground sm:text-2xl">
            {value}
          </span>
          {unit && <span className="text-[13px] font-semibold text-faint">{unit}</span>}
        </p>
        {trend && (
          <p className={cn('mt-0.5 text-[12px] font-medium', TREND_TONES[trendTone])}>{trend}</p>
        )}
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Card variants — each has a distinct visual job, so screens stop reaching for */
/* one generic box for everything.                                             */
/* -------------------------------------------------------------------------- */

export interface FeatureCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Eyebrow label above the title. */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Large visual on the trailing side. */
  media?: ReactNode
  /** Call-to-action cluster, normally rendered under the description. */
  action?: ReactNode
  /** Metadata chips rendered between description and action. */
  meta?: ReactNode
  tone?: ThemeKey | 'cream'
  className?: string
}

/**
 * The visual centrepiece of a section — Today's Study, a chapter header, a
 * flagship feature. Tinted, deeper than a normal card, illustration-friendly
 * and deliberately *not* the same weight as the cards around it.
 */
export function FeatureCard({
  eyebrow,
  title,
  description,
  media,
  action,
  meta,
  tone = 'brand',
  className,
  ...rest
}: FeatureCardProps) {
  const c = themeColors(tone === 'cream' ? 'neutral' : tone)
  const ground = tone === 'cream' ? 'bg-cream' : c.soft

  return (
    <article
      className={cn(
        'relative isolate overflow-hidden rounded-hero shadow-hero',
        ground,
        'before:pointer-events-none before:absolute before:inset-0 before:-z-10',
        'before:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(255,255,255,0.7),transparent_58%)]',
        'dark:before:bg-[radial-gradient(120%_100%_at_100%_0%,rgba(255,255,255,0.08),transparent_58%)]',
        'p-5 sm:p-7',
        className,
      )}
      {...rest}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className={cn('eyebrow mb-2', c.onSoft, 'opacity-80')}>{eyebrow}</p>}
          <h2 className="text-display text-2xl text-foreground sm:text-[28px]">{title}</h2>
          {description && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-[15px]">
              {description}
            </p>
          )}
          {meta && <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>}
          {action && <div className="mt-5 flex flex-wrap items-center gap-2.5">{action}</div>}
        </div>
        {media && (
          <div className="relative shrink-0 sm:w-[42%] sm:max-w-[300px]">{media}</div>
        )}
      </div>
    </article>
  )
}

export interface ActionCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  theme?: ThemeKey
  /** Trailing chevron or arrow. */
  trailing?: ReactNode
  /** Larger treatment for a 2×2 quick-action grid. */
  size?: 'md' | 'lg'
  /** Render as a real control when it is the whole link/button. */
  as?: 'div' | 'button' | 'a'
}

/**
 * Quick-action tile: a designed icon container, a short title and one line of
 * explanation. The whole card is the hit target.
 */
export function ActionCard({
  icon,
  title,
  description,
  theme = 'brand',
  trailing,
  size = 'md',
  as = 'div',
  className,
  ...rest
}: ActionCardProps) {
  const localRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const stop = cardHover(localRef.current)
    return stop
  }, [])

  return createElement(as, {
    ...(rest as HTMLAttributes<HTMLElement>),
    ...(as === 'button' ? { type: 'button' } : {}),
    ref: localRef,
    className: cn(
      'group relative flex cursor-pointer flex-col gap-3 rounded-card bg-surface p-4 shadow-card',
      'outline-none transition-shadow duration-150 hover:shadow-raised',
      'focus-visible:ring-2 focus-visible:ring-brand-ring sm:p-5',
      size === 'lg' && 'gap-4 p-5 sm:p-6',
      className,
    ),
    children: (
      <>
        <div className="flex items-start justify-between gap-3">
          <IconTile
            icon={icon}
            theme={theme}
            variant="gradient"
            size={size === 'lg' ? 'lg' : 'md'}
          />
          {trailing && (
            <span
              aria-hidden
              className="mt-1 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
            >
              {trailing}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'font-semibold tracking-tight text-foreground',
              size === 'lg' ? 'text-base' : 'text-sm',
            )}
          >
            {title}
          </p>
          {description && <p className="mt-1 text-[13px] leading-snug text-muted">{description}</p>}
        </div>
      </>
    ),
  })
}

export interface InsightCardProps {
  /** Small coloured marker, e.g. a numbered step. */
  marker?: ReactNode
  title: ReactNode
  body?: ReactNode
  /** Points/score line explaining *why* this was surfaced. */
  detail?: ReactNode
  tone?: ThemeKey
  className?: string
}

/**
 * Explainable recommendation — "why am I being shown this?" Always carries its
 * reasoning, because a study suggestion a student cannot justify is noise.
 */
export function InsightCard({
  marker,
  title,
  body,
  detail,
  tone = 'brand',
  className,
}: InsightCardProps) {
  const c = themeColors(tone)

  return (
    <div
      className={cn(
        'flex gap-3 rounded-card border-l-[3px] bg-surface p-4 shadow-card',
        className,
      )}
      style={{ borderLeftColor: c.accentVar }}
    >
      {marker ? (
        <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[12px] font-bold', c.soft, c.onSoft)}>
          {marker}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
        {body && <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>}
        {detail && (
          <p className={cn('mt-2 text-[12px] font-medium', c.onSoft)}>{detail}</p>
        )}
      </div>
    </div>
  )
}
