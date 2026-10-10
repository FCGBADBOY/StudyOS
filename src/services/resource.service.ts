/**
 * Resources / notes service.
 *
 * Database rows describe *what* a resource is; Supabase Storage holds the file
 * itself (`resources/<board>/<class>/<subject>/<chapter>/<file>`). Nothing big
 * is ever stored in PostgreSQL.
 */
import type { Resource, ResourceType } from '@/types'
import type { ResourceFilter, ResourceRow, ResourceRowType } from '@/types/resources'
import { buildChapterResources, buildSubjectResources } from '@/data/resources'
import { BUCKETS } from '@/types/resources'
import { db, isDemo, memo, rows, toSubjectId } from './shared'
import { getChapterEntry, getSubject } from './academic.service'
import { getBookmarkedKeys } from './bookmark.service'
import { recordResourceOpen } from './progress.service'
import { relativeTime } from '@/utils/format'

/** Database type → the UI's existing tab vocabulary. */
const TYPE_MAP: Record<ResourceRowType, ResourceType> = {
  notes: 'notes',
  revision_notes: 'revision',
  formula_sheet: 'formula-sheet',
  diagram: 'diagram',
  sample_paper: 'sample-paper',
  important_questions: 'important-questions',
  reference_material: 'reference',
  video: 'video',
  other: 'notes',
}

interface ResourceEmbed extends ResourceRow {
  chapters: {
    id: string
    slug: string
    name: string
    subject_id: string
    subjects: { id: string; slug: string; name: string } | null
  } | null
}

function formatSize(bytes: number | null): string | undefined {
  if (!bytes || bytes <= 0) return undefined
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toResource(row: ResourceEmbed, bookmarked: Set<string>): Resource {
  const chapter = row.chapters
  const subjectSlug = chapter?.subjects?.slug ?? 'physics'
  const key = `resource:${row.id}`
  const meta = row.page_count
    ? `${row.page_count} pages`
    : row.question_count
      ? `${row.question_count} questions`
      : row.source_name ?? ''

  return {
    id: row.id,
    type: TYPE_MAP[row.resource_type] ?? 'notes',
    title: row.title,
    subjectId: toSubjectId(subjectSlug),
    chapterSlug: chapter?.slug,
    description: row.description ?? '',
    meta,
    size: formatSize(row.file_size_bytes),
    pages: row.page_count ?? undefined,
    questions: row.question_count ?? undefined,
    updated: relativeTime(row.updated_at),
    bookmarked: bookmarked.has(key),
    downloaded: Boolean(row.file_path),
  }
}

/** Every published resource (one memoized request shared by all screens). */
async function loadResources(): Promise<{ rows: Resource[]; byId: Map<string, ResourceEmbed> }> {
  return memo('resources', async () => {
    const client = db()
    if (!client) return { rows: [], byId: new Map() }

    const list = await rows<ResourceEmbed>(
      client
        .from('resources')
        .select('*, chapters(id, slug, name, subject_id, subjects(id, slug, name))')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(500),
    )
    const bookmarks = await getBookmarkedKeys()
    const byId = new Map(list.map((row) => [row.id, row]))
    return { rows: list.map((row) => toResource(row, bookmarks)), byId }
  })
}

/** Raw row (for storage URLs). */
export async function getResourceRow(resourceId: string): Promise<ResourceEmbed | null> {
  const { byId } = await loadResources()
  return byId.get(resourceId) ?? null
}

export async function getResources(filter: ResourceFilter = {}): Promise<Resource[]> {
  if (isDemo) {
    const subject = filter.subjectSlug
      ? await getSubject(filter.subjectSlug)
      : undefined
    const match = filter.chapterSlug && subject
      ? subject.chapters.find((chapter) => chapter.slug === filter.chapterSlug)
      : undefined
    if (subject && match) return buildChapterResources(subject, match)
    if (subject) return buildSubjectResources(subject)
    return []
  }

  const { rows: list } = await loadResources()
  return list.filter((resource) => {
    if (filter.type && resource.type !== filter.type) return false
    if (filter.chapterSlug && resource.chapterSlug !== filter.chapterSlug) return false
    if (filter.subjectSlug && resource.subjectId !== filter.subjectSlug) return false
    return true
  })
}

/** Resources attached to one chapter (Library chapter page). */
export async function getChapterResources(subjectId: string, chapterSlug: string): Promise<Resource[]> {
  if (isDemo) {
    const match = await getChapterEntry(subjectId, chapterSlug)
    return match ? buildChapterResources(match.subject, match.chapter) : []
  }
  const { rows: list } = await loadResources()
  return list.filter((resource) => resource.chapterSlug === chapterSlug && resource.subjectId === subjectId)
}

/** Whole-syllabus resources for a subject (Library subject page). */
export async function getSubjectResources(subjectId?: string): Promise<Resource[]> {
  if (isDemo) {
    const subject = await getSubject(subjectId)
    return subject ? buildSubjectResources(subject) : []
  }
  const { rows: list } = await loadResources()
  return subjectId ? list.filter((resource) => resource.subjectId === subjectId) : list
}

/**
 * A signed, short-lived URL for a stored file (PDF / image / thumbnail).
 * Returns `null` in demo mode or when a row has no file yet.
 */
export async function getResourceFileUrl(resourceId: string, expiresIn = 3600): Promise<string | null> {
  const client = db()
  if (!client) return null

  const row = await getResourceRow(resourceId)
  if (!row?.file_path) return null

  const { data, error } = await client.storage.from(BUCKETS.resources).createSignedUrl(row.file_path, expiresIn)
  if (error || !data) return null
  return data.signedUrl
}

/** Public (or signed) URL for a thumbnail, if the row has one. */
export async function getResourceThumbnail(resourceId: string): Promise<string | null> {
  const row = await getResourceRow(resourceId)
  if (!row) return null
  if (row.thumbnail_url) return row.thumbnail_url
  return getResourceFileUrl(resourceId)
}

/** "Opened" → progress + one line in Recent Activity. */
export async function trackResourceOpen(resource: Resource): Promise<void> {
  const row = await getResourceRow(resource.id).catch(() => null)
  await recordResourceOpen({
    resourceId: resource.id,
    title: resource.title,
    subjectId: resource.subjectId,
    chapterId: row?.chapters?.id ?? null,
  })
}
