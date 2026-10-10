/**
 * Admin login.
 *
 * Reuses the existing Supabase auth stack (`AuthProvider`) rather than
 * introducing a second identity system — the only difference from `/login` is
 * what happens *after* authentication:
 *
 *   credentials → authenticated session → database reads `profiles.role`
 *               → staff  : allow, redirect to the requested admin route
 *               → student: "You don't have permission to access the Admin
 *                          Portal."
 *
 * The role check itself lives in the database (`RequireAdmin` and every RLS
 * policy call `has_permission()`), so entering an admin URL as a student
 * changes nothing.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import { Notice } from '../components/AdminFeedback'
import { useAuthContext } from '@/context/AuthProvider'
import { useAdminSession } from '../hooks/useAdminSession'
import { AccessDenied } from '../guards/RequireAdmin'

export default function AdminLoginPage() {
  const { signInWithEmail, signInWithGoogle, isAuthenticated, loading: authLoading } = useAuthContext()
  const { isStaff, loading: roleLoading, isDemo } = useAdminSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const next = params.get('next') || '/admin/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /* Once we know the role, send staff straight through. */
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    if (isStaff) setGranted(true)
  }, [isStaff])

  /* Demo mode has no credentials to check — the portal is open on seed data. */
  if (isDemo) return <Navigate to="/admin/dashboard" replace />

  /* Already signed in as staff: skip the form entirely. */
  if (granted && isStaff) return <Navigate to={next} replace />

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await signInWithEmail(email.trim(), password, next)
      if (!result.ok) setError(result.message ?? 'We could not sign you in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    const result = await signInWithGoogle(next)
    if (!result.ok) setError(result.message ?? 'Google sign-in failed. Please try again.')
  }

  /* Session restored but the account is not staff — explain rather than loop. */
  if (isAuthenticated && !roleLoading && !isStaff && !submitting) {
    return (
      <AdminShell>
        <AccessDenied />
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <Card className="w-full max-w-md p-6 shadow-raised sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-control bg-brand text-brand-fg">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">StudyOS Admin</h1>
            <p className="text-sm text-muted">Sign in with a staff account</p>
          </div>
        </div>

        {error && (
          <div className="mt-5">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@studyos.dev"
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />

          <Button
            type="submit"
            fullWidth
            loading={submitting}
            disabled={authLoading || !email.trim() || !password}
          >
            Sign in
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wide text-faint">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" fullWidth onClick={handleGoogle} disabled={submitting}>
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted">
          Not an administrator?{' '}
          <Link
            to="/login"
            className="font-medium text-brand transition-colors hover:text-brand-hover
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            Go to StudyOS
          </Link>
        </p>
      </Card>

      <button
        type="button"
        onClick={() => navigate('/')}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors
                   hover:text-foreground focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-brand-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to home
      </button>
    </AdminShell>
  )
}

/** Centred chrome for the login screen (no sidebar — nobody is signed in yet). */
function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      {children}
    </div>
  )
}
