import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { moveNavIndicator, navIconActivate } from '@/animations'
import { isNavActive, PRIMARY_NAV, type NavItem } from '@/config/navigation'
import { cn } from '@/utils/cn'

/**
 * Android-style bottom navigation with an animated indicator that slides
 * between items. Renders on phones; the sidebar takes over from `md` up.
 */
export function BottomNavigation() {
  const { pathname } = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())
  const [mounted, setMounted] = useState(false)

  const activeItem: NavItem =
    PRIMARY_NAV.find((item) => isNavActive(pathname, item)) ?? PRIMARY_NAV[0]

  /* Slide the indicator onto whichever item is active. */
  useLayoutEffect(() => {
    const target = itemRefs.current.get(activeItem.to)
    const cleanup = moveNavIndicator(indicatorRef.current, containerRef.current, target)
    setMounted(true)
    return cleanup
  }, [activeItem.to])

  /* Bounce the icon of the newly activated item (skip the very first paint). */
  useLayoutEffect(() => {
    if (!mounted) return
    const target = itemRefs.current.get(activeItem.to)?.querySelector<HTMLElement>('[data-nav-icon]')
    return navIconActivate(target)
  }, [activeItem.to, mounted])

  /* Keep the indicator aligned when the viewport resizes (rotate, split screen). */
  useLayoutEffect(() => {
    const onResize = () => {
      const target = itemRefs.current.get(activeItem.to)
      const container = containerRef.current
      const indicator = indicatorRef.current
      if (!target || !container || !indicator) return
      const box = target.getBoundingClientRect()
      const containerBox = container.getBoundingClientRect()
      indicator.style.transform = `translate3d(${box.left - containerBox.left + container.scrollLeft}px, 0, 0)`
      indicator.style.width = `${box.width}px`
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activeItem.to])

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 shadow-nav backdrop-blur-xl supports-[backdrop-filter]:bg-surface/85 md:hidden"
    >
      <div
        ref={containerRef}
        className="relative mx-auto flex max-w-md items-stretch px-1.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+4px)]"
      >
        {/* Animated sliding indicator */}
        <span
          ref={indicatorRef}
          aria-hidden
          data-nav-indicator
          className={cn(
            'pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 rounded-tile bg-brand-soft',
            'shadow-[0_4px_14px_-8px_var(--brand-ring)]',
            'opacity-0',
          )}
        />
        {PRIMARY_NAV.map((item) => {
          const active = isNavActive(pathname, item)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              ref={(node: HTMLAnchorElement | null) => {
                if (node) itemRefs.current.set(item.to, node)
                else itemRefs.current.delete(item.to)
              }}
              aria-current={active ? 'page' : undefined}
              className="relative z-10 flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-tile px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <span
                data-nav-icon
                aria-hidden
                className={cn(
                  'transition-colors duration-150 [&_svg]:h-[21px] [&_svg]:w-[21px]',
                  active ? 'text-brand [&_svg]:stroke-[2.1]' : 'text-faint [&_svg]:stroke-[1.7]',
                )}
              >
                <Icon />
              </span>
              <span
                className={cn(
                  'text-[10.5px] leading-none transition-colors duration-150',
                  active ? 'font-bold text-brand-soft-fg' : 'font-medium text-faint',
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
