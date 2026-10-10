/**
 * Admin service: user management.
 *
 * Role and suspension changes go through the `admin_set_user_role` and
 * `admin_set_user_suspended` SECURITY DEFINER RPCs (migration 0014) rather
 * than a plain UPDATE. That matters because:
 *
 *   * the database re-checks `users.change_role` / `users.suspend` before
 *     acting, so tampering with the React state grants nothing;
 *   * only a super admin can mint another super admin;
 *   * an admin cannot suspend themselves or suspend above their own level.
 *
 * Nothing here ever reads auth secrets — `auth.users` is not exposed, and the
 * email column comes from a database view the portal is granted access to.
 */
import { db, isDemo, rows, one } from '@/services/shared'
import type { AdminRole, AdminUserRow } from '../types/admin'
import { DEMO_ADMINS_USERS } from '../data/adminDemo'
import { nowIso, readCollection, writeCollection } from './demoStore'
import { logAdminAction, logAdminActionDemo } from './adminAudit.service'

/* --------------------------------- listing -------------------------------- */

export interface UserFilter {
  search?: string
  role?: AdminRole | 'all'
  status?: 'all' | 'active' | 'suspended'
  boardId?: string | 'all'
}

export interface UserPage {
  items: AdminUserRow[]
  total: number
  page: number
  pageSize: number
}

export const USER_PAGE_SIZE = 20

export async function listUsers(
  filter: UserFilter = {},
  page = 1,
  pageSize = USER_PAGE_SIZE,
): Promise<UserPage> {
  if (isDemo) {
    const all = applyUserFilter(readCollection<AdminUserRow>('users', DEMO_ADMINS_USERS), filter)
    const start = (page - 1) * pageSize
    return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize }
  }

  const client = db()
  if (!client) return { items: [], total: 0, page, pageSize }

  let request = client
    .from('admin_user_directory')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filter.role && filter.role !== 'all') request = request.eq('role', filter.role)
  if (filter.status === 'active') request = request.eq('suspended', false)
  if (filter.status === 'suspended') request = request.eq('suspended', true)
  if (filter.boardId && filter.boardId !== 'all') request = request.eq('board_id', filter.boardId)
  if (filter.search?.trim()) {
    const needle = filter.search.trim()
    request = request.or(`full_name.ilike.%${needle}%,username.ilike.%${needle}%,email.ilike.%${needle}%`)
  }

  const { data, error, count } = await request
  if (error) throw new Error('We could not load the users. Please try again.')

  return { items: (data as AdminUserRow[]) ?? [], total: count ?? 0, page, pageSize }
}

