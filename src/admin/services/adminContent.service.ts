/**
 * Admin service: resource content management.
 *
 * Covers the publishing workflow the student app never sees:
 *
 *   draft → pending_review → approved → published → archived
 *                    ↘ rejected
 *
 * Enforcement is server-side. `public.guard_resource_status()` (migration
 * 0012) refuses any transition to `published` unless the session holds
 * `content.publish`, and `public.snapshot_resource_version()` (migration 0011)
 * writes a version row whenever live content changes. This module only asks.
 */
import { db, isDemo, rows, one, mutate } from '@/services/shared'
import type {
  AdminResourceRow,
  QualityIssue,
  ResourceStatus,
  ResourceType,
  ResourceVersionRow,
} from '../types/admin'
import { DEMO_ADMINS_PYQS, DEMO_ADMINS_RESOURCES } from '../data/adminDemo'
import { demoId, nowIso, readCollection, writeCollection } from './demoStore'
import { logAdminAction, logAdminActionDemo } from './adminAudit.service'

/* --------------------------------- listing -------------------------------- */

export interface ResourceFilter {
  status?: ResourceStatus | 'all'
  resourceType?: ResourceType | 'all'
  subjectId?: string | 'all'
  boardId?: string | 'all'
  classId?: string | 'all'
  createdBy?: string | 'all'
  search?: string
}

/** Server-side page of resources. Never loads the whole table into the app. */
export interface ResourcePage {
  items: AdminResourceRow[]
  total: number
  page: number
  pageSize: number
}

export const DEFAULT_PAGE_SIZE = 20

export async function listResources(
  filter: ResourceFilter = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<ResourcePage> {
  if (isDemo) {
    const all = applyFilter(readCollection<AdminResourceRow>('resources', DEMO_ADMINS_RESOURCES), filter)
    const start = (page - 1) * pageSize
    return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize }
  }

  const client = db()
  if (!client) return { items: [], total: 0, page, pageSize }

  let request = client
    .from('resources')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filter.status && filter.status !== 'all') request = request.eq('status', filter.status)
  if (filter.resourceType && filter.resourceType !== 'all') request = request.eq('resource_type', filter.resourceType)
  if (filter.subjectId && filter.subjectId !== 'all') request = request.eq('subject_id', filter.subjectId)
  if (filter.boardId && filter.boardId !== 'all') request = request.eq('board_id', filter.boardId)
  if (filter.classId && filter.classId !== 'all') request = request.eq('class_id', filter.classId)
  if (filter.createdBy && filter.createdBy !== 'all') request = request.eq('created_by', filter.createdBy)
  if (filter.search?.trim()) request = request.ilike('title', `%${filter.search.trim()}%`)

  const { data, error, count } = await request
  if (error) throw new Error('We could not load the resources. Please try again.')

  return {
    items: (data as AdminResourceRow[]) ?? [],
    total: count ?? 0,
    page,
    pageSize,
  }
}

