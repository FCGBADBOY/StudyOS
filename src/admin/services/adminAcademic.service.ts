/**
 * Admin service: academic hierarchy CRUD (boards › classes › streams ›
 * subjects › chapters).
 *
 * Every write goes through Row Level Security — `academic.manage` is checked
 * inside the database (migration 0012), so a content editor or student calling
 * these functions directly still gets a 42501. The demo fallback persists to
 * localStorage so the admin UI behaves like a real CMS without a backend.
 *
 * Nothing here is hard-coded to CBSE Class 12: rows come from the database and
 * every screen reads them, so adding a board or class is a data change only.
 */
import { db, isDemo, rows, one, mutate } from '@/services/shared'
import type {
  AdminBoardRow,
  AdminChapterRow,
  AdminClassRow,
  AdminStreamRow,
  AdminSubjectRow,
} from '../types/admin'
import {
  DEMO_ADMINS_BOARDS,
  DEMO_ADMINS_CHAPTERS,
  DEMO_ADMINS_CLASSES,
  DEMO_ADMINS_STREAMS,
  DEMO_ADMINS_SUBJECTS,
} from '../data/adminDemo'
import { demoId, nowIso, readCollection, writeCollection } from './demoStore'

/* ------------------------------- demo helpers ----------------------------- */

function demoList<T extends { id: string; is_archived: boolean }>(
  key: string,
  seed: T[],
  includeArchived: boolean,
): T[] {
  const all = readCollection<T>(key, seed)
  return includeArchived ? all : all.filter((row) => !row.is_archived)
}

function demoMutate<T extends { id: string }>(key: string, seed: T[], run: (all: T[]) => T[]): T[] {
  const all = readCollection<T>(key, seed)
  const next = run(all)
  writeCollection<T>(key, next)
  return next
}

/** Shared read for a hierarchy table (respects RLS when a client exists). */
async function readAll<T>(table: string, includeArchived: boolean): Promise<T[]> {
  const client = db()
  if (!client) return []
  const result = await rows<T>(client.from(table).select('*'))
  return includeArchived ? result : result.filter((row) => !(row as { is_archived?: boolean }).is_archived)
}

async function writeRow(
  table: string,
  values: Record<string, unknown>,
  id?: string,
): Promise<void> {
  const client = db()
  if (!client) return
  if (id) {
    await mutate(client.from(table).update(values).eq('id', id))
  } else {
    await mutate(client.from(table).insert(values))
  }
}

async function archiveRow(table: string, id: string, archived: boolean): Promise<void> {
  await writeRow(table, { is_archived: archived }, id)
}

/** Slugs are used in URLs, so keep them URL-safe and non-colliding. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/* ---------------------------------- boards -------------------------------- */

export async function listBoards(includeArchived = false): Promise<AdminBoardRow[]> {
  if (isDemo) return demoList('boards', DEMO_ADMINS_BOARDS, includeArchived)
  return readAll<AdminBoardRow>('boards', includeArchived)
}

export interface BoardInput {
  name: string
  short_name?: string
  description?: string
  display_order: number
  is_archived?: boolean
}

export async function createBoard(input: BoardInput): Promise<AdminBoardRow> {
  const slug = slugify(input.name)
  const values = {
    slug,
    name: input.name.trim(),
    short_name: input.short_name?.trim() || null,
    description: input.description?.trim() || null,
    display_order: input.display_order,
    is_archived: input.is_archived ?? false,
  }

  if (isDemo) {
    const created: AdminBoardRow = { id: demoId('b'), ...values }
    demoMutate('boards', DEMO_ADMINS_BOARDS, (all) => [created, ...all])
    await logDemo('academic.board_created', 'board', created.id, { name: created.name })
    return created
  }

  const client = db()
  const row = await one<AdminBoardRow>(client!.from('boards').insert(values).select().single())
  if (!row) throw new Error('The board could not be created.')
  await logAction('academic.board_created', 'board', row.id, { name: row.name })
  return row
}

