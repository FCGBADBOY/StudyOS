/**
 * Auth-layer types (Supabase Auth session/user + the shapes services expose).
 *
 * Passwords are never stored or handled here — Supabase Auth owns them.
 */

/** The minimal user the UI cares about. */
export interface AuthUser {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
  provider: 'google' | 'email' | 'demo'
}

export type AuthProvider = 'google' | 'email'

export interface AuthResult {
  ok: boolean
  /** Short, user-facing explanation (never a raw database error). */
  message?: string
  /** Email flows may need the user to confirm before signing in. */
  needsConfirmation?: boolean
}

/** Session state shared with the whole tree via `AuthProvider`. */
export interface AuthState {
  user: AuthUser | null
  /** Still restoring the persisted session on first paint. */
  loading: boolean
  /** No Supabase credentials configured — the app runs on bundled sample data. */
  isDemo: boolean
  /** Signed in *or* running in demo mode (demo mode never blocks navigation). */
  isAuthenticated: boolean
}

/** Row shape of `public.profiles`. */
export interface ProfileRow {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  board_id: string | null
  class_id: string | null
  stream_id: string | null
  school: string | null
  target_exam: string | null
  exam_date: string | null
  daily_goal_minutes: number
  created_at: string
  updated_at: string
}

/** Fields the profile editor is allowed to change. */
export interface ProfilePatch {
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
  bio?: string | null
  board_id?: string | null
  class_id?: string | null
  stream_id?: string | null
  school?: string | null
  target_exam?: string | null
  exam_date?: string | null
  daily_goal_minutes?: number
}