function applyFilter(items: AdminResourceRow[], filter: ResourceFilter): AdminResourceRow[] {
  const needle = filter.search?.trim().toLowerCase() ?? ''
  return items
    .filter((row) => (filter.status && filter.status !== 'all' ? row.status === filter.status : true))
    .filter((row) =>
      filter.resourceType && filter.resourceType !== 'all' ? row.resource_type === filter.resourceType : true,
    )
    .filter((row) => (filter.subjectId && filter.subjectId !== 'all' ? row.subject_id === filter.subjectId : true))
    .filter((row) => (filter.boardId && filter.boardId !== 'all' ? row.board_id === filter.boardId : true))
    .filter((row) => (filter.classId && filter.classId !== 'all' ? row.class_id === filter.classId : true))
    .filter((row) => (filter.createdBy && filter.createdBy !== 'all' ? row.created_by === filter.createdBy : true))
    .filter((row) => (needle ? row.title.toLowerCase().includes(needle) : true))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function getResource(id: string): Promise<AdminResourceRow | null> {
  if (isDemo) {
    return readCollection<AdminResourceRow>('resources', DEMO_ADMINS_RESOURCES).find((r) => r.id === id) ?? null
  }
  const client = db()
  if (!client) return null
  return one<AdminResourceRow>(client.from('resources').select('*').eq('id', id).maybeSingle())
}

/* --------------------------------- create --------------------------------- */

export interface ResourceDraft {
  title: string
  description?: string
  resource_type: ResourceType
  board_id: string
  class_id: string
  subject_id?: string | null
  chapter_id?: string | null
  author_name?: string
  source_name?: string
  thumbnail_url?: string | null
  file_path?: string | null
  file_size_bytes?: number | null
  tags: string[]
}

/**
 * Save a new resource.
 *
 * `target` decides the starting state: `draft` for editors, `pending_review`
 * when submitting for review, `published` when an admin publishes immediately.
 * The database re-checks the transition regardless of what the client asks for.
 */
export async function createResource(
  draft: ResourceDraft,
  target: Extract<ResourceStatus, 'draft' | 'pending_review' | 'published'>,
): Promise<AdminResourceRow> {
  const values = {
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    resource_type: draft.resource_type,
    board_id: draft.board_id,
    class_id: draft.class_id,
    subject_id: draft.subject_id || null,
    chapter_id: draft.chapter_id || null,
    author_name: draft.author_name?.trim() || null,
    source_name: draft.source_name?.trim() || null,
    thumbnail_url: draft.thumbnail_url || null,
    file_path: draft.file_path || null,
    file_size_bytes: draft.file_size_bytes || null,
    tags: draft.tags,
    status: target,
  }

  if (isDemo) {
    const created: AdminResourceRow = {
      id: demoId('r'),
      ...values,
      is_published: target === 'published',
      created_by: 'demo-admin',
      updated_by: 'demo-admin',
      reviewed_by: target === 'published' ? 'demo-admin' : null,
      review_note: null,
      published_at: target === 'published' ? nowIso() : null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const all = readCollection<AdminResourceRow>('resources', DEMO_ADMINS_RESOURCES)
    writeCollection<AdminResourceRow>('resources', [created, ...all])
    await logAdminActionDemo('resource.created', 'resource', created.id, { title: created.title, status: target })
    return created
  }

  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  const row = await one<AdminResourceRow>(
    client
      .from('resources')
      .insert({ ...values, created_by: (await currentUserId(client)) ?? undefined })
      .select()
      .single(),
  )
  if (!row) throw new Error('The resource could not be created.')

  await logAdminAction('resource.created', 'resource', row.id, { title: row.title, status: target })
  return row
}

/* --------------------------------- update --------------------------------- */

export async function updateResource(
  id: string,
  patch: Partial<ResourceDraft> & { review_note?: string | null },
): Promise<void> {
  if (isDemo) {
    const all = readCollection<AdminResourceRow>('resources', DEMO_ADMINS_RESOURCES)
    writeCollection<AdminResourceRow>(
      'resources',
      all.map((row) => (row.id === id ? { ...row, ...patch, updated_at: nowIso() } : row)),
    )
    await logAdminActionDemo('resource.updated', 'resource', id, { fields: Object.keys(patch) })
    return
  }

  const client = db()
  if (!client) return
  await mutate(
    client.from('resources').update({ ...patch, updated_by: await currentUserId(client) }).eq('id', id),
  )
  await logAdminAction('resource.updated', 'resource', id, { fields: Object.keys(patch) })
}

/**
 * Move a resource through the workflow.
 *
 * The label sent to the database is the single source of truth; `is_published`
 * is derived by the `resources_sync_status` trigger and never set here.
 */
export async function setResourceStatus(
  id: string,
  status: ResourceStatus,
  options: { note?: string } = {},
): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_by: null }
  if (options.note) patch.review_note = options.note

  if (isDemo) {
    const all = readCollection<AdminResourceRow>('resources', DEMO_ADMINS_RESOURCES)
    writeCollection<AdminResourceRow>(
      'resources',
      all.map((row) =>
        row.id === id
          ? {
              ...row,
              status,
              is_published: status === 'published',
              review_note: options.note ?? row.review_note,
              reviewed_by: status === 'draft' ? row.reviewed_by : 'demo-admin',
              published_at: status === 'published' ? (row.published_at ?? nowIso()) : row.published_at,
              updated_at: nowIso(),
            }
          : row,
      ),
    )
    await logAdminActionDemo(actionForStatus(status), 'resource', id, { status, note: options.note })
    return
  }

  const client = db()
  if (!client) return
  patch.updated_by = await currentUserId(client)
  if (status !== 'draft') patch.reviewed_by = patch.updated_by

  await mutate(client.from('resources').update(patch).eq('id', id))
  await logAdminAction(actionForStatus(status), 'resource', id, { status, note: options.note })
}

