import { useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { pageEnter, resetScroll } from '@/animations'
import { BottomNavigation } from '@/components/BottomNavigation'
import { GlobalSearch } from '@/components/GlobalSearch'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'

/**
 * Routes mounted inside the layout share one transition: the outlet is keyed
 * by pathname, so each navigation unmounts the old page and animates the new
 * one in. Pages themselves never call `pageEnter` — they only stagger their
 * own sections.
 */
function AnimatedOutlet() {
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    resetScroll()
    return pageEnter(ref.current)
  }, [pathname])

  return (
    <div key={pathname} ref={ref} className="min-w-0">
      <Outlet />
    </div>
  )
}

/**
 * Shell for every signed-in route: fixed sidebar from `md`, sticky top bar,
 * routed content, bottom navigation on phones, plus the global search surface.
 */
export function AppLayout() {
  return (
    <div className="relative min-h-dvh bg-background paper-texture">
      {/* One ambient field for the whole shell — keeps long scroll runs from
          reading as flat paper without ever competing with content. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] bg-[radial-gradient(70%_100%_at_15%_0%,rgb(35_80_230/0.09),transparent_60%),radial-gradient(50%_90%_at_90%_0%,rgb(18_166_120/0.08),transparent_62%)] dark:bg-[radial-gradient(70%_100%_at_15%_0%,rgb(107_147_255/0.14),transparent_60%),radial-gradient(50%_90%_at_90%_0%,rgb(47_191_143/0.1),transparent_62%)]"
      />
      <div className="relative z-10">
        <Sidebar />
        <div className="md:pl-[252px]">
          <TopBar />
          <main
            id="main"
            className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:px-6 sm:pt-8 md:pb-16"
          >
            <AnimatedOutlet />
          </main>
        </div>
        <BottomNavigation />
        <GlobalSearch />
      </div>
    </div>
  )
}
