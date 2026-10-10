import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { CloudOff, Inbox, RefreshCw, TriangleAlert } from 'lucide-react'
import { skeletonPulse, spin } from '@/animations'
import { Button } from './Button'
import { cn } from '@/utils/cn'

/* ------------------------------- skeletons -------------------------------- */

/** Generic shimmering block. */
export function Skeleton({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    return skeletonPulse(ref.current)
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('rounded-tile bg-surface-muted', className)}
      style={{ opacity: 0.7 }}
    />
  )
}

/** Card-shaped skeleton matching the standard resource/chapter card. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-card border border-border bg-surface p-4 sm:p-5', className)}
      aria-hidden
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-tile" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2 w-2/3" />
      </div>
    </div>
  )
}

/** Repeating card skeletons with an accessible "loading" status. */
export function SkeletonList({ count = 3, label = 'Loading content' }: { count?: number; label?: string }) {
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
      className={cn('flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface px-6 py-12', className)}
    >
      <span
        ref={ref}
        aria-hidden
        className="h-7 w-7 rounded-full border-2 border-brand/30 border-t-brand"
      />
      <p className="text-sm font-medium text-muted">{label}…</p>
    </div>
  )
}

/* --------------------------------- states --------------------------------- */

export interface StateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}

function StateShell({ title, description, icon, action, className, compact }: StateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12',
        className,
      )}
    >
      {icon && (
        <span aria-hidden className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-muted text-faint [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
      )}
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** "No notes found." */
export function EmptyState(props: StateProps) {
  return <StateShell icon={<Inbox />} {...props} />
}

/** Something failed to load. `title` falls back to a generic message. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Check your connection and try again.',
  onRetry,
  ...rest
}: Omit<StateProps, 'title'> & { title?: string; onRetry?: () => void }) {
  return (
    <StateShell
      title={title}
      description={description}
      icon={<TriangleAlert />}
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
}: StateProps) {
  return (
    <StateShell
      title={title}
      description={description}
      icon={<CloudOff />}
      action={action}
      className={className}
      compact={compact}
    />
  )
}