function actionForStatus(status: ResourceStatus): string {
  switch (status) {
    case 'published':
      return 'resource.published'
    case 'archived':
      return 'resource.archived'
    case 'rejected':
      return 'resource.rejected'
    case 'pending_review':
      return 'resource.submitted'
    case 'approved':
      return 'resource.approved'
    default:
      return 'resource.updated'
  }
}

/** Hard delete — only ever offered when nothing references the row. */
export async function deleteResource(id: string): Promise<void> {
  if (isDemo) {
    const all = readCollection<AdminResourceRow>('resources', DEMO_ADMINS_RESOURCES)
    writeCollection<AdminResourceRow>('resources', all.filter((row) => row.id !== id))
    await logAdminActionDemo('resource.deleted', 'resource', id, {})
    return
  }
  const client = db()
  if (!client) return
  await mutate(client.from('resources').delete().eq('id', id))
  await logAdminAction('resource.deleted', 'resource', id, {})
}

/* ------------------------------ version history --------------------------- */

export async function listResourceVersions(resourceId: string): Promise<ResourceVersionRow[]> {
  if (isDemo) return [] // demo mode has no versioning history to show

  const client = db()
  if (!client) return []

  return rows<ResourceVersionRow>(
    client
      .from('resource_versions')
      .select('*')
      .eq('resource_id', resourceId)
      .order('version', { ascending: false })
      .limit(50),
  )
}

/* ------------------------------ bulk operations --------------------------- */

export interface BulkResult {
  updated: number
  failed: { id: string; reason: string }[]
}

/**
 * Apply one change to many resources. Each row is updated individually so a
 * single rejected transition (e.g. publishing without permission) cannot take
 * the whole batch down, and the failures are reported per row.
 */
export async function bulkSetStatus(
  ids: string[],
  status: ResourceStatus,
  options: { note?: string } = {},
): Promise<BulkResult> {
  const failed: { id: string; reason: string }[] = []
  let updated = 0

  for (const id of ids) {
    try {
      await setResourceStatus(id, status, options)
      updated += 1
    } catch (error) {
      failed.push({ id, reason: error instanceof Error ? error.message : 'Update failed.' })
    }
  }

  return { updated, failed }
}

export async function bulkSetSubject(ids: string[], subjectId: string): Promise<BulkResult> {
  const failed: { id: string; reason: string }[] = []
  let updated = 0

  for (const id of ids) {
    try {
      await updateResource(id, { subject_id: subjectId })
      updated += 1
    } catch (error) {
      failed.push({ id, reason: error instanceof Error ? error.message : 'Update failed.' })
    }
  }

  return { updated, failed }
}

/* ---------------------------- content quality ----------------------------- */
/* Spec §26 — a health check over the academic database. */

export async function getContentQualityIssues(): Promise<QualityIssue[]> {
  const [resources, chapters, subjects] = await Promise.all([
    listAllResourcesForAudit(),
    listChaptersForAudit(),
    listSubjectsForAudit(),
  ])

  const pyqs = await listPyqChaptersForAudit()

  const chapterIdsWithResources = new Set(resources.map((r) => r.chapter_id).filter(Boolean))
  const subjectIdsWithPyqs = new Set(pyqs)

  const issues: QualityIssue[] = [
    {
      id: 'no-thumbnail',
      label: 'Resources without a thumbnail',
      detail: 'Cards fall back to a generic icon in the student library.',
      count: resources.filter((r) => r.status === 'published' && !r.thumbnail_url).length,
      href: '/admin/content',
    },
    {
      id: 'no-file',
      label: 'Published resources with no file',
      detail: 'Students see a download button that has nothing to serve.',
      count: resources.filter((r) => r.status === 'published' && !r.file_path).length,
      href: '/admin/content',
    },
    {
      id: 'pending-review',
      label: 'Resources waiting for review',
      detail: 'Submitted by editors and not yet approved or published.',
      count: resources.filter((r) => r.status === 'pending_review').length,
      href: '/admin/content',
    },
    {
      id: 'stale-drafts',
      label: 'Unpublished drafts',
detail: 'Created but never submitted — worth chasing up.',
      count: resources.filter((r) => r.status === 'draft').length,
      href: '/admin/content',
    },
    {
      id: 'empty-chapters',
      label: 'Chapters with no resources',
      detail: 'Students reach these chapters and find nothing to study.',
      count: chapters.filter((c) => !chapterIdsWithResources.has(c.id)).length,
      href: '/admin/academic/chapters',
    },
    {
      id: 'subjects-no-pyqs',
      label: 'Subjects with no PYQs',
      detail: 'The PYQ Intelligence screen is empty for these subjects.',
      count: subjects.filter((s) => !subjectIdsWithPyqs.has(s.id)).length,
      href: '/admin/content/pyq',
    },
  ]

  return issues.filter((issue) => issue.count > 0)
}

