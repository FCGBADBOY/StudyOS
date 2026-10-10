/**
 * `useAuth` — the single authentication hook used across the app.
 *
 * ```tsx
 * const { user, isAuthenticated, signInWithGoogle, signOut } = useAuth()
 * ```
 *
 * Session persistence/restoration lives in `src/context/AuthProvider.tsx`
 * (mounted in `main.tsx`); this module is the stable import path for screens.
 */
import { useAuthContext } from '@/context/AuthProvider'

export function useAuth() {
  return useAuthContext()
}

export { AuthProvider } from '@/context/AuthProvider'
