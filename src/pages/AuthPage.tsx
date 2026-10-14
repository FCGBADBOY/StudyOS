import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, GraduationCap, Loader2, Lock, Mail, UserRound } from 'lucide-react'
import { BackgroundArt, Badge, Button, Card, Illustration, Input, SectionHeader } from '@/components/ui'
import { Logo } from '@/components/LogoMark'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/AppProvider'
import { rememberNext, takeNext } from '@/services/auth.service'
import { getProfileRow } from '@/services/profile.service'
import { readLocal } from '@/utils/storage'

/** Focus halo drawn on the field itself, never around the whole label group. */
const FIELD_FOCUS =
  '[&_div:focus-within]:ring-2 [&_div:focus-within]:ring-brand-ring [&_div:focus-within]:ring-inset'

/** Multi-colour Google mark (no icon library ships the brand logo). */
function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.62H1.27a12 12 0 0 0 0 10.76l4.02-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.62l4.02 3.09C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  )
}

type Mode = 'signin' | 'signup'

/**
 * Login / sign-up.
 *
 * Google OAuth and email+password both go through Supabase Auth. After a
 * successful sign-in the student lands on the page they originally asked for,
 * or in onboarding when their profile has no board/class yet.
 *
 * Desktop splits into two columns — the form on the warm paper side, the brand
 * illustration on the other. Phones get a single comfortable column.
 */
export default function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { isAuthenticated, loading, isDemo, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const { toast } = useToast()

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = params.get('next') ?? (location.state as { from?: string } | null)?.from ?? null

  /** Already signed in → continue the journey. */
  useEffect(() => {
    if (loading || !isAuthenticated) return
    let cancelled = false

    void (async () => {
      let needsSetup = true
      try {
        const row = await getProfileRow()
        needsSetup = !row || !row.board_id || !row.class_id
      } catch {
        needsSetup = true
      }
      if (cancelled) return

      /* Demo mode has no profile row — trust the local onboarding flag. */
      if (needsSetup && isDemo) needsSetup = !readLocal<boolean>('onboarded', false)

      if (next) rememberNext(next)
      navigate(needsSetup ? '/onboarding' : takeNext(), { replace: true })
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated])

  const handleGoogle = async () => {
    setError(null)
    setBusy(true)
    const result = await signInWithGoogle(next)
    if (!result.ok) {
      setError(result.message ?? 'Google sign-in failed. Please try again.')
      setBusy(false)
    }
    /* On success the browser navigates away to Google. */
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setBusy(true)

    const result =
      mode === 'signin'
        ? await signInWithEmail(email, password, next)
        : await signUpWithEmail(name, email, password, next)

    setBusy(false)

    if (!result.ok) {
      setError(result.message ?? 'Something went wrong. Please try again.')
      return
    }
    if (result.needsConfirmation) {
      toast({ title: 'Confirm your email', description: result.message, variant: 'success' })
      return
    }
    toast({ title: 'Welcome to StudyOS', description: 'Signed in successfully.', variant: 'success' })
    /* The session effect above routes to onboarding or the app. */
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <div className="relative isolate overflow-hidden rounded-hero bg-cream shadow-hero lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        {/* ------------------------------------------------------ form side */}
        <div className="relative isolate p-5 sm:p-8 lg:bg-surface lg:p-10">
          <BackgroundArt theme="brand" intensity="faint" className="-z-10" />

          <SectionHeader
            eyebrow="StudyOS"
            title={mode === 'signin' ? 'Welcome back' : 'Create your account'}
            subtitle={
              mode === 'signin'
                ? 'Sign in to sync your progress, MistakeBook and planner.'
                : 'One account for notes, PYQs, progress and your planner.'
            }
          />

          <Card padded elevation="raised" className="mt-4 space-y-4 sm:mt-5">
            <Button variant="outline" fullWidth size="lg" icon={<GoogleIcon />} onClick={handleGoogle} loading={busy}>
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
              <span className="h-px flex-1 bg-border" />
              or use email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <Input
                  label="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Sumit Verma"
                  autoComplete="name"
                  icon={<UserRound />}
                  maxLength={48}
                  className={FIELD_FOCUS}
                />
              )}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                icon={<Mail />}
                required
                className={FIELD_FOCUS}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                icon={<Lock />}
                hint={mode === 'signup' ? 'Stored securely by Supabase Auth — we never keep your password.' : undefined}
                required
                className={FIELD_FOCUS}
              />

              {error && (
                <p
                  role="alert"
                  className="rounded-control bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger"
                >
                  {error}
                </p>
              )}

              <Button type="submit" fullWidth size="lg" loading={busy} iconRight={<ArrowRight />}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-[13px] text-muted">
              {mode === 'signin' ? 'New to StudyOS?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setError(null)
                }}
                className="rounded-control px-1 font-semibold text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </Card>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] font-medium leading-relaxed text-muted">
            <GraduationCap aria-hidden className="h-3.5 w-3.5 shrink-0" />
            Your data is protected by row-level security — only you can read it.
            {busy && <Loader2 aria-hidden className="h-3 w-3 animate-spin" />}
          </p>
        </div>

        {/* -------------------------------------------------- brand side */}
        <div className="relative isolate hidden overflow-hidden lg:block">
          <BackgroundArt theme="brand" geometry intensity="subtle" />
          <span
            aria-hidden
            className="pattern-dots pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-[0.35]"
          />

          <div className="relative flex h-full flex-col justify-center gap-6 px-8 py-10 xl:px-10">
            <Logo size={44} />

            <div className="overflow-hidden rounded-card bg-surface p-5 shadow-card">
              <Illustration name="graduation" theme="brand" decorative className="w-full" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand" dot uppercase>
                Built for CBSE · ICSE · State boards
              </Badge>
              <Badge variant="neutral" icon={<GraduationCap />}>
                Class 12
              </Badge>
            </div>

            <p className="max-w-sm text-[13px] leading-relaxed text-muted">
              One account for notes, PYQs, progress and your planner — your data is protected by
              row-level security, so only you can read it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
