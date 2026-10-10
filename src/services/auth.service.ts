/**
 * Authentication service — Supabase Auth only.
 *
 *  - Google OAuth sign-in (redirect flow)
 *  - email + password sign-in / sign-up
 *  - session persistence & restoration (handled by the client config)
 *  - sign out
 *
 * Passwords are stored by Supabase Auth; this app never sees or keeps them.
 *
 * FUTURE AI INTEGRATION: nothing here changes when the AI Tutor backend lands —
 * auth stays exactly as it is.
 */
import type { Session, User } from '@supabase/supabase-js'
import { db, isDemo, readableError } from './shared'
import { authRedirectUrl as redirectUrl } from '@/lib/supabase'
import { PROFILE } from '@/data/profile'
import type { AuthResult, AuthUser } from '@/types/auth'

/** Where the user was headed before hitting the login wall. */
const NEXT_KEY = 'auth:next'

export function rememberNext(path: string | null | undefined): void {
  if (!path || path === '/login') return
  try {
    window.sessionStorage.setItem(NEXT_KEY, path)
  } catch {
    /* private mode */
  }
}

export function takeNext(fallback = '/dashboard'): string {
  try {
    const value = window.sessionStorage.getItem(NEXT_KEY)
    window.sessionStorage.removeItem(NEXT_KEY)
    return value || fallback
  } catch {
    return fallback
  }
}

export function mapUser(user: User): AuthUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const provider = user.app_metadata?.provider
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (typeof user.email === 'string' ? user.email.split('@')[0] : 'Student')

  return {
    id: user.id,
    email: user.email ?? null,
    name,
    avatarUrl:
      (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
      (typeof meta.picture === 'string' && meta.picture) ||
      null,
    provider: provider === 'google' ? 'google' : 'email',
  }
}

/** Demo-mode identity (no backend configured). */
const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'demo@studyos.app',
  name: PROFILE.name,
  avatarUrl: PROFILE.avatar || null,
  provider: 'demo',
}

/** Current user, restored from the persisted session. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (isDemo) return DEMO_USER
  const client = db()
  if (!client) return null
  const { data, error } = await client.auth.getSession()
  if (error) throw new Error(readableError(error))
  return data.session ? mapUser(data.session.user) : null
}

/** Subscribe to session changes (sign-in, sign-out, token refresh). */
export function onAuthChange(handler: (user: AuthUser | null, session: Session | null) => void): () => void {
  const client = db()
  if (!client) {
    handler(DEMO_USER, null)
    return () => {}
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    handler(session ? mapUser(session.user) : null, session)
  })
  return () => data.subscription.unsubscribe()
}

/** Google sign-in. Redirects back to `/login`, which restores `?next=`. */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (isDemo) return { ok: true, message: 'Demo mode — no backend configured.' }
  const client = db()
  if (!client) return { ok: false, message: 'Backend is not configured.' }

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl() },
  })
  if (error) return { ok: false, message: readableError(error) }
  return { ok: true }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (isDemo) return { ok: true, message: 'Demo mode — no backend configured.' }
  const client = db()
  if (!client) return { ok: false, message: 'Backend is not configured.' }
  if (!email.trim() || password.length < 6) {
    return { ok: false, message: 'Enter a valid email and a password of at least 6 characters.' }
  }

  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    const message = /invalid login credentials/i.test(error.message)
      ? 'That email and password combination did not match.'
      : readableError(error)
    return { ok: false, message }
  }
  return { ok: true }
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<AuthResult> {
  if (isDemo) return { ok: true, message: 'Demo mode — no backend configured.' }
  const client = db()
  if (!client) return { ok: false, message: 'Backend is not configured.' }
  if (!name.trim()) return { ok: false, message: 'Tell us what to call you.' }
  if (!email.trim() || password.length < 6) {
    return { ok: false, message: 'Enter a valid email and a password of at least 6 characters.' }
  }

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: redirectUrl() },
  })
  if (error) return { ok: false, message: readableError(error) }

  /* Confirmations disabled → a session comes back immediately. */
  if (data.session) return { ok: true }
  return { ok: true, needsConfirmation: true, message: 'Check your inbox to confirm your email.' }
}

export async function signOut(): Promise<AuthResult> {
  if (isDemo) return { ok: true }
  const client = db()
  if (!client) return { ok: true }
  const { error } = await client.auth.signOut()
  if (error) return { ok: false, message: readableError(error) }
  return { ok: true }
}
