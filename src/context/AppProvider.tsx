/**
 * Global app state: theme, preferences, onboarding answers, favourites,
 * recent searches and toasts.
 *
 * Preferences/onboarding stay on-device; favourites are *mirrored* to the
 * signed-in user's `bookmarks` table so pinning a resource survives a new
 * device (and a new browser session) once Supabase is connected.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  OnboardingAnswers,
  SubjectId,
  ThemePreference,
  ToastItem,
  ToastVariant,
  UserPreferences,
} from '@/types'
import { readLocal, writeLocal } from '@/utils/storage'
import { setReducedMotion } from '@/animations/motion'
import { useAuthContext } from '@/context/AuthProvider'
import { getBookmarkedKeys, toggleBookmark } from '@/services/bookmark.service'

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  notifications: true,
  studyReminders: true,
  reminderTime: '19:30',
  haptics: true,
  reduceMotion: false,
  language: 'English',
  defaultBoard: 'cbse',
  defaultClass: 'class-12',
  fontScale: 'default',
}

interface AppContextValue {
  /* theme */
  theme: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void

  /* preferences */
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void

  /* onboarding */
  answers: OnboardingAnswers
  saveAnswers: (answers: OnboardingAnswers) => void

  /* library favourites */
  favorites: string[]
  toggleFavorite: (id: string) => boolean
  isFavorite: (id: string) => boolean

  /* global search history */
  recentSearches: string[]
  addRecentSearch: (term: string) => void
  clearRecentSearches: () => void

  /* toasts */
  toasts: ToastItem[]
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void
  dismissToast: (id: string) => void

  /* onboarding completion flag */
  onboarded: boolean
  completeOnboarding: () => void
  resetOnboarding: () => void

  /* global search surface */
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => ({
    ...DEFAULT_PREFERENCES,
    ...readLocal<Partial<UserPreferences>>('preferences', {}),
  }))
  const [systemPrefersDark, setSystemPrefersDark] = useState<'light' | 'dark'>(systemTheme)
  const [answers, setAnswers] = useState<OnboardingAnswers>(() =>
    readLocal<OnboardingAnswers>('onboarding', { subjects: [], dailyGoalMinutes: 120 }),
  )
  const [onboarded, setOnboarded] = useState<boolean>(() => readLocal<boolean>('onboarded', false))
  const [favorites, setFavorites] = useState<string[]>(() =>
    readLocal<string[]>('favorites', ['chapter:chemistry:alcohols-phenols-and-ethers']),
  )
  const { user, loading: authLoading, isDemo } = useAuthContext()
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readLocal<string[]>('recent-searches', ["Kirchhoff's Laws", 'Nernst Equation']),
  )
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [searchOpen, setSearchOpen] = useState(false)

  /* Favourites mirror the signed-in student's bookmarks (server is the source
     of truth once Supabase is configured; demo mode stays on localStorage). */
  useEffect(() => {
    if (authLoading || isDemo) return
    let cancelled = false
    getBookmarkedKeys()
      .then((keys) => {
        if (!cancelled) setFavorites(Array.from(keys))
      })
      .catch(() => {
        /* offline → keep whatever is on screen */
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, isDemo, user?.id])

  /* ⌘K / Ctrl+K opens global search anywhere in the app. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  /* --- persist + apply preferences --- */
  useEffect(() => {
    writeLocal('preferences', preferences)
    setReducedMotion(preferences.reduceMotion)
  }, [preferences])

  useEffect(() => {
    if (!window.matchMedia) return
    const list = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) =>
      setSystemPrefersDark(event.matches ? 'dark' : 'light')
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: 'light' | 'dark' =
    preferences.theme === 'system' ? systemPrefersDark : preferences.theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#0a0a0c' : '#f6f6f4')
  }, [resolvedTheme])

  /* --- actions --- */

  const setTheme = useCallback((theme: ThemePreference) => {
    setPreferences((prev) => ({ ...prev, theme }))
  }, [])

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const saveAnswers = useCallback((next: OnboardingAnswers) => {
    setAnswers(next)
    writeLocal('onboarding', next)
  }, [])

  const completeOnboarding = useCallback(() => {
    setOnboarded(true)
    writeLocal('onboarded', true)
  }, [])

  const resetOnboarding = useCallback(() => {
    setOnboarded(false)
    writeLocal('onboarded', false)
  }, [])

  const toggleFavorite = useCallback((id: string): boolean => {
    let added = false
    /* Optimistic: the card flips instantly, persistence follows. */
    setFavorites((prev) => {
      const has = prev.includes(id)
      added = !has
      return has ? prev.filter((entry) => entry !== id) : [...prev, id]
    })
    void toggleBookmark(id).catch(() => {
      /* Roll back to the server's copy if the write failed (offline, RLS…). */
      getBookmarkedKeys()
        .then((keys) => setFavorites(Array.from(keys)))
        .catch(() => undefined)
    })
    return added
  }, [])

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])

  const addRecentSearch = useCallback((term: string) => {
    const clean = term.trim()
    if (!clean) return
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((entry) => entry !== clean)].slice(0, 6)
      writeLocal('recent-searches', next)
      return next
    })
  }, [])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    writeLocal('recent-searches', [])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback<AppContextValue['toast']>(
    ({ title, description, variant = 'default' }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev.slice(-2), { id, title, description, variant }])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((entry) => entry.id !== id))
      }, 3600)
    },
    [],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      theme: preferences.theme,
      resolvedTheme,
      setTheme,
      preferences,
      updatePreference,
      answers,
      saveAnswers,
      favorites,
      toggleFavorite,
      isFavorite,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      toasts,
      toast,
      dismissToast,
      onboarded,
      completeOnboarding,
      resetOnboarding,
      searchOpen,
      openSearch: () => setSearchOpen(true),
      closeSearch: () => setSearchOpen(false),
    }),
    [
      preferences,
      resolvedTheme,
      setTheme,
      updatePreference,
      answers,
      saveAnswers,
      favorites,
      toggleFavorite,
      isFavorite,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      toasts,
      toast,
      dismissToast,
      onboarded,
      completeOnboarding,
      resetOnboarding,
      searchOpen,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside <AppProvider>')
  return context
}

/** Convenience aliases. */
export const useTheme = () => {
  const { theme, resolvedTheme, setTheme } = useApp()
  return { theme, resolvedTheme, setTheme }
}

export const useToast = () => {
  const { toast, toasts, dismissToast } = useApp()
  return { toast, toasts, dismissToast }
}

export const useFavorites = () => {
  const { favorites, toggleFavorite, isFavorite } = useApp()
  return { favorites, toggleFavorite, isFavorite }
}

export const useOnboardingAnswers = () => {
  const { answers, saveAnswers, onboarded, completeOnboarding } = useApp()
  return { answers, saveAnswers, onboarded, completeOnboarding }
}

export type { SubjectId }
