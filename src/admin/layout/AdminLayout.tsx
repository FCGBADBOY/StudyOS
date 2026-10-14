/**
 * Admin Portal shell.
 *
 * Deliberately distinct from the student `AppLayout` while staying in the same
 * design language: a persistent left rail on desktop (240px), a slide-in
 * drawer on phones, and a top bar carrying the admin identity. The student
 * bottom navigation is absent — an admin is never one tap from the library.
 *
 * Route transitions reuse the same keyed-outlet pattern as the student app so
 * navigation feels like one product, but use the quieter `adminPageEnter`.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, ShieldCheck, Sun, X } from 'lucide-react'
import { resetScroll } from '@/animations'
import { IconButton, Avatar, Badge } from '@/components/ui'
import { useTheme, useToast } from '@/context/AppProvider'
import { adminPageEnter, sidebarClose, sidebarOpen } from '../animations/adminAnimations'
import { ADMIN_NAV } from '../config/adminNav'
import { can, isStaff } from '../lib/permissions'
import { useAdminSession } from '../hooks/useAdminSession'

/** Quiet page transition for admin routes. */
function AnimatedOutlet() {
  const { pathname } = useLocation()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    resetScroll()
    return adminPageEnter(ref.current)
  }, [pathname])

  return (
    <div key={pathname} ref={ref} className="min-w-0">
      <Outlet />
    </div>
  )
}

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const { toast } = useToast()
  const { role, profile, signOut, loading } = useAdminSession()

  /* Close the drawer whenever the route changes. */
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  /* Lock body scroll while the drawer is open on a phone. */
  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  useLayoutEffect(() => {
    if (drawerOpen) return sidebarOpen(drawerRef.current)
  }, [drawerOpen])

  function closeDrawer() {
    sidebarClose(drawerRef.current, () => setDrawerOpen(false))
  }

  async function handleSignOut() {
    await signOut()
    toast({ title: 'Signed out', description: 'You have been signed out of the Admin Portal.', variant: 'default' })
    navigate('/admin/login')
  }

  const visibleGroups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(role, item.permission)),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="min-h-dvh bg-background">
      {/* Skip link — the rail is the first focusable element on desktop. */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                   focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-sm
                   focus:font-medium focus:text-brand-fg"
      >
        Skip to content
      </a>

      {/* ---------------------------------------------------------- rail */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border
                   bg-surface md:flex"
        aria-label="Admin navigation"
      >
        <RailContent
          groups={visibleGroups}
          onNavigate={() => undefined}
          loading={loading}
        />
      </aside>

      {/* -------------------------------------------------------- drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeDrawer}
            className="absolute inset-0 bg-overlay"
          />
          <aside
            ref={drawerRef}
            className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border
                       bg-surface shadow-pop"
            aria-label="Admin navigation"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Navigation</span>
              <IconButton label="Close navigation" onClick={closeDrawer} variant="ghost">
                <X className="size-5" aria-hidden="true" />
              </IconButton>
            </div>
            <RailContent groups={visibleGroups} onNavigate={closeDrawer} loading={loading} />
          </aside>
        </div>
      )}

      {/* ---------------------------------------------------------- main */}
      <div className="md:pl-60">
        <header
          className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <IconButton
              label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              variant="ghost"
              className="md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </IconButton>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">StudyOS Admin</p>
              <p className="truncate text-xs text-muted">
                {loading ? 'Checking access…' : `Signed in as ${roleLabel(role)}`}
              </p>
            </div>

            <IconButton
              label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              variant="ghost"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="size-5" aria-hidden="true" />
              ) : (
                <Moon className="size-5" aria-hidden="true" />
              )}
            </IconButton>

            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="truncate text-sm font-medium text-foreground">
                  {profile?.full_name ?? 'Administrator'}
                </p>
                <p className="truncate text-xs text-muted">{profile?.email ?? 'admin@studyos.dev'}</p>
              </div>
              <Avatar
                name={profile?.full_name ?? 'Administrator'}
                src={profile?.avatar_url ?? undefined}
                size="sm"
              />
            </div>

            <IconButton label="Sign out" onClick={handleSignOut} variant="ghost">
              <LogOut className="size-5" aria-hidden="true" />
            </IconButton>
          </div>
        </header>

        <main id="admin-main" className="px-4 py-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:px-6 sm:py-7">
          <AnimatedOutlet />
        </main>
      </div>
    </div>
  )
}

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

interface RailContentProps {
  groups: typeof ADMIN_NAV
  onNavigate: () => void
  loading: boolean
}

function RailContent({ groups, onNavigate, loading }: RailContentProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Link
        to="/admin/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-3 border-b border-border px-4 py-4
                   transition-colors hover:bg-surface-muted focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <span className="flex size-9 items-center justify-center rounded-control bg-brand text-brand-fg">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">StudyOS</span>
          <span className="block truncate text-xs text-muted">Admin Portal</span>
        </span>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Sections">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-control bg-surface-sunken" />
            ))}
          </div>
        ) : (
          <ul className="space-y-5">
            {groups.map((group) => (
              <li key={group.id}>
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        onClick={onNavigate}
                        /* A custom `match` is authoritative, so let it — not
                           NavLink's prefix test — decide the active state. */
                        end
                        className={({ isActive }) =>
                          [
                            'flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm',
                            'transition-colors focus-visible:outline-none focus-visible:ring-2',
                            'focus-visible:ring-brand-ring',
                            isActive || item.match?.(window.location.pathname)
                              ? 'bg-brand-soft font-medium text-brand-soft-fg'
                              : 'text-muted hover:bg-surface-muted hover:text-foreground',
                          ].join(' ')
                        }
                      >
                        <item.icon className="size-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {isStaff(null) && (
        <div className="border-t border-border px-4 py-3">
          <Badge variant="outline">Staff access</Badge>
        </div>
      )}
    </div>
  )
}
