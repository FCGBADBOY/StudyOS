/**
 * ---------------------------------------------------------------------------
 * Supabase client (the only module that reads backend credentials).
 * ---------------------------------------------------------------------------
 * Only `VITE_*` values are used, and every `VITE_*` variable is embedded in the
 * browser bundle — so they must ONLY ever hold values that are safe to expose
 * (the project URL and the **anon** key, which is designed to be public and is
 * protected by Row Level Security).
 *
 * Never import a service-role key, password or private token here.
 *
 * When the environment variables are missing the app runs in *demo mode*:
 * services fall back to the bundled sample dataset so the UI stays usable
 * without a backend (see `src/services/fallback.ts`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** `true` when both public credentials are present. */
export const isSupabaseConfigured: boolean = Boolean(url && anonKey)

/**
 * Shared, session-aware client.
 *
 * - persists the session in `localStorage` so a refresh never signs you out
 * - auto-refreshes the access token before it expires
 * - picks up OAuth (Google) redirect tokens from the URL
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'studyos:auth',
      },
      global: {
        headers: { 'x-application-name': 'studyos' },
      },
    })
  : null

/**
 * The path Google/email sign-in redirects back to.
 * `AuthPage` reads the session (and the `?next=` target) once it loads.
 */
export function authRedirectUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/login`
}

/** Human-readable message for an unknown error (never leaks raw SQL/state). */
export function readableError(error: unknown): string {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')

  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'We could not reach the server. Check your connection and try again.'
  }
  if (/row-level security/i.test(raw)) {
    return 'You do not have permission to do that.'
  }
  if (/duplicate key|unique constraint/i.test(raw)) {
    return 'That value is already taken.'
  }
  if (!raw) return 'Something went wrong. Please try again.'

  /* Supabase messages are useful in development but noisy for end users. */
  if (import.meta.env.DEV) console.warn('[studyos]', raw)
  return 'Something went wrong. Please try again.'
}