export async function updateBoard(id: string, input: Partial<BoardInput>): Promise<void> {
  if (isDemo) {
    demoMutate('boards', DEMO_ADMINS_BOARDS, (all) =>
      all.map((row) => (row.id === id ? { ...row, ...input, updated_at: nowIso() } : row)),
    )
    await logDemo('academic.board_updated', 'board', id, {})
    return
  }
  await writeRow('boards', input, id)
  await logAction('academic.board_updated', 'board', id, {})
}

export async function setBoardArchived(id: string, archived: boolean): Promise<void> {
  if (isDemo) {
    demoMutate('boards', DEMO_ADMINS_BOARDS, (all) =>
      all.map((row) => (row.id === id ? { ...row, is_archived: archived } : row)),
    )
    await logDemo(archived ? 'academic.board_archived' : 'academic.board_restored', 'board', id, {})
    return
  }
  await archiveRow('boards', id, archived)
  await logAction(archived ? 'academic.board_archived' : 'academic.board_restored', 'board', id, {})
}

/* --------------------------------- classes -------------------------------- */

export async function listClasses(includeArchived = false): Promise<AdminClassRow[]> {
  if (isDemo) return demoList('classes', DEMO_ADMINS_CLASSES, includeArchived)
  return readAll<AdminClassRow>('classes', includeArchived)
}

export interface ClassInput {
  name: string
  description?: string
  display_order: number
  senior?: boolean
}

