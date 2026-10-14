import { useLayoutEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Flame } from 'lucide-react'
import { sidebarRowActivate } from '@/animations'
import { isNavActive, SIDEBAR_NAV, type NavItem } from '@/config/navigation'
import { PROFILE } from '@/data/profile'
import { Avatar } from '@/components/ui'
import { Logo } from '@/components/LogoMark'
import { cn } from '@/utils/cn'

function SidebarRow({ item, active }: { item: NavItem; active: boolean }) {
  const rowRef = useRef<HTMLAnchorElement>(null)
  const Icon = item.icon

  /* Left-edge sweep whenever this row becomes the active destination. */
  useLayoutEffect(() => {
    if (!active) return
    return sidebarRowActivate(rowRef.current)
  }, [active])

  return (
    <Link
      ref={rowRef}
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-tile px-3 py-2.5 text-sm font-semibold outline-none',
        'transition-[background-color,color,box-shadow] duration-150',
        'focus-visible:ring-2 focus-visible:ring-brand-ring',
        active
          ? 'bg-brand-soft text-brand-soft-fg shadow-[0_2px_10px_-6px_var(--brand-ring)]'
          : 'text-muted hover:bg-surface-muted hover:text-foreground',
      )}
    >
      {/* Active marker — a short brand rail that the sweep animation reveals. */}
      <span
        aria-hidden
        data-nav-rail
        className={cn(
          'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          '[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.8]',
          active ? 'text-brand' : 'text-faint group-hover:text-muted',
        )}
      >
        <Icon />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {active && (
        <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand/60" />
      )}
    </Link>
  )
}

/**
 * Persistent sidebar for tablet and desktop. Hidden below `md`, where the
 * bottom navigation takes over.
 *
 * Warm ground, a soft edge instead of a hairline, section labels, a rich
 * rounded active state and a profile card anchoring the bottom.
 */
export function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside
      aria-label="Sections"
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col bg-cream',
        /* separation by tone + a wide soft edge, not a 1px rule */
        'shadow-[1px_0_0_var(--border),10px_0_30px_-24px_rgba(64,52,34,0.5)]',
        'md:flex',
      )}
    >
      {/* Brand */}
      <Link
        to="/dashboard"
        className="mx-3 mt-5 mb-1 rounded-tile px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        aria-label="StudyOS home"
      >
        <Logo size={38} />
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-4 no-scrollbar">
        {SIDEBAR_NAV.map((group) => (
          <div key={group.title} className="mt-5 first:mt-1">
            <h2 className="eyebrow mb-2 px-3">{group.title}</h2>
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarRow
                  key={`${group.title}-${item.label}`}
                  item={item}
                  active={isNavActive(pathname, item)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Daily goal + profile card */}
      <div className="px-3 pb-4">
        <Link
          to="/profile"
          className={cn(
            'block rounded-card bg-surface p-3 shadow-card',
            'outline-none transition-shadow duration-150 hover:shadow-raised',
            'focus-visible:ring-2 focus-visible:ring-brand-ring',
          )}
        >
          <div className="flex items-center gap-3">
            <Avatar name={PROFILE.name} initials={PROFILE.initials} size="sm" decorative />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-foreground">
                {PROFILE.name}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
                <Flame aria-hidden className="h-3 w-3 text-coral" />
                {PROFILE.streak}-day streak
              </span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
          </div>
        </Link>
      </div>
    </aside>
  )
}
