/**
 * Generic async query hook: loading / success / empty / error, retry, offline
 * fallback and de-duplicated requests.
 *
 * ```tsx
 * const { data, loading, error, refetch } = useQuery('boards', getBoards)
 * if (loading) return <SkeletonList />
 * if (error)   return <ErrorState onRetry={refetch} />
 * ```
 *
 * Every database-driven screen uses this instead of `useEffect` + `useState`,
 * so loading and error handling stay consistent across the app.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react'
import { subscribeQuery, type QuerySource, type QueryState } from '@/lib/query'

export interface UseQueryOptions {
  /** Skip the request (e.g. while the session is still restoring). */
  enabled?: boolean
}

export interface UseQueryResult<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  /** `remote` fresh from Supabase · `cache` from localStorage · `demo` sample data */
  source: QuerySource | undefined
  /** A refresh is running while existing data stays on screen. */
  isFetching: boolean
  refetch: () => void
}

const IDLE: QueryState<never> = { data: undefined, source: undefined, error: null, loading: false }

export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {},
): UseQueryResult<T> {
  const { enabled = true } = options
  const active = Boolean(key) && enabled

  /* The fetcher is re-created on every render — always call the latest one. */
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const handleRef = useRef<ReturnType<typeof subscribeQuery<T>> | null>(null)
  const keyRef = useRef<string | null>(null)

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active || !key) return () => {}
      if (handleRef.current && keyRef.current !== key) {
        handleRef.current.dispose()
        handleRef.current = null
      }
      keyRef.current = key
      handleRef.current = subscribeQuery<T>(key, () => fetcherRef.current(), onChange)
      const handle = handleRef.current
      return () => {
        handle.dispose()
        if (handleRef.current === handle) handleRef.current = null
      }
    },
    [key, active],
  )

  const getSnapshot = useCallback(
    (): QueryState<T> => (handleRef.current ? handleRef.current.get() : (IDLE as QueryState<T>)),
    [],
  )

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const refetch = useCallback(() => {
    handleRef.current?.refetch()
  }, [])

  return {
    data: state.data,
    loading: active && state.loading && state.data === undefined && !state.error,
    error: state.error,
    source: state.source,
    isFetching: state.loading,
    refetch,
  }
}
