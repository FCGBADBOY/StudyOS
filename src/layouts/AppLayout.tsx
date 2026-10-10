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
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <div className="md:pl-[248px]">
        <TopBar />
        <main
          id="main"
          className="mx-auto w-full max-w-6xl px-4 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] sm:px-6 sm:pt-7 md:pb-14"
        >
          <AnimatedOutlet />
        </main>
      </div>
      <BottomNavigation />
      <GlobalSearch />
    </div>
  )
}