function applyUserFilter(items: AdminUserRow[], filter: UserFilter): AdminUserRow[] {
  const needle = filter.search?.trim().toLowerCase() ?? ''
  return items
    .filter((row) => (filter.role && filter.role !== 'all' ? row.role === filter.role : true))
    .filter((row) =>
      filter.status === 'active' ? !row.suspended : filter.status === 'suspended' ? row.suspended : true,
    )
    .filter((row) => (filter.boardId && filter.boardId !== 'all' ? row.board_id === filter.boardId : true))
    .filter((row) =>
      needle
        ? (row.full_name ?? '').toLowerCase().includes(needle) ||
          (row.username ?? '').toLowerCase().includes(needle) ||
          (row.email ?? '').toLowerCase().includes(needle)
        : true,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function getUser(id: string): Promise<AdminUserRow | null> {
  if (isDemo) {
    return readCollection<AdminUserRow>('users', DEMO_ADMINS_USERS).find((row) => row.id === id) ?? null
  }
  const client = db()
  if (!client) return null
  return one<AdminUserRow>(client.from('admin_user_directory').select('*').eq('id', id).maybeSingle())
}

/* ------------------------------- role changes ----------------------------- */

/**
 * Change a user's role. The server re-checks permission and the "no self
 * promotion" and "super admin only" rules, so this is safe to call directly.
 */
export async function setUserRole(userId: string, role: AdminRole): Promise<void> {
  if (isDemo) {
    const all = readCollection<AdminUserRow>('users', DEMO_ADMINS_USERS)
    writeCollection<AdminUserRow>(
      'users',
      all.map((row) => (row.id === userId ? { ...row, role } : row)),
    )
    await logAdminActionDemo('user.role_changed', 'profile', userId, { role })
    return
  }

  const client = db()
  if (!client) return

  const { error } = await client.rpc('admin_set_user_role', { p_user_id: userId, p_role: role })
  if (error) throw new Error(readableRoleError(error.message))

  await logAdminAction('user.role_changed', 'profile', userId, { role })
}

/* -------------------------------- suspension ------------------------------ */

export async function setUserSuspended(
  userId: string,
  suspended: boolean,
  reason?: string,
): Promise<void> {
  if (isDemo) {
    const all = readCollection<AdminUserRow>('users', DEMO_ADMINS_USERS)
    writeCollection<AdminUserRow>(
      'users',
      all.map((row) =>
        row.id === userId
          ? {
              ...row,
              suspended,
              suspended_at: suspended ? nowIso() : null,
              suspended_reason: suspended ? (reason ?? null) : null,
            }
          : row,
      ),
    )
    await logAdminActionDemo(suspended ? 'user.suspended' : 'user.reactivated', 'profile', userId, {
      reason: reason ?? null,
    })
    return
  }

  const client = db()
  if (!client) return

  const { error } = await client.rpc('admin_set_user_suspended', {
    p_user_id: userId,
    p_suspended: suspended,
    p_reason: reason ?? null,
  })
  if (error) throw new Error(readableRoleError(error.message))

  await logAdminAction(suspended ? 'user.suspended' : 'user.reactivated', 'profile', userId, {
    reason: reason ?? null,
  })
}

/** Turn Postgres authorisation errors into sentences an admin can act on. */
function readableRoleError(message: string): string {
  if (/not allowed to change roles|do not have permission/i.test(message)) {
    return 'You do not have permission to change roles.'
  }
  if (/super admin/i.test(message)) return message
  if (/cannot (change your own|suspend your own)/i.test(message)) return message
  if (/No profile found/i.test(message)) return 'That account no longer exists.'
  return 'We could not update that account. Please try again.'
}

/* ------------------------------ study activity ---------------------------- */
/* Read-only by design (spec §24): admins inspect learning data, they do not
   edit it. Every query is scoped to the single user being viewed.           */

export interface UserActivity {
  questionsAttempted: number
  accuracy: number | null
  minutesStudied: number
  mistakes: number
  bookmarks: number
  sessions: number
  chaptersStarted: number
}

export async function getUserActivity(userId: string): Promise<UserActivity> {
  if (isDemo) {
    // Deterministic per-user demo figures so the page is stable across loads.
    const seed = userId.split('').reduce((total, char) => total + char.charCodeAt(0), 0)
    const attempted = (seed % 340) + 40
    const accuracy = 45 + (seed % 50)
    return {
      questionsAttempted: attempted,
      accuracy,
      minutesStudied: (seed % 90) + 12,
      mistakes: seed % 24,
      bookmarks: (seed % 30) + 3,
      sessions: (seed % 18) + 2,
      chaptersStarted: (seed % 14) + 1,
    }
  }

  const client = db()
  if (!client) {
    return {
      questionsAttempted: 0,
      accuracy: null,
      minutesStudied: 0,
      mistakes: 0,
      bookmarks: 0,
      sessions: 0,
      chaptersStarted: 0,
    }
  }

  const [attempts, history, mistakes, bookmarks, sessions, chapters] = await Promise.all([
    rows<{ is_correct: boolean }>(client.from('question_attempts').select('is_correct').eq('user_id', userId)),
    rows<{ minutes: number }>(client.from('study_history').select('minutes').eq('user_id', userId)),
    rows<{ id: string }>(client.from('mistakes').select('id').eq('user_id', userId)),
    rows<{ id: string }>(client.from('bookmarks').select('id').eq('user_id', userId)),
    rows<{ id: string }>(client.from('study_sessions').select('id').eq('user_id', userId)),
    rows<{ chapter_id: string }>(client.from('user_chapter_progress').select('chapter_id').eq('user_id', userId)),
  ])

  const correct = attempts.filter((row) => row.is_correct).length

  return {
    questionsAttempted: attempts.length,
    accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : null,
    minutesStudied: history.reduce((total, row) => total + (row.minutes ?? 0), 0),
    mistakes: mistakes.length,
    bookmarks: bookmarks.length,
    sessions: sessions.length,
    chaptersStarted: chapters.length,
  }
}

/* --------------------------------- counts --------------------------------- */

export interface UserCounts {
  total: number
  students: number
  staff: number
  suspended: number
}

export async function getUserCounts(): Promise<UserCounts> {
  const all = await listUsers({}, 1, 10_000)
  const items = all.items
  return {
    total: items.length,
    students: items.filter((row) => row.role === 'student').length,
    staff: items.filter((row) => row.role !== 'student').length,
    suspended: items.filter((row) => row.suspended).length,
  }
}

/* ------------------------------ demo identity ----------------------------- */
/**
 * In demo mode there is no real session, so the portal acts as a super admin
 * (that is what makes the whole workflow demonstrable). With a backend this
 * returns the actual signed-in user's role, read from the database.
 */
export async function getCurrentAdminRole(): Promise<AdminRole> {
  if (isDemo) return 'super_admin'

  const client = db()
  if (!client) return 'student'

  const { data } = await client.auth.getUser()
  if (!data.user) return 'student'

  const profile = await one<{ role: AdminRole }>(
    client.from('profiles').select('role').eq('id', data.user.id).maybeSingle(),
  )
  return profile?.role ?? 'student'
}

export async function getCurrentAdminProfile(): Promise<AdminUserRow | null> {
  const role = await getCurrentAdminRole()
  if (isDemo) {
    const me = readCollection<AdminUserRow>('users', DEMO_ADMINS_USERS).find((row) => row.role === role)
    return me ?? DEMO_ADMINS_USERS[0]
  }

  const client = db()
  if (!client) return null
  const { data } = await client.auth.getUser()
  if (!data.user) return null
  return getUser(data.user.id)
}
