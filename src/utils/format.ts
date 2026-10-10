/** Formatting helpers shared across the app. */

/** 32 -> "32 min", 95 -> "1 hr 35 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/** Whole days between today and an ISO date (never negative). */
export function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - now.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

/** "12 Nov 2026" */
export function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Rough relative time for "updated 2 days ago" labels.
 * Accepts a full ISO timestamp or a plain date.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((Date.now() - then) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`
  const years = Math.round(months / 12)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

/** "12 Nov" */
export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Greeting based on the local hour. */
export function greetingForHour(hour = new Date().getHours()): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

/** 12500 -> "12.5k" */
export function compactNumber(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_00_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  return `${(value / 1_00_000).toFixed(1)}L`
}

/** kebab-case slug generator used for deep links. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Title Case for mock search snippets. */
export function titleCase(input: string): string {
  return input.replace(/\b\w/g, (c) => c.toUpperCase())
}
