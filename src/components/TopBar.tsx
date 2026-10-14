import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Search,
  Settings2,
  Sun,
  UserRound,
} from 'lucide-react'
import { dropdownIn, dropdownOut } from '@/animations'
import { useApp } from '@/context/AppProvider'
import { useAuth } from '@/hooks/useAuth'
import { NOTIFICATIONS } from '@/data/notifications'
import { PROFILE } from '@/data/profile'
import { Avatar, Badge, BottomSheet, Button, IconButton, SearchBar } from '@/components/ui'
import { Logo } from '@/components/LogoMark'
import { PRIMARY_NAV, isNavActive } from '@/config/navigation'

function titleFor(pathname: string): string {
  const nav = [...PRIMARY_NAV].reverse().find((item) => isNavActive(pathname, item))
  if (nav) return nav.label
  if (pathname.startsWith('/mistakebook')) return 'MistakeBook'
  if (pathname.startsWith('/formula-flow')) return 'Formula Flow'
  if (pathname.startsWith('/reaction-lab')) return 'Reaction Lab'
  if (pathname.startsWith('/progress')) return 'Progress'
  if (pathname.startsWith('/profile')) return 'Profile'
  if (pathname.startsWith('/settings')) return 'Settings'
  if (pathname.startsWith('/onboarding')) return 'Setup'
  return 'StudyOS'
}

/**
 * Sticky top bar.
 *
 * Deliberately *not* four identical squares: search is the one wide, pill-shaped
 * control, the theme toggle is a quiet ghost, the bell carries a small status
 * bubble, and the avatar opens a real menu.
 */
export function TopBar() {
  const { pathname } = useLocation()
  const { openSearch, resolvedTheme, setTheme, toast } = useApp()
  const [notifOpen, setNotifOpen] = useState(false)
  /* Read state lives here so the bell badge and the sheet always agree. */
  const [items, setItems] = useState(NOTIFICATIONS)
  const unread = items.filter((item) => !item.read).length

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
    toast({ title: 'All caught up', description: 'Notifications marked as read.', variant: 'success' })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
        {/* Brand — phones only (the sidebar covers it from md up) */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-brand-ring md:hidden"
          aria-label="StudyOS home"
        >
          <Logo size={30} compact />
        </Link>

        <span className="min-w-0 flex-1 lg:flex-none">
          <span className="block truncate text-[15px] font-bold tracking-tight text-foreground sm:text-base">
            {titleFor(pathname)}
          </span>
        </span>

        {/* Search — one wide pill on desktop, a single trigger below lg */}
        <div className="hidden min-w-0 flex-1 lg:block lg:max-w-md">
          <SearchBar onClick={openSearch} hint="⌘K" />
        </div>
        <IconButton
          label="Search notes, PYQs, formulas, chapters"
          variant="soft"
          onClick={openSearch}
          className="lg:hidden"
        >
          <Search />
        </IconButton>

        <IconButton
          label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          variant="ghost"
          onClick={() => {
            const next = resolvedTheme === 'dark' ? 'light' : 'dark'
            setTheme(next)
            toast({ title: `${next === 'dark' ? 'Dark' : 'Light'} theme on`, variant: 'success' })
          }}
        >
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>

        <IconButton
          label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          variant="soft"
          badge={unread}
          onClick={() => setNotifOpen(true)}
        >
          <Bell />
        </IconButton>

        <ProfileMenu />

        <NotificationSheet
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          items={items}
          onMarkAllRead={markAllRead}
        />
      </div>
    </header>
  )
}

/* ------------------------------ profile menu ------------------------------ */

function ProfileMenu() {
  const navigate = useNavigate()
  const { toast } = useApp()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) return dropdownIn(menuRef.current)
    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const close = () => setOpen(false)

  const items = [
    { label: 'Profile', icon: UserRound, to: '/profile' },
    { label: 'Settings', icon: Settings2, to: '/settings' },
  ]

  return (
    <div ref={anchorRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        onClick={() => setOpen((value) => !value)}
        className={cnIconButton(open)}
      >
        <Avatar name={PROFILE.name} initials={PROFILE.initials} size="sm" decorative />
        <ChevronDown
          aria-hidden
          className={`hidden h-3.5 w-3.5 text-faint transition-transform duration-200 sm:block ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 origin-top-right rounded-card bg-surface p-1.5 shadow-pop"
        >
          <div className="flex items-center gap-3 px-2.5 py-3">
            <Avatar name={PROFILE.name} initials={PROFILE.initials} size="md" decorative />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{PROFILE.name}</p>
              <p className="truncate text-[11.5px] text-muted">
                {PROFILE.username} · Class 12
              </p>
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          {items.map((item) => (
            <button
              key={item.to}
              type="button"
              role="menuitem"
              onClick={() => {
                close()
                navigate(item.to)
              }}
              className="flex w-full items-center gap-2.5 rounded-tile px-2.5 py-2.5 text-sm font-medium text-muted outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <item.icon aria-hidden className="h-4 w-4" />
              {item.label}
            </button>
          ))}

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              close()
              try {
                await signOut()
                navigate('/')
              } catch {
                toast({ title: 'Could not sign out', variant: 'danger' })
              }
            }}
            className="flex w-full items-center gap-2.5 rounded-tile px-2.5 py-2.5 text-sm font-medium text-danger outline-none transition-colors hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function cnIconButton(open: boolean): string {
  return [
    'flex items-center gap-1.5 rounded-full p-0.5 pr-2 outline-none',
    'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-ring',
    open ? 'bg-surface-muted' : 'hover:bg-surface-muted',
  ].join(' ')
}

/* ---------------------------- notifications ------------------------------- */

function NotificationSheet({
  open,
  onClose,
  items,
  onMarkAllRead,
}: {
  open: boolean
  onClose: () => void
  items: typeof NOTIFICATIONS
  onMarkAllRead: () => void
}) {
  const navigate = useNavigate()

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Notifications"
      description={`${items.filter((item) => !item.read).length} unread updates`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            disabled={!items.some((item) => !item.read)}
          >
            Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Settings2 />}
            onClick={() => {
              onClose()
              navigate('/settings')
            }}
          >
            Notification settings
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden
              className={
                item.read
                  ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-surface-sunken'
                  : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand'
              }
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-foreground">
                {item.title}{' '}
                {!item.read && (
                  <Badge variant="brand" className="ml-1 align-middle">
                    New
                  </Badge>
                )}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{item.body}</p>
            </div>
            <span className="shrink-0 text-[11px] tabular text-faint">{item.time}</span>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
