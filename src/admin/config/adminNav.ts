/**
 * Admin navigation configuration.
 *
 * One source of truth for the sidebar, the mobile drawer and any breadcrumb
 * logic. Icons are Lucide components; `permission` gates rendering so an
 * editor never sees a section they cannot open (the route guard is still the
 * real enforcement — this only avoids dead links).
 */
import {
  BarChart3,
  Bot,
  BookOpen,
  ClipboardCheck,
  FileQuestion,
  FileSearch,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AdminPermission } from '../types/admin'

export interface AdminNavItem {
  /** Route path (absolute). */
  href: string
  label: string
  icon: LucideIcon
  /** Permission required to see the link. */
  permission?: AdminPermission
  /** Match child routes for the active state. */
  match?: (pathname: string) => boolean
}

export interface AdminNavGroup {
  id: string
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        href: '/admin/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        match: (pathname) => pathname === '/admin/dashboard',
      },
      {
        href: '/admin/analytics',
        label: 'Analytics',
        icon: BarChart3,
        permission: 'analytics.view',
        match: (pathname) => pathname.startsWith('/admin/analytics'),
      },
      {
        href: '/admin/ai',
        label: 'AI Studio',
        icon: Sparkles,
        permission: 'analytics.view',
        match: (pathname) => pathname.startsWith('/admin/ai'),
      },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      {
        href: '/admin/content',
        label: 'Content',
        icon: FileText,
        permission: 'content.view',
        /* `/admin/content-engine` also starts with `/admin/content` — without
           the exclusion the Content Engine screens light up this entry too. */
        match: (pathname) =>
          pathname.startsWith('/admin/content') && !pathname.startsWith('/admin/content-engine'),
      },
      {
        href: '/admin/content/pyq',
        label: 'PYQs',
        icon: FileQuestion,
        permission: 'content.view',
        match: (pathname) => pathname.startsWith('/admin/content/pyq'),
      },
    ],
  },
  {
    id: 'engine',
    label: 'Content Engine',
    items: [
      {
        href: '/admin/content-engine',
        label: 'Overview',
        icon: Bot,
        permission: 'engine.view',
        match: (pathname) => pathname === '/admin/content-engine',
      },
      {
        href: '/admin/content-engine/jobs',
        label: 'Jobs',
        icon: ListChecks,
        permission: 'engine.view',
        match: (pathname) => pathname.startsWith('/admin/content-engine/jobs'),
      },
      {
        href: '/admin/content-engine/review',
        label: 'Review',
        icon: ClipboardCheck,
        permission: 'engine.view',
        match: (pathname) => pathname.startsWith('/admin/content-engine/review'),
      },
      {
        href: '/admin/content-engine/coverage',
        label: 'Coverage',
        icon: Layers,
        permission: 'engine.view',
        match: (pathname) => pathname.startsWith('/admin/content-engine/coverage'),
      },
      {
        href: '/admin/content-engine/sources',
        label: 'Sources',
        icon: Globe,
        permission: 'engine.view',
        match: (pathname) => pathname.startsWith('/admin/content-engine/sources'),
      },
      {
        href: '/admin/content-engine/pyq-discovery',
        label: 'PYQ Discovery',
        icon: FileSearch,
        permission: 'engine.view',
        match: (pathname) => pathname.startsWith('/admin/content-engine/pyq-discovery'),
      },
    ],
  },
  {
    id: 'structure',
    label: 'Academic',
    items: [
      {
        href: '/admin/academic',
        label: 'Structure',
        icon: GraduationCap,
        permission: 'academic.view',
        match: (pathname) =>
          pathname.startsWith('/admin/academic') && !pathname.startsWith('/admin/academic/chapters'),
      },
      {
        href: '/admin/academic/chapters',
        label: 'Chapters',
        icon: BookOpen,
        permission: 'academic.view',
        match: (pathname) => pathname.startsWith('/admin/academic/chapters'),
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      {
        href: '/admin/users',
        label: 'Users',
        icon: Users,
        permission: 'users.view',
        match: (pathname) => pathname.startsWith('/admin/users'),
      },
      {
        href: '/admin/reports',
        label: 'Reports',
        icon: ShieldAlert,
        permission: 'reports.view',
        match: (pathname) => pathname.startsWith('/admin/reports'),
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        href: '/admin/settings',
        label: 'Settings',
        icon: Settings,
        permission: 'settings.manage',
        match: (pathname) => pathname.startsWith('/admin/settings'),
      },
      {
        href: '/admin/audit',
        label: 'Audit Log',
        icon: ScrollText,
        permission: 'audit.view',
        match: (pathname) => pathname.startsWith('/admin/audit'),
      },
    ],
  },
]

/** Flat list, used for breadcrumb resolution. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items)
