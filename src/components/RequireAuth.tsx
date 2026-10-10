import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { LoadingState } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { rememberNext } from '@/services/auth.service'

/**
 * Route guard for screens that need a student account.
 *
 * - restores the session first (never bounces a signed-in user to /login)
 * - remembers where the visitor was heading so login can continue there
 * - demo mode (no backend configured) is treated as signed in, because the
 *   sample dataset needs no account; RLS still protects real data
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <LoadingState label="Restoring your session" />
      </div>
    )
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`
    rememberNext(from)
    return <Navigate to="/login" replace state={{ from }} />
  }

  return <>{children}</>
}
