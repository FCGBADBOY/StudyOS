/**
 * Shared helpers for the service layer.
 *
 * Rules every service follows:
 *  - no credentials anywhere (the client lives in `src/lib/supabase.ts`)
 *  - when Supabase is not configured, return the bundled sample dataset so the
 *    UI keeps working (the query layer labels that payload `demo`)
 *  - when Supabase *is* configured, succeed or throw — never silently fall
 *    back to mock data (the query layer degrades to cached data / an error)
 *  - never surface raw database errors to the UI
 */
import { supabase, isSupabaseConfigured, readableError } from '@/lib/supabase'
import { readLocal, writeLocal } from '@/utils/storage'
import type { SubjectId } from '@/types'

export { isSupabaseConfigured, readableError }

/** `true` when the app runs without a backend (bundled sample dataset). */
export const isDemo = !isSupabaseConfigured

/** The client, or `null` in demo mode. */
export function db() {
  return supabase
}

/** Unwrap a Supabase select result, throwing a readable message on failure. */
export async function rows<T>(result: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await result
  if (error) throw new Error(readableError(error))
  return (data as T[]) ?? []
}

/** Unwrap a single-row result (`data` may be `null`). */
export async function one<T>(
  result: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await result
  if (error) throw new Error(readableError(error))
  return (data as T | null) ?? null
}

/** Throwing wrapper for mutations (insert / update / delete). */
export async function mutate(
  result: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<void> {
  const { error } = await result
  if (error) throw new Error(readableError(error))
}

/* ------------------------------ tiny memo -------------------------------- */

interface MemoEntry {
  expires: number
  promise: Promise<unknown>
}

const memoStore = new Map<string, MemoEntry>()

/**
 * De-duplicate identical in-flight requests for a short window so a page that
 * asks for the same aggregates through three hooks still hits the database
 * once. Cleared whenever the signed-in user changes.
 */
export function memo<T>(key: string, fn: () => Promise<T>, ttlMs = 15_000): Promise<T> {
  const existing = memoStore.get(key)
  if (existing && existing.expires > Date.now()) return existing.promise as Promise<T>

  const promise = fn().catch((error) => {
    memoStore.delete(key) // never cache a failure
    throw error
  })
  memoStore.set(key, { expires: Date.now() + ttlMs, promise })
  return promise as Promise<T>
}

export function resetMemo(): void {
  memoStore.clear()
}

/** Drop one memoized entry (after a mutation). */
export function forgetMemo(key: string): void {
  memoStore.delete(key)
}

/* --------------------------------- ids ----------------------------------- */

const SUBJECT_IDS: SubjectId[] = ['physics', 'chemistry', 'mathematics', 'english', 'computer-science']

/** DB subject slug → the UI's `SubjectId` (falls back to `physics`). */
export function toSubjectId(slug: string | null | undefined): SubjectId {
  return (SUBJECT_IDS as string[]).includes(slug ?? '') ? (slug as SubjectId) : 'physics'
}

/** UI id for a chapter row: `chapter:<subject>:<slug>` (stable across devices). */
export function chapterKey(subjectSlug: string, chapterSlug: string): string {
  return `chapter:${subjectSlug}:${chapterSlug}`
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/* ------------------------------- date helpers ---------------------------- */

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function daysAgo(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

/** Monday 00:00 of the current week (local time), as an ISO string. */
export function startOfWeek(): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const weekday = (date.getDay() + 6) % 7 // Mon = 0
  date.setDate(date.getDate() - weekday)
  return date.toISOString()
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/* --------------------------- demo-mode overlay --------------------------- *
 * Without a backend, mutations still need to *look* persistent (add a mistake,
 * refresh, it is still there). A tiny overlay on top of the sample dataset
 * gives that behaviour in localStorage — real deployments never touch it.
 * ------------------------------------------------------------------------ */

interface OverlayState<T> {
  added: T[]
  updated: Record<string, T>
  deleted: string[]
}

function overlayKey(key: string): string {
  return `overlay:${key}`
}

function readOverlay<T>(key: string): OverlayState<T> {
  return readLocal<OverlayState<T>>(overlayKey(key), { added: [], updated: {}, deleted: [] })
}

function writeOverlay<T>(key: string, state: OverlayState<T>): void {
  writeLocal(overlayKey(key), state)
}

export function overlayList<T extends { id: string }>(key: string, base: T[]): T[] {
  const state = readOverlay<T>(key)
  const alive = (item: T) => !state.deleted.includes(item.id)
  const merged = [...state.added.filter(alive), ...base.filter(alive)].map(
    (item) => state.updated[item.id] ?? item,
  )
  return merged
}

export function overlayAdd<T extends { id: string }>(key: string, item: T): void {
  const state = readOverlay<T>(key)
  state.added.unshift(item)
  writeOverlay(key, state)
}

export function overlayUpdate<T extends { id: string }>(key: string, item: T): void {
  const state = readOverlay<T>(key)
  if (state.added.some((entry) => entry.id === item.id)) {
    state.added = state.added.map((entry) => (entry.id === item.id ? item : entry))
  } else {
    state.updated[item.id] = item
  }
  writeOverlay(key, state)
}

export function overlayRemove(key: string, id: string): void {
  const state = readOverlay<{ id: string }>(key)
  if (!state.deleted.includes(id)) state.deleted.push(id)
  state.added = state.added.filter((entry) => entry.id !== id)
  delete state.updated[id]
  writeOverlay(key, state)
}
