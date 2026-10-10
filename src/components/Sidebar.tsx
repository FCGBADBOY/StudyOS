import { useLayoutEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GraduationCap, Sparkles } from 'lucide-react'
import { sidebarRowActivate } from '@/animations'
import { isNavActive, SIDEBAR_NAV, type NavItem } from '@/config/navigation'
import { PROFILE } from '@/data/profile'
import { Avatar } from '@/components/ui'
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
        'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium outline-none',
        'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-ring',
        active ? 'bg-brand-soft text-brand-soft-fg' : 'text-muted hover:bg-surface-muted hover:text-foreground',
      )}
    >
      {/* Active marker */}
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          '[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.7]',
          active ? 'text-brand' : 'text-faint group-hover:text-muted',
        )}
      >
        <Icon />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  )
}

/**
 * Persistent sidebar for tablet and desktop. Hidden below `md`, where the
 * bottom navigation takes over.
 */
export function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside
      aria-label="Sections"
      className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-surface md:flex"
    >
      {/* Brand */}
      <Link
        to="/dashboard"
        className="flex items-center gap-2.5 px-4 pt-5 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-control"
      >
        <span className="grid h-9 w-9 place-items-center rounded-tile bg-brand text-brand-fg shadow-card">
          <GraduationCap aria-hidden className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold leading-tight tracking-tight text-foreground">
            StudyOS
          </span>
          <span className="block text-[11px] leading-tight text-faint">Class 12 · CBSE</span>
        </span>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
        {SIDEBAR_NAV.map((group) => (
          <div key={group.title} className="mt-4 first:mt-1">
            <h2 className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
              {group.title}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarRow key={`${group.title}-${item.label}`} item={item} active={isNavActive(pathname, item)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Daily goal footer */}
      <div className="border-t border-border p-3">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-control p-2 outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          <Avatar name={PROFILE.name} initials={PROFILE.initials} size="sm" decorative />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-foreground">{PROFILE.name}</span>
            <span className="flex items-center gap-1 text-[11px] text-faint">
              <Sparkles aria-hidden className="h-3 w-3 text-brand" />
              {PROFILE.streak}-day streak
            </span>
          </span>
        </Link>
      </div>
    </aside>
  )
}
