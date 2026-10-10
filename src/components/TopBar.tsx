import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, GraduationCap, Moon, Search, Settings2, Sun } from 'lucide-react'
import { useApp } from '@/context/AppProvider'
import { NOTIFICATIONS } from '@/data/notifications'
import { PROFILE } from '@/data/profile'
import { Avatar, Badge, BottomSheet, Button, IconButton, SearchBar } from '@/components/ui'
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
  if (pathname === '/') return 'StudyOS'
  return 'StudyOS'
}

/**
 * Sticky top bar: brand + contextual title on phones, search field on wider
 * screens, plus notifications, theme toggle and profile.
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
        {/* Brand — phones only (the sidebar covers it from md up) */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-control md:hidden"
          aria-label="StudyOS home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-tile bg-brand text-brand-fg shadow-card">
            <GraduationCap aria-hidden className="h-[18px] w-[18px]" />
          </span>
        </Link>

        <span className="min-w-0 flex-1 lg:flex-none">
          <span className="block truncate text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
            {titleFor(pathname)}
          </span>
        </span>

        {/* Search — full field on desktop, icon trigger below lg */}
        <div className="hidden min-w-0 flex-1 lg:block lg:max-w-md">
          <SearchBar onClick={openSearch} hint="⌘K" />
        </div>
        <IconButton label="Search notes, PYQs, formulas, chapters" variant="soft" onClick={openSearch} className="lg:hidden">
          <Search />
        </IconButton>

        <IconButton
          label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          variant="soft"
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

        <Link
          to="/profile"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          aria-label="Open profile"
        >
          <Avatar name={PROFILE.name} initials={PROFILE.initials} size="sm" decorative />
        </Link>
      </div>

      <NotificationSheet open={notifOpen} onClose={() => setNotifOpen(false)} items={items} onMarkAllRead={markAllRead} />
    </header>
  )
}

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
          <Button variant="ghost" size="sm" onClick={onMarkAllRead} disabled={!items.some((item) => !item.read)}>
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
