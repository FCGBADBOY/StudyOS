/**
 * Admin session: who is signed in, what role they hold, and whether they may
 * be here at all.
 *
 * SECURITY NOTE — the role read here is a *convenience*, not a gate. It decides
 * which nav links render and whether the layout shows a "Access denied" panel.
 * The actual enforcement happens in PostgreSQL via Row Level Security and the
 * `admin_*` RPCs (migrations 0012/0014): a student who forges this state still
 * gets a 42501 the moment they try to read or write anything privileged.
 *
 * In demo mode (no Supabase credentials) the portal grants `super_admin` so the
 * whole content workflow stays demonstrable without a backend.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthContext } from '@/context/AuthProvider'
import { isDemo as appIsDemo } from '@/services/shared'
import type { AdminRole, AdminUserRow } from '../types/admin'
import { getCurrentAdminProfile, getCurrentAdminRole } from '../services/adminUsers.service'

export interface AdminSession {
  /** Still resolving the role from the database. */
  loading: boolean
  /** The caller's role, or `student` when they have none. */
  role: AdminRole
  /** Profile row for the header (name, email, avatar). */
  profile: AdminUserRow | null
  /** No backend configured — the portal is running on bundled seed data. */
  isDemo: boolean
  /** True for any role that may enter the Admin Portal. */
  isStaff: boolean
  /** The role check failed (network / database error). */
  error: string | null
  signOut: () => Promise<void>
  /** Re-read the role after a change (e.g. an admin demoted themselves). */
  refresh: () => Promise<void>
}

export function useAdminSession(): AdminSession {
  const { user, loading: authLoading, signOut } = useAuthContext()

  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<AdminRole>('student')
  const [profile, setProfile] = useState<AdminUserRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    /* No session yet — nothing to resolve. */
    if (authLoading) return

    setLoading(true)
    setError(null)
    try {
      const [nextRole, nextProfile] = await Promise.all([getCurrentAdminRole(), getCurrentAdminProfile()])
      setRole(nextRole)
      setProfile(nextProfile)
    } catch {
      setError('We could not verify your access. Please try again.')
      setRole('student')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [authLoading])

  useEffect(() => {
    void load()
  }, [load])

  return useMemo<AdminSession>(
    () => ({
      /*
       * Loading until *both* the auth session and the role lookup have
       * settled. Reporting "not loading" while auth is still restoring would
       * make every guard evaluate the default `student` role and flash an
       * access-denied panel at the signed-in admin on a cold load.
       */
      loading: loading || authLoading,
      role,
      profile,
      isDemo: appIsDemo,
      isStaff: role !== 'student',
      error,
      signOut,
      refresh: load,
    }),
    [loading, authLoading, role, profile, error, signOut, load],
  )
}
