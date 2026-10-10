/**
 * Single source of truth for app navigation.
 *
 * The bottom navigation (mobile) and sidebar (tablet/desktop) both read from
 * here, so adding a destination only ever happens in one file.
 */
import {
  Bot,
  CalendarCheck,
  FlaskConical,
  GraduationCap,
  Home,
  Library,
  RotateCcw,
  Settings2,
  Sigma,
  TrendingUp,
  UserRound,
  ClipboardList,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Extra paths that should keep this item highlighted (exact prefix matches). */
  match?: string[]
}

/** Primary destinations — bottom nav on phones, top of the sidebar elsewhere. */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', to: '/dashboard', icon: Home },
  { label: 'Library', to: '/library', icon: Library, match: ['/library'] },
  { label: 'PYQs', to: '/pyq', icon: ClipboardList, match: ['/pyq'] },
  { label: 'AI Tutor', to: '/ai-tutor', icon: Bot },
  { label: 'Planner', to: '/planner', icon: CalendarCheck },
]

/** Full destination map used by the sidebar. */
export const SIDEBAR_NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Study',
    items: [
      { label: 'Home', to: '/dashboard', icon: Home },
      { label: 'Library', to: '/library', icon: Library, match: ['/library'] },
      { label: 'PYQ Intelligence', to: '/pyq', icon: ClipboardList, match: ['/pyq'] },
      { label: 'AI Tutor', to: '/ai-tutor', icon: Bot },
    ],
  },
  {
    title: 'Practice',
    items: [
      { label: 'MistakeBook', to: '/mistakebook', icon: RotateCcw },
      { label: 'Formula Flow', to: '/formula-flow', icon: Sigma },
      { label: 'Reaction Lab', to: '/reaction-lab', icon: FlaskConical },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Progress', to: '/progress', icon: TrendingUp },
      { label: 'Study Planner', to: '/planner', icon: CalendarCheck },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', to: '/profile', icon: UserRound, match: ['/profile'] },
      { label: 'Settings', to: '/settings', icon: Settings2 },
      /* Staff-only page: non-admins get a "Staff only" empty state. */
      { label: 'AI Dashboard', to: '/admin/ai', icon: Sparkles, match: ['/admin'] },
    ],
  },
]

/** Is `pathname` inside the given nav item's territory? */
export function isNavActive(pathname: string, item: NavItem): boolean {
  const exact = pathname === item.to
  if (exact) return true
  // Nested library/pyq routes keep their parent item active.
  if (item.match?.some((prefix) => pathname.startsWith(`${prefix}/`))) return true
  // `/library` itself must not swallow `/library-anything` (none exist today,
  // but the guard keeps this correct if slugs change).
  if (item.to !== '/' && pathname.startsWith(`${item.to}/`)) return true
  return false
}
