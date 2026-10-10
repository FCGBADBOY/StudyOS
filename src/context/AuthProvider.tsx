/**
 * Auth context: session restoration, sign-in/out and profile bootstrap.
 *
 * Mounted once in `main.tsx`, above `AppProvider`.
 *  - restores the persisted Supabase session on first paint (no repeated logins)
 *  - exposes `isDemo` when no backend is configured (sample-data mode)
 *  - creates/refreshes the `profiles` row when a session appears
 *  - resets the query cache whenever the user changes
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthResult, AuthState, AuthUser, ProfilePatch } from '@/types/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { resetQueryCache } from '@/lib/query'
import { resetMemo } from '@/services/shared'
import {
  getCurrentUser,
  onAuthChange,
  rememberNext,
  signInWithEmail,
  signInWithGoogle,
  signOut as signOutService,
  signUpWithEmail,
} from '@/services/auth.service'
import { ensureProfile, updateProfile } from '@/services/profile.service'
import { assignExamsForProfile } from '@/services/exam.service'
import type { ProfileUser } from '@/types'

interface AuthContextValue extends AuthState {
  signInWithGoogle: (next?: string | null) => Promise<AuthResult>
  signInWithEmail: (email: string, password: string, next?: string | null) => Promise<AuthResult>
  signUpWithEmail: (name: string, email: string, password: string, next?: string | null) => Promise<AuthResult>
  signOut: () => Promise<void>
  /** Persist onboarding choices (board / class / stream / goal) to the profile. */
  saveAcademicChoices: (input: {
    boardId?: string | null
    classId?: string | null
    streamId?: string | null
    dailyGoalMinutes?: number
    examDate?: string | null
    examName?: string | null
  }) => Promise<void>
  saveProfile: (patch: ProfilePatch) => Promise<ProfileUser>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'demo@studyos.app',
  name: 'Sumit Verma',
  avatarUrl: null,
  provider: 'demo',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const isDemo = !isSupabaseConfigured

  /* Restore the session (or adopt demo identity) on first paint. */
  useEffect(() => {
    let cancelled = false

    getCurrentUser()
      .then((restored) => {
        if (cancelled) return
        setUser(restored)
        if (restored && restored.provider !== 'demo') void ensureProfile(restored).catch(() => undefined)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsubscribe = onAuthChange((next) => {
      setUser((current) => {
        if (current?.id === next?.id) return next
        /* Identity changed → every cached payload belongs to the old user. */
        resetQueryCache()
        resetMemo()
        return next
      })
      if (next && next.provider !== 'demo') void ensureProfile(next).catch(() => undefined)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const wrap = useCallback(async (result: Promise<AuthResult>): Promise<AuthResult> => result, [])

  const value = useMemo<AuthContextValue>(() => {
    const withNext = (next?: string | null) => {
      rememberNext(next)
    }

    return {
      user,
      loading,
      isDemo,
      isAuthenticated: Boolean(user) || isDemo,
      signInWithGoogle: async (next) => {
        withNext(next)
        return wrap(signInWithGoogle())
      },
      signInWithEmail: async (email, password, next) => {
        withNext(next)
        return wrap(signInWithEmail(email, password))
      },
      signUpWithEmail: async (name, email, password, next) => {
        withNext(next)
        return wrap(signUpWithEmail(name, email, password))
      },
      signOut: async () => {
        await signOutService()
        resetQueryCache()
        resetMemo()
        setUser(isDemo ? DEMO_USER : null)
      },
      saveAcademicChoices: async (input) => {
        if (!user || user.provider === 'demo') return
        const patch: ProfilePatch = {}
        if (input.boardId) patch.board_id = input.boardId
        if (input.classId) patch.class_id = input.classId
        if (input.streamId) patch.stream_id = input.streamId
        if (input.dailyGoalMinutes) patch.daily_goal_minutes = input.dailyGoalMinutes
        if (input.examDate !== undefined) patch.exam_date = input.examDate
        if (input.examName) patch.target_exam = input.examName
        if (!Object.keys(patch).length) return

        await updateProfile(patch)
        if (input.boardId && input.classId) {
          await assignExamsForProfile(input.boardId, input.classId).catch(() => undefined)
        }
        resetQueryCache()
        resetMemo()
      },
      saveProfile: (patch) => updateProfile(patch),
      refreshUser: async () => {
        const next = await getCurrentUser()
        setUser(next)
      },
    }
  }, [user, loading, isDemo, wrap])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
