import { useLayoutEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { pageEnter, resetScroll } from '@/animations'
import { GlobalSearch } from '@/components/GlobalSearch'

/**
 * Chrome-free shell for the marketing page and onboarding. Still renders the
 * global search surface so ⌘K works everywhere.
 */
export function PlainLayout() {
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    resetScroll()
    return pageEnter(ref.current, { distance: 16 })
  }, [pathname])

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          aria-label="StudyOS home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-tile bg-brand text-brand-fg shadow-card">
            <GraduationCap aria-hidden className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-foreground">StudyOS</span>
        </Link>
        <Link
          to="/dashboard"
          className="rounded-control px-3 py-2 text-sm font-semibold text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          Skip to app
        </Link>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div key={pathname} ref={ref}>
          <Outlet />
        </div>
      </main>

      <GlobalSearch />
    </div>
  )
}
