/**
 * Demo-mode persistence for the Admin Portal.
 *
 * When Supabase is not configured the admin screens still have to behave like
 * a real CMS — a Publish click must still be Published after a refresh, and a
 * role change must stick. This tiny store mirrors the student app's
 * localStorage overlay (`src/services/shared.ts`) but for admin collections.
 *
 * It is NEVER used against a real backend: every service checks `isDemo`
 * first and only reaches for these helpers when no client exists.
 *
 * NOTE: `readLocal`/`writeLocal` already prepend the `studyos:` namespace, so
 * the keys below are `admin:<collection>` and end up as
 * `studyos:admin:<collection>` in localStorage.
 */
import { readLocal, writeLocal, removeLocal } from '@/utils/storage'

const PREFIX = 'admin:'

/** Generate a stable-enough id for demo rows. */
export function demoId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${random}`
}

/**
 * Read a demo collection, seeding localStorage on first use.
 *
 * Returns a fresh mutable copy so callers can sort/filter without touching the
 * persisted array.
 */
export function readCollection<T extends { id: string }>(key: string, seed: T[]): T[] {
  const stored = readLocal<T[] | null>(`${PREFIX}${key}`, null)
  if (stored && Array.isArray(stored)) return stored.map((row) => ({ ...row }))
  writeLocal(`${PREFIX}${key}`, seed)
  return seed.map((row) => ({ ...row }))
}

export function writeCollection<T extends { id: string }>(key: string, rows: T[]): void {
  writeLocal(`${PREFIX}${key}`, rows)
}

/**
 * Reset one collection back to its seed data.
 * `removeLocal` adds the `studyos:` namespace, so the key matches what
 * `readCollection` wrote.
 */
export function resetCollection(key: string): void {
  removeLocal(`${PREFIX}${key}`)
}

/** Every admin demo collection, as stored (`studyos:admin:<name>`). */
const STORED_PREFIX = `studyos:${PREFIX}`

/** Reset every admin demo collection (used by "Reset demo data"). */
export function resetAllDemoData(): void {
  if (typeof window === 'undefined') return
  const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(STORED_PREFIX))
  for (const key of keys) window.localStorage.removeItem(key)
}

/** ISO timestamp for demo mutations. */
export function nowIso(): string {
  return new Date().toISOString()
}
