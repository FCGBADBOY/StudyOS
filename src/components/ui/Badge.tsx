import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { bookmarkPop } from '@/animations/feedbackAnimations'
import { themeColors, type ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

export type BadgeVariant = 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline'

const BADGE_STYLES: Record<BadgeVariant, string> = {
  brand: 'bg-brand-soft text-brand-soft-fg',
  accent: 'bg-accent-soft text-accent-fg',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-muted text-muted',
  outline: 'border border-border-strong text-muted',
}

export interface BadgeProps {
  variant?: BadgeVariant
  /**
   * Themed badge — pass `'physics'`, `'chemistry'`, `'pyq'`, `'ai'`… to get that
   * identity's soft ground and readable foreground. Takes precedence over
   * `variant`, so subject/status labels stay consistent app-wide.
   */
  theme?: ThemeKey
  children: ReactNode
  className?: string
  icon?: ReactNode
  size?: 'sm' | 'md'
  /** Leading status dot — quieter than an icon for state labels. */
  dot?: boolean
  /** Editorial treatment: tracked uppercase, for eyebrows like OFFICIAL. */
  uppercase?: boolean
  /** Draw attention without shouting (used for IMPORTANT / weak chapters). */
  emphasis?: boolean
}

/**
 * Compact status/identity label.
 *
 * Deliberately soft — every variant is a tint, never a saturated fill, so a
 * screen can carry six of them without turning into confetti.
 */
export function Badge({
  variant = 'neutral',
  theme,
  children,
  className,
  icon,
  size = 'sm',
  dot = false,
  uppercase = false,
  emphasis = false,
}: BadgeProps) {
  const c = theme ? themeColors(theme) : null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap align-middle',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        c ? cn(c.soft, c.onSoft) : BADGE_STYLES[variant],
        uppercase && 'uppercase tracking-[0.08em]',
        emphasis && 'ring-1 ring-inset ring-border-strong',
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', c ? c.solid : 'bg-current')} />}
      {icon && (
        <span aria-hidden className="[&_svg]:h-3 [&_svg]:w-3">
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}

export interface ChipProps {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
  icon?: ReactNode
  /** Accessible label when the chip is icon-only. */
  ariaLabel?: string
}

/**
 * Selectable pill — used for onboarding choices and filters.
 * The check icon pops with an Anime.js bounce when selected.
 */
export function Chip({ children, selected = false, onClick, className, icon, ariaLabel }: ChipProps) {
  const ref = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!selected || !ref.current) return
    return bookmarkPop(ref.current, true)
  }, [selected])

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150',
        'outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
        selected
          ? 'border-brand-ring bg-brand-soft text-brand-soft-fg shadow-card'
          : 'border-border bg-surface text-muted hover:border-border-strong hover:text-foreground',
        className,
      )}
    >
      {icon && (
        <span aria-hidden className="[&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}
