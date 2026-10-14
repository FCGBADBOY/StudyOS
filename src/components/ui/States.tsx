import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { skeletonPulse, spin } from '@/animations'
import { themeColors, type ThemeKey } from '@/config/visual'
import { Illustration, type IllustrationName } from './Illustration'
import { Button } from './Button'
import { cn } from '@/utils/cn'

/* ------------------------------- skeletons -------------------------------- */

/**
 * Generic shimmering block. The fill is a warm tint rather than a grey slab,
 * and the sweep runs on Anime.js (no CSS keyframes anywhere in the app), so a
 * loading screen already looks like the page that is about to arrive.
 */
export function Skeleton({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    return skeletonPulse(ref.current)
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('rounded-tile bg-surface-sunken/70', className)}
      style={{ opacity: 0.7 }}
    />
  )
}

/** Card-shaped skeleton matching the standard resource/chapter card. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-card bg-surface p-4 shadow-card sm:p-5', className)} aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-tile" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2 w-2/3" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

/** Repeating card skeletons with an accessible "loading" status. */
export function SkeletonList({
  count = 3,
  label = 'Loading content',
}: {
  count?: number
  label?: string
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-3">
      <span className="sr-only">{label}…</span>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- loading --------------------------------- */

export function LoadingState({
  label = 'Loading',
  className,
}: {
  label?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    return spin(ref.current, true)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-card bg-cream px-6 py-12 text-center',
        className,
      )}
    >
      {/* Two nested arcs on a tinted ground — a designed loader, not a spinner. */}
      <span aria-hidden className="relative grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 rounded-full bg-brand-soft" />
        <span
          ref={ref}
          className="relative h-8 w-8 rounded-full border-[3px] border-brand/25 border-t-brand"
        />
      </span>
      <p className="text-sm font-medium text-muted">{label}…</p>
    </div>
  )
}

/* --------------------------------- states --------------------------------- */

export interface StateProps {
  title: string
  description?: string
  /** Override the illustration entirely with an icon. */
  icon?: ReactNode
  /** Pick the editorial drawing instead of the default "empty" one. */
  illustration?: IllustrationName
  /** Tints the illustration + the soft ground behind it. */
  theme?: ThemeKey
  action?: ReactNode
  className?: string
  compact?: boolean
}

function StateShell({
  title,
  description,
  icon,
  illustration = 'empty',
  theme = 'brand',
  action,
  className,
  compact,
}: StateProps) {
  const c = themeColors(theme)

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden rounded-card text-center',
        'bg-cream',
        compact ? 'px-4 py-8' : 'px-6 py-12',
        className,
      )}
    >
      {/* faint themed wash so an empty screen is never a blank rectangle */}
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-70', c.field)} />

      <div className="relative flex flex-col items-center">
        <div className={cn('w-28 sm:w-32', compact && 'w-24')}>
          {icon ? (
            <span
              aria-hidden
              className={cn(
                'mx-auto grid h-14 w-14 place-items-center rounded-card [&_svg]:h-6 [&_svg]:w-6',
                c.soft,
                c.onSoft,
              )}
            >
              {icon}
            </span>
          ) : (
            <Illustration name={illustration} theme={theme} decorative />
          )}
        </div>

        <h3 className="mt-4 text-[15px] font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
        )}
        {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
      </div>
    </div>
  )
}

/** "No notes found." — illustrated, never a blank panel with a line of text. */
export function EmptyState(props: StateProps) {
  return <StateShell {...props} />
}

/** Something failed to load. `title` falls back to a generic message. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Check your connection and try again.',
  onRetry,
  illustration = 'notebook',
  theme = 'brand',
  ...rest
}: Omit<StateProps, 'title'> & { title?: string; onRetry?: () => void }) {
  return (
    <StateShell
      title={title}
      description={description}
      icon={<TriangleAlert />}
      illustration={illustration}
      theme={theme}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} icon={<RefreshCw />}>
            Try again
          </Button>
        ) : (
          rest.action
        )
      }
      {...rest}
    />
  )
}

/** Offline with reassurance about downloaded material. */
export function OfflineState({
  title = 'You are offline',
  description = 'You are offline. Your downloaded resources are still available.',
  action,
  className,
  compact,
  illustration = 'book',
  theme = 'sky',
}: StateProps) {
  return (
    <StateShell
      title={title}
      description={description}
      icon={<CloudOff />}
      action={action}
      className={className}
      compact={compact}
      illustration={illustration}
      theme={theme}
    />
  )
}
