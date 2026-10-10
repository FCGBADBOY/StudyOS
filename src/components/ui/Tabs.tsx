import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { MOTION } from '@/animations'
import { moveNavIndicator } from '@/animations/sidebarAnimations'
import { fadeUp } from '@/animations/staggerAnimations'
import { cn } from '@/utils/cn'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  count?: number
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** Compact pill style (mobile) vs. underline style (desktop). */
  variant?: 'underline' | 'pills'
  size?: 'sm' | 'md'
  className?: string
  /** Accessible name for the tablist. */
  label?: string
}

/**
 * Tab strip with an Anime.js-animated indicator that slides between items.
 * The indicator is measured on mount and on every selection change.
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  className,
  label = 'Sections',
}: TabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const indicator = indicatorRef.current
    const active = container?.querySelector<HTMLButtonElement>('[data-active="true"]')
    if (!container || !indicator || !active) return
    activeRef.current = active
    return moveNavIndicator(indicator, container, active)
  }, [value, items])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const index = items.findIndex((item) => item.id === value)
    const next = event.key === 'ArrowRight' ? index + 1 : index - 1
    if (next < 0 || next >= items.length) return
    onChange(items[next].id)
    requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLButtonElement>('[data-active="true"]')
        ?.focus()
    })
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex items-center',
        variant === 'underline'
          ? 'gap-1 overflow-x-auto border-b border-border no-scrollbar'
          : 'gap-2 overflow-x-auto no-scrollbar',
        className,
      )}
    >
      {variant === 'underline' && (
        <span
          ref={indicatorRef}
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-brand opacity-0"
        />
      )}
      {variant === 'pills' && (
        <span
          ref={indicatorRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-full rounded-control bg-surface-muted opacity-0"
        />
      )}
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative shrink-0 whitespace-nowrap font-medium transition-colors duration-150',
              size === 'sm' ? 'px-2.5 py-2 text-[13px]' : 'px-3 py-3 text-sm',
              active ? 'text-brand' : 'text-muted hover:text-foreground',
              variant === 'pills' && active && 'text-foreground',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {typeof item.count === 'number' && (
                <span
                  className={cn(
                    'tabular rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                    active ? 'bg-brand-soft text-brand-soft-fg' : 'bg-surface-muted text-faint',
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Content that swaps with a soft fade whenever `id` changes. */
export function TabPanel({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    return fadeUp(ref.current, { distance: 10, duration: MOTION.duration.base })
  }, [id])

  return (
    <div key={id} ref={ref} role="tabpanel" className={className}>
      {children}
    </div>
  )
}