async function listAllResourcesForAudit(): Promise<AdminResourceRow[]> {
  if (isDemo) return readCollection<AdminResourceRow>('resources', DEMO_ADMINS_RESOURCES)
  const client = db()
  if (!client) return []
  return rows<AdminResourceRow>(client.from('resources').select('*').limit(5000))
}

async function listChaptersForAudit(): Promise<{ id: string }[]> {
  if (isDemo) return readCollection<{ id: string }>('chapters', [])
  const client = db()
  if (!client) return []
  return rows<{ id: string }>(client.from('chapters').select('id').eq('is_archived', false))
}

async function listSubjectsForAudit(): Promise<{ id: string }[]> {
  if (isDemo) return readCollection<{ id: string }>('subjects', [])
  const client = db()
  if (!client) return []
  return rows<{ id: string }>(client.from('subjects').select('id').eq('is_archived', false))
}

async function listPyqChaptersForAudit(): Promise<string[]> {
  if (isDemo) {
    const ids = new Set<string>()
    for (const q of DEMO_ADMINS_PYQS) if (q.subject_id) ids.add(q.subject_id)
    return [...ids]
  }
  const client = db()
  if (!client) return []
  const list = await rows<{ subject_id: string | null }>(
    client.from('pyq_questions').select('subject_id').limit(5000),
  )
  return [...new Set(list.map((row) => row.subject_id).filter((id): id is string => Boolean(id)))]
}

/* --------------------------------- uploads -------------------------------- */

export interface UploadResult {
  path: string
  sizeBytes: number
}

/** Human-readable byte size for the uploader preview. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
export const MAX_UPLOAD_MB = 50

export interface UploadValidation {
  ok: boolean
  reason?: string
}

/** Client-side pre-flight; the storage policy is the real gate. */
export function validateUpload(file: File): UploadValidation {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { ok: false, reason: 'Only PDF, PNG, JPG and WEBP files are allowed.' }
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, reason: `Files must be smaller than ${MAX_UPLOAD_MB} MB.` }
  }
  return { ok: true }
}

/**
 * Upload a file to the `resources` storage bucket.
 *
 * Progress is reported through `onProgress`; the path returned is what gets
 * stored on the resource row, and the bucket policy restricts writes to
 * holders of `content.upload`.
 */
export async function uploadResourceFile(
  file: File,
  options: { folder?: string; onProgress?: (percent: number) => void } = {},
): Promise<UploadResult> {
  const validation = validateUpload(file)
  if (!validation.ok) throw new Error(validation.reason)

  const folder = options.folder ?? 'uploads'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase()
  const path = `${folder}/${demoId('f')}-${safeName}`

  if (isDemo) {
    // Demo mode cannot store a real object, so simulate the progress events
    // the real uploader would emit, then report the path as if it succeeded.
    for (const step of [15, 42, 78, 100]) options.onProgress?.(step)
    return { path, sizeBytes: file.size }
  }

  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  return new Promise<UploadResult>((resolve, reject) => {
    client.storage
      .from('resources')
      .upload(path, file, { cacheControl: '3600', upsert: false })
      .then(({ error }) => {
        if (error) {
          reject(new Error('The upload failed. Please try again.'))
          return
        }
        options.onProgress?.(100)
        resolve({ path, sizeBytes: file.size })
      })
      .catch(() => reject(new Error('The upload failed. Please try again.')))
  })
}

/** Short-lived signed URL for previewing a stored file. */
export async function signedResourceUrl(path: string): Promise<string | null> {
  if (!path) return null
  if (isDemo) return null

  const client = db()
  if (!client) return null

  const { data } = await client.storage.from('resources').createSignedUrl(path, 300)
  return data?.signedUrl ?? null
}

async function currentUserId(client: NonNullable<ReturnType<typeof db>>): Promise<string | null> {
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}
