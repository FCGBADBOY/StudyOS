/**
 * Admin service: platform settings.
 *
 * Only settings that are actually backed by a row in
 * `public.platform_settings` are exposed (spec §31 — no decorative toggles
 * that do nothing). Reading needs `is_admin_user()`, writing needs
 * `settings.manage`, both enforced by RLS policies in migration 0012.
 *
 * In demo mode the values persist to localStorage so the screen still
 * behaves like a real settings page.
 */
import { db, isDemo, one, mutate } from '@/services/shared'
import { readLocal, writeLocal } from '@/utils/storage'

/* --------------------------------- shapes --------------------------------- */

export interface UploadSettings {
  max_file_mb: number
  allowed_types: string[]
}

export interface ContentSettings {
  default_status: 'draft' | 'pending_review' | 'published'
  /** Editors must submit for review rather than publishing directly. */
  require_review: boolean
}

export interface PlatformSettings {
  student_signups: boolean
  /** Optional address that content reports are forwarded to. */
  report_email: string
}

export interface AdminSettings {
  upload: UploadSettings
  content: ContentSettings
  platform: PlatformSettings
}

/** Fallbacks used until the rows exist (and for demo mode). */
export const DEFAULT_SETTINGS: AdminSettings = {
  upload: { max_file_mb: 50, allowed_types: ['pdf', 'png', 'jpg', 'jpeg', 'webp'] },
  content: { default_status: 'draft', require_review: true },
  platform: { student_signups: true, report_email: '' },
}

const LOCAL_KEY = 'admin:settings'

/* --------------------------------- reading -------------------------------- */

export async function getSettings(): Promise<AdminSettings> {
  if (isDemo) return readLocal<AdminSettings>(LOCAL_KEY, DEFAULT_SETTINGS)

  const client = db()
  if (!client) return DEFAULT_SETTINGS

  const rows = await fetchAllSettings(client)
  const merged: AdminSettings = {
    upload: { ...DEFAULT_SETTINGS.upload, ...(rows.upload as Partial<UploadSettings> | null) },
    content: { ...DEFAULT_SETTINGS.content, ...(rows.content as Partial<ContentSettings> | null) },
    platform: { ...DEFAULT_SETTINGS.platform, ...(rows.platform as Partial<PlatformSettings> | null) },
  }
  return merged
}

async function fetchAllSettings(
  client: NonNullable<ReturnType<typeof db>>,
): Promise<Record<string, unknown>> {
  const { data, error } = await client.from('platform_settings').select('key, value')
  if (error || !data) return {}

  const map: Record<string, unknown> = {}
  for (const row of data as { key: string; value: unknown }[]) map[row.key] = row.value
  return map
}

/* --------------------------------- writing -------------------------------- */

/** Persist one settings group. Values are validated before they are sent. */
export async function saveSettings<K extends keyof AdminSettings>(
  key: K,
  value: AdminSettings[K],
): Promise<void> {
  if (key === 'upload') assertUpload(value as UploadSettings)
  if (key === 'content') assertContent(value as ContentSettings)
  if (key === 'platform') assertPlatform(value as PlatformSettings)

  if (isDemo) {
    const current = readLocal<AdminSettings>(LOCAL_KEY, DEFAULT_SETTINGS)
    writeLocal<AdminSettings>(LOCAL_KEY, { ...current, [key]: value })
    return
  }

  const client = db()
  if (!client) return

  const { error } = await client
    .from('platform_settings')
    .upsert({ key, value, updated_by: await currentUserId(client) }, { onConflict: 'key' })

  if (error) throw new Error('We could not save that setting. Please try again.')
}

/* ------------------------------- validation ------------------------------- */

function assertUpload(value: UploadSettings): void {
  if (!Number.isFinite(value.max_file_mb) || value.max_file_mb <= 0 || value.max_file_mb > 500) {
    throw new Error('Maximum upload size must be between 1 and 500 MB.')
  }
  if (!Array.isArray(value.allowed_types) || value.allowed_types.length === 0) {
    throw new Error('At least one allowed file type is required.')
  }
}

function assertContent(value: ContentSettings): void {
  const allowed = ['draft', 'pending_review', 'published'] as const
  if (!allowed.includes(value.default_status)) {
    throw new Error('The default status is not valid.')
  }
}

function assertPlatform(value: PlatformSettings): void {
  if (value.report_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.report_email)) {
    throw new Error('Enter a valid email address, or leave the field empty.')
  }
}

async function currentUserId(client: NonNullable<ReturnType<typeof db>>): Promise<string | null> {
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

/* --------------------------- admin notification prefs --------------------- */
/**
 * Per-admin notification preferences live in the same localStorage namespace
 * as the student app's preferences, so both surfaces share one storage
 * helper and one key prefix.
 */

export interface AdminNotificationPrefs {
  newSubmissions: boolean
  openReports: boolean
  weeklyDigest: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: AdminNotificationPrefs = {
  newSubmissions: true,
  openReports: true,
  weeklyDigest: false,
}

export function getNotificationPrefs(): AdminNotificationPrefs {
  return readLocal<AdminNotificationPrefs>('admin:notifications', DEFAULT_NOTIFICATION_PREFS)
}

export function saveNotificationPrefs(prefs: AdminNotificationPrefs): void {
  writeLocal<AdminNotificationPrefs>('admin:notifications', prefs)
}