export async function createClass(input: ClassInput): Promise<AdminClassRow> {
  const values = {
    slug: slugify(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    display_order: input.display_order,
    senior: input.senior ?? false,
    is_archived: false,
  }

  if (isDemo) {
    const created: AdminClassRow = { id: demoId('c'), ...values }
    demoMutate('classes', DEMO_ADMINS_CLASSES, (all) => [created, ...all])
    await logDemo('academic.class_created', 'class', created.id, { name: created.name })
    return created
  }

  const client = db()
  const row = await one<AdminClassRow>(client!.from('classes').insert(values).select().single())
  if (!row) throw new Error('The class could not be created.')
  await logAction('academic.class_created', 'class', row.id, { name: row.name })
  return row
}

export async function updateClass(id: string, input: Partial<ClassInput>): Promise<void> {
  if (isDemo) {
    demoMutate('classes', DEMO_ADMINS_CLASSES, (all) =>
      all.map((row) => (row.id === id ? { ...row, ...input } : row)),
    )
    await logDemo('academic.class_updated', 'class', id, {})
    return
  }
  await writeRow('classes', input, id)
  await logAction('academic.class_updated', 'class', id, {})
}

export async function setClassArchived(id: string, archived: boolean): Promise<void> {
  if (isDemo) {
    demoMutate('classes', DEMO_ADMINS_CLASSES, (all) =>
      all.map((row) => (row.id === id ? { ...row, is_archived: archived } : row)),
    )
    await logDemo(archived ? 'academic.class_archived' : 'academic.class_restored', 'class', id, {})
    return
  }
  await archiveRow('classes', id, archived)
  await logAction(archived ? 'academic.class_archived' : 'academic.class_restored', 'class', id, {})
}

/* --------------------------------- streams -------------------------------- */

export async function listStreams(includeArchived = false): Promise<AdminStreamRow[]> {
  if (isDemo) return demoList('streams', DEMO_ADMINS_STREAMS, includeArchived)
  return readAll<AdminStreamRow>('streams', includeArchived)
}

export interface StreamInput {
  name: string
  description?: string
  display_order: number
}

export async function createStream(input: StreamInput): Promise<AdminStreamRow> {
  const values = {
    slug: slugify(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    display_order: input.display_order,
    is_archived: false,
  }

  if (isDemo) {
    const created: AdminStreamRow = { id: demoId('s'), ...values }
    demoMutate('streams', DEMO_ADMINS_STREAMS, (all) => [created, ...all])
    await logDemo('academic.stream_created', 'stream', created.id, { name: created.name })
    return created
  }

  const client = db()
  const row = await one<AdminStreamRow>(client!.from('streams').insert(values).select().single())
  if (!row) throw new Error('The stream could not be created.')
  await logAction('academic.stream_created', 'stream', row.id, { name: row.name })
  return row
}

export async function updateStream(id: string, input: Partial<StreamInput>): Promise<void> {
  if (isDemo) {
    demoMutate('streams', DEMO_ADMINS_STREAMS, (all) =>
      all.map((row) => (row.id === id ? { ...row, ...input } : row)),
    )
    await logDemo('academic.stream_updated', 'stream', id, {})
    return
  }
  await writeRow('streams', input, id)
  await logAction('academic.stream_updated', 'stream', id, {})
}

export async function setStreamArchived(id: string, archived: boolean): Promise<void> {
  if (isDemo) {
    demoMutate('streams', DEMO_ADMINS_STREAMS, (all) =>
      all.map((row) => (row.id === id ? { ...row, is_archived: archived } : row)),
    )
    await logDemo(archived ? 'academic.stream_archived' : 'academic.stream_restored', 'stream', id, {})
    return
  }
  await archiveRow('streams', id, archived)
  await logAction(archived ? 'academic.stream_archived' : 'academic.stream_restored', 'stream', id, {})
}

/* -------------------------------- subjects -------------------------------- */

export async function listSubjects(includeArchived = false): Promise<AdminSubjectRow[]> {
  if (isDemo) return demoList('subjects', DEMO_ADMINS_SUBJECTS, includeArchived)
  return readAll<AdminSubjectRow>('subjects', includeArchived)
}

export interface SubjectInput {
  name: string
  code?: string
  class_id: string
  board_id?: string | null
  stream_id?: string | null
  description?: string
  display_order: number
  is_archived?: boolean
}

export async function createSubject(input: SubjectInput): Promise<AdminSubjectRow> {
  const values = {
    slug: slugify(input.name),
    name: input.name.trim(),
    code: input.code?.trim().toUpperCase() || null,
    class_id: input.class_id,
    board_id: input.board_id || null,
    stream_id: input.stream_id || null,
    description: input.description?.trim() || null,
    display_order: input.display_order,
    is_archived: input.is_archived ?? false,
  }

  if (isDemo) {
    const created: AdminSubjectRow = { id: demoId('sub'), ...values }
    demoMutate('subjects', DEMO_ADMINS_SUBJECTS, (all) => [created, ...all])
    await logDemo('academic.subject_created', 'subject', created.id, { name: created.name })
    return created
  }

  const client = db()
  const row = await one<AdminSubjectRow>(client!.from('subjects').insert(values).select().single())
  if (!row) throw new Error('The subject could not be created.')
  await logAction('academic.subject_created', 'subject', row.id, { name: row.name })
  return row
}

export async function updateSubject(id: string, input: Partial<SubjectInput>): Promise<void> {
  if (isDemo) {
    demoMutate('subjects', DEMO_ADMINS_SUBJECTS, (all) =>
      all.map((row) => (row.id === id ? { ...row, ...input } : row)),
    )
    await logDemo('academic.subject_updated', 'subject', id, {})
    return
  }
  await writeRow('subjects', input, id)
  await logAction('academic.subject_updated', 'subject', id, {})
}

export async function setSubjectArchived(id: string, archived: boolean): Promise<void> {
  if (isDemo) {
    demoMutate('subjects', DEMO_ADMINS_SUBJECTS, (all) =>
      all.map((row) => (row.id === id ? { ...row, is_archived: archived } : row)),
    )
    await logDemo(archived ? 'academic.subject_archived' : 'academic.subject_restored', 'subject', id, {})
    return
  }
  await archiveRow('subjects', id, archived)
  await logAction(archived ? 'academic.subject_archived' : 'academic.subject_restored', 'subject', id, {})
}

/* -------------------------------- chapters -------------------------------- */

export async function listChapters(includeArchived = false): Promise<AdminChapterRow[]> {
  if (isDemo) return demoList('chapters', DEMO_ADMINS_CHAPTERS, includeArchived)
  return readAll<AdminChapterRow>('chapters', includeArchived)
}

export interface ChapterInput {
  name: string
  chapter_number: number
  subject_id: string
  description?: string
  display_order: number
  difficulty?: string | null
  estimated_minutes?: number | null
  topics?: string[]
  is_archived?: boolean
}

export async function createChapter(input: ChapterInput): Promise<AdminChapterRow> {
  const values = {
    subject_id: input.subject_id,
    slug: slugify(input.name),
    name: input.name.trim(),
    chapter_number: input.chapter_number,
    description: input.description?.trim() || null,
    display_order: input.display_order,
    difficulty: input.difficulty || null,
    estimated_minutes: input.estimated_minutes || null,
    topics: input.topics ?? [],
    is_archived: input.is_archived ?? false,
  }

  if (isDemo) {
    const created: AdminChapterRow = { id: demoId('ch'), ...values }
    demoMutate('chapters', DEMO_ADMINS_CHAPTERS, (all) => [created, ...all])
    await logDemo('academic.chapter_created', 'chapter', created.id, { name: created.name })
    return created
  }

  const client = db()
  const row = await one<AdminChapterRow>(client!.from('chapters').insert(values).select().single())
  if (!row) throw new Error('The chapter could not be created.')
  await logAction('academic.chapter_created', 'chapter', row.id, { name: row.name })
  return row
}

export async function updateChapter(id: string, input: Partial<ChapterInput>): Promise<void> {
  if (isDemo) {
    demoMutate('chapters', DEMO_ADMINS_CHAPTERS, (all) =>
      all.map((row) => (row.id === id ? { ...row, ...input } : row)),
    )
    await logDemo('academic.chapter_updated', 'chapter', id, {})
    return
  }
  await writeRow('chapters', input, id)
  await logAction('academic.chapter_updated', 'chapter', id, {})
}

export async function setChapterArchived(id: string, archived: boolean): Promise<void> {
  if (isDemo) {
    demoMutate('chapters', DEMO_ADMINS_CHAPTERS, (all) =>
      all.map((row) => (row.id === id ? { ...row, is_archived: archived } : row)),
    )
    await logDemo(archived ? 'academic.chapter_archived' : 'academic.chapter_restored', 'chapter', id, {})
    return
  }
  await archiveRow('chapters', id, archived)
  await logAction(archived ? 'academic.chapter_archived' : 'academic.chapter_restored', 'chapter', id, {})
}

/**
 * Persist a new display order for a set of rows (drag-reorder / move up-down).
 * Written as one update per row rather than a single RPC so the database stays
 * the only authority on ordering.
 */
export async function reorderRows(
  table: 'boards' | 'classes' | 'streams' | 'subjects' | 'chapters',
  orderedIds: string[],
): Promise<void> {
  if (isDemo) {
    const key = table
    const seed =
      table === 'boards'
        ? DEMO_ADMINS_BOARDS
        : table === 'classes'
          ? DEMO_ADMINS_CLASSES
          : table === 'streams'
            ? DEMO_ADMINS_STREAMS
            : table === 'subjects'
              ? DEMO_ADMINS_SUBJECTS
              : DEMO_ADMINS_CHAPTERS

    demoMutate(key, seed as never, (all) =>
      (all as unknown as { id: string }[]).map((row) => {
        const index = orderedIds.indexOf(row.id)
        return index === -1 ? row : { ...row, display_order: index + 1 }
      }),
    ) as never
    await logDemo('academic.reordered', table, null, { count: orderedIds.length })
    return
  }

  const client = db()
  if (!client) return
  for (const [index, id] of orderedIds.entries()) {
    await mutate(client.from(table).update({ display_order: index + 1 }).eq('id', id))
  }
  await logAction('academic.reordered', table, null, { count: orderedIds.length })
}

/* -------------------------------- audit log ------------------------------- */
/* Imported lazily to avoid a cycle: adminContent/adminUsers also write here.  */

import { logAdminAction, logAdminActionDemo } from './adminAudit.service'

async function logAction(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  await logAdminAction(action, entityType, entityId, metadata)
}

async function logDemo(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  await logAdminActionDemo(action, entityType, entityId, metadata)
}
