/**
 * Route guards for the Admin Portal.
 *
 * `RequireAdmin` renders the page only when the signed-in role holds at least
 * one administrative permission. It is a UX boundary, not a security one: the
 * database re-checks every privileged read and write (RLS policies in
 * migration 0012, `admin_*` RPCs in 0014), so a student who reaches an admin
 * route by URL still cannot read or change anything.
 *
 * Three states are handled distinctly, because they need different actions:
 *   * still resolving  → skeleton, never a flash of "access denied"
 *   * signed out       → send to the admin login, preserving the target
 *   * signed in, not staff → explain, and offer the student app
 */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { LinkButton, Button, Card, LoadingState } from '@/components/ui'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import type { AdminPermission } from '../types/admin'

export interface RequireAdminProps {
  children: ReactNode
  /** Require a specific capability (e.g. `analytics.view`) rather than any staff role. */
  permission?: AdminPermission
}

export function RequireAdmin({ children, permission }: RequireAdminProps) {
  const { loading, isStaff, role, isDemo, error } = useAdminSession()
  const location = useLocation()

  /* Still resolving — show a skeleton so we never flash the denial panel. */
  if (loading) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <LoadingState label="Checking your access…" />
      </div>
    )
  }

  /* Not signed in at all — send to the admin login with a return path. */
  if (!isStaff && !isDemo && role === 'student' && !error) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/admin/login?next=${next}`} replace />
  }

  /* Signed in, but the role has no administrative permissions. */
  if (!isStaff && !isDemo) {
    return <AccessDenied />
  }

  /* Specific capability gate (demo mode always passes). */
  if (permission && !isDemo && !can(role, permission)) {
    return <AccessDenied permission={permission} />
  }

  return <>{children}</>
}

/**
 * "You don't have permission to access the Admin Portal."
 *
 * Explains what happened and offers the two useful exits — the student app, or
 * signing in as someone else — rather than a dead end.
 */
export function AccessDenied({ permission }: { permission?: string }) {
  return (
    <div className="mx-auto flex max-w-lg justify-center py-10">
      <Card className="w-full p-6 text-center sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-control bg-danger-soft text-danger">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </span>

        <h1 className="mt-4 text-lg font-semibold text-foreground">
          You don&apos;t have permission to access the Admin Portal.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your account does not hold the administrative role required
          {permission ? (
            <>
              {' '}
              for <code className="rounded-control bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">{permission}</code>
            </>
          ) : null}
          . If you believe this is a mistake, ask a super admin to update your role.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <LinkButton to="/dashboard" variant="secondary">
            Go to StudyOS
          </LinkButton>
          <Button variant="ghost" onClick={() => window.location.assign('/admin/login')}>
            Sign in as someone else
          </Button>
        </div>
      </Card>
    </div>
  )
}
