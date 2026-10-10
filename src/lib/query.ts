/**
 * ---------------------------------------------------------------------------
 * Tiny query cache (the data layer behind every `useQuery`).
 * ---------------------------------------------------------------------------
 * Deliberately small: one module-level map keyed by a query key, subscriber
 * notifications, in-flight de-duplication and a localStorage mirror so data
 * survives reloads and keeps working offline.
 *
 * It is *not* a state-management library — it only removes duplicate copies of
 * the same backend payload across components (see README → Data layer).
 *
 * Source of a payload is derived, never guessed:
 *   no credentials configured → `demo`   (bundled sample dataset)
 *   request succeeded         → `remote`
 *   request failed + cached   → `cache`  (offline / stale fallback)
 */
import { isSupabaseConfigured } from '@/lib/supabase'
import { readLocal, writeLocal, removeLocal } from '@/utils/storage'

export type QuerySource = 'remote' | 'cache' | 'demo'

export interface QueryState<T> {
  data?: T
  source?: QuerySource
  error: string | null
  loading: boolean
}

interface Entry {
  key: string
  data?: unknown
  source?: QuerySource
  error: string | null
  loading: boolean
  updatedAt: number
  fetcher?: () => Promise<unknown>
  subs: Set<() => void>
  inflight?: Promise<void>
  /** Immutable snapshot handed to `useSyncExternalStore` (identity is stable). */
  snapshot: QueryState<unknown>
}

const entries = new Map<string, Entry>()
const CACHE_PREFIX = 'query:'
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
const CACHE_MAX_BYTES = 700_000

function getEntry(key: string): Entry {
  let entry = entries.get(key)
  if (!entry) {
    entry = {
      key,
      loading: false,
      error: null,
      updatedAt: 0,
      subs: new Set(),
      snapshot: { data: undefined, source: undefined, error: null, loading: false },
    }
    entries.set(key, entry)
  }
  return entry
}

/** Publish a fresh snapshot and wake every subscriber. */
function commit(entry: Entry): void {
  entry.snapshot = {
    data: entry.data,
    source: entry.source,
    error: entry.error,
    loading: entry.loading,
  }
  entry.subs.forEach((listener) => listener())
}

/* ------------------------------- persistence ----------------------------- */

function readCache(key: string): { data: unknown; updatedAt: number } | undefined {
  const payload = readLocal<{ data?: unknown; t?: number } | undefined>(CACHE_PREFIX + key, undefined)
  if (!payload || payload.data === undefined) return undefined
  if (typeof payload.t === 'number' && Date.now() - payload.t > CACHE_MAX_AGE_MS) {
    removeLocal(CACHE_PREFIX + key)
    return undefined
  }
  return { data: payload.data, updatedAt: payload.t ?? 0 }
}

function writeCache(key: string, data: unknown): void {
  try {
    if (JSON.stringify(data).length > CACHE_MAX_BYTES) return // too large for localStorage
    writeLocal(CACHE_PREFIX + key, { data, t: Date.now() })
  } catch {
    /* quota exceeded / private mode — caching is best effort */
  }
}

/* -------------------------------- fetching ------------------------------- */

function messageOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: unknown }).message)
    : 'Request failed'
}

async function run(entry: Entry, force = false): Promise<void> {
  const fetcher = entry.fetcher
  if (!fetcher) return
  if (entry.inflight && !force) return entry.inflight

  entry.loading = true
  entry.error = null
  commit(entry)

  const promise = (async () => {
    try {
      const data = await fetcher()
      entry.data = data
      entry.source = isSupabaseConfigured ? 'remote' : 'demo'
      entry.error = null
      entry.updatedAt = Date.now()
      if (isSupabaseConfigured) writeCache(entry.key, data)
    } catch (error) {
      /* Offline / failed request → serve the cached copy when we have one. */
      const cached = readCache(entry.key)
      if (cached && entry.data === undefined) {
        entry.data = cached.data
        entry.source = 'cache'
        entry.error = null
        entry.updatedAt = cached.updatedAt
      } else {
        entry.error = messageOf(error)
      }
    } finally {
      entry.loading = false
      entry.inflight = undefined
      commit(entry)
    }
  })()

  entry.inflight = promise
  return promise
}

/* ---------------------------------- API ---------------------------------- */

export interface QueryHandle<T> {
  get: () => QueryState<T>
  refetch: () => void
  dispose: () => void
}

/**
 * Read (and subscribe to) a query. The result is shared: two components using
 * the same key receive the same payload instead of two copies of it.
 */
export function subscribeQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  listener: () => void,
): QueryHandle<T> {
  const entry = getEntry(key)
  entry.fetcher = fetcher as () => Promise<unknown>
  entry.subs.add(listener)

  /* Hydrate from the persistent cache so a reload renders instantly. */
  if (entry.data === undefined && entry.updatedAt === 0) {
    const cached = readCache(key)
    if (cached) {
      entry.data = cached.data
      entry.source = 'cache'
      entry.updatedAt = cached.updatedAt
      entry.snapshot = { data: cached.data, source: 'cache', error: null, loading: false }
    }
  }

  if (!entry.loading && (entry.data === undefined || entry.error)) void run(entry)

  return {
    get: () => entry.snapshot as QueryState<T>,
    refetch: () => void run(entry, true),
    dispose: () => entry.subs.delete(listener),
  }
}

/** Force every matching query to refetch (used after a mutation). */
export function invalidateQueries(prefix?: string): void {
  entries.forEach((entry, key) => {
    if (prefix && !key.startsWith(prefix)) return
    if (entry.subs.size > 0) {
      void run(entry, true)
    } else {
      entries.delete(key)
      removeLocal(CACHE_PREFIX + key)
    }
  })
}

/** Wipe everything — called when the signed-in user changes. */
export function resetQueryCache(): void {
  entries.forEach((entry) => {
    if (entry.subs.size === 0) {
      entries.delete(entry.key)
      return
    }
    entry.data = undefined
    entry.source = undefined
    entry.error = null
    entry.updatedAt = 0
    entry.loading = false
    entry.inflight = undefined
    void run(entry, true)
  })
}

/** Write a value straight into the cache (optimistic updates). */
export function setQueryData<T>(key: string, updater: T | ((prev: T | undefined) => T)): void {
  const entry = getEntry(key)
  const next =
    typeof updater === 'function' ? (updater as (prev: T | undefined) => T)(entry.data as T) : updater
  entry.data = next
  entry.error = null
  entry.updatedAt = Date.now()
  writeCache(key, next)
  commit(entry)
}
