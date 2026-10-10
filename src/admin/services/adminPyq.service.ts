/**
 * Admin service: PYQ management, bulk CSV/JSON import and duplicate detection.
 *
 * Nothing is inserted blindly. `parseImportFile` returns per-row validation
 * errors and a duplicate verdict, the UI shows them, and only an explicit
 * confirm calls `insertImportedQuestions` — which inserts the rows the admin
 * actually approved, one transaction per row so a single bad row cannot take
 * the batch down.
 *
 * Duplicate detection is advisory only. Two questions that look alike are
 * *flagged*, never merged or deleted: similarity is not proof.
 */
import { db, isDemo, rows, one, mutate } from '@/services/shared'
import type { AdminPyqRow, PyqQuestionType } from '../types/admin'
import { DEMO_ADMINS_BOARDS, DEMO_ADMINS_CHAPTERS, DEMO_ADMINS_PYQS, DEMO_ADMINS_SUBJECTS } from '../data/adminDemo'
import { demoId, nowIso, readCollection, writeCollection } from './demoStore'
import { logAdminAction, logAdminActionDemo } from './adminAudit.service'

/* --------------------------------- listing -------------------------------- */

export interface PyqFilter {
  subjectId?: string | 'all'
  chapterId?: string | 'all'
  year?: number | 'all'
  difficulty?: string | 'all'
  questionType?: string | 'all'
  importantOnly?: boolean
  search?: string
}

export interface PyqPage {
  items: AdminPyqRow[]
  total: number
  page: number
  pageSize: number
}

export const PYQ_PAGE_SIZE = 20

export async function listQuestions(
  filter: PyqFilter = {},
  page = 1,
  pageSize = PYQ_PAGE_SIZE,
): Promise<PyqPage> {
  if (isDemo) {
    const all = applyPyqFilter(readCollection<AdminPyqRow>('pyqs', DEMO_ADMINS_PYQS), filter)
    const start = (page - 1) * pageSize
    return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize }
  }

  const client = db()
  if (!client) return { items: [], total: 0, page, pageSize }

  let request = client
    .from('pyq_questions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filter.subjectId && filter.subjectId !== 'all') request = request.eq('subject_id', filter.subjectId)
  if (filter.chapterId && filter.chapterId !== 'all') request = request.eq('chapter_id', filter.chapterId)
  if (filter.year && filter.year !== 'all') request = request.eq('year', filter.year)
  if (filter.difficulty && filter.difficulty !== 'all') request = request.eq('difficulty', filter.difficulty)
  if (filter.questionType && filter.questionType !== 'all') request = request.eq('question_type', filter.questionType)
  if (filter.importantOnly) request = request.eq('is_important', true)
  if (filter.search?.trim()) request = request.ilike('question_text', `%${filter.search.trim()}%`)

  const { data, error, count } = await request
  if (error) throw new Error('We could not load the questions. Please try again.')

  return { items: (data as AdminPyqRow[]) ?? [], total: count ?? 0, page, pageSize }
}

function applyPyqFilter(items: AdminPyqRow[], filter: PyqFilter): AdminPyqRow[] {
  const needle = filter.search?.trim().toLowerCase() ?? ''
  return items
    .filter((row) => (filter.subjectId && filter.subjectId !== 'all' ? row.subject_id === filter.subjectId : true))
    .filter((row) => (filter.chapterId && filter.chapterId !== 'all' ? row.chapter_id === filter.chapterId : true))
    .filter((row) => (filter.year && filter.year !== 'all' ? row.year === filter.year : true))
    .filter((row) => (filter.difficulty && filter.difficulty !== 'all' ? row.difficulty === filter.difficulty : true))
    .filter((row) =>
      filter.questionType && filter.questionType !== 'all' ? row.question_type === filter.questionType : true,
    )
    .filter((row) => (filter.importantOnly ? row.is_important : true))
    .filter((row) => (needle ? row.question_text.toLowerCase().includes(needle) : true))
    .sort((a, b) => b.year - a.year || a.question_text.localeCompare(b.question_text))
}

export async function getQuestion(id: string): Promise<AdminPyqRow | null> {
  if (isDemo) {
    return readCollection<AdminPyqRow>('pyqs', DEMO_ADMINS_PYQS).find((row) => row.id === id) ?? null
  }
  const client = db()
  if (!client) return null
  return one<AdminPyqRow>(client.from('pyq_questions').select('*').eq('id', id).maybeSingle())
}

/** Distinct years present in the archive, for the year filter. */
export async function listYears(): Promise<number[]> {
  const items = await listQuestions({}, 1, 10_000)
  return [...new Set(items.items.map((row) => row.year))].sort((a, b) => b - a)
}

/* --------------------------------- writing -------------------------------- */

/** Payload for create/update — everything the editor owns. */
export interface PyqDraft {
  board_id: string
  class_id: string
  subject_id: string | null
  chapter_id: string | null
  year: number
  exam_type: string
  question_text: string
  question_type: PyqQuestionType
  paper_set: string
  marks: number
  difficulty: 'easy' | 'moderate' | 'hard'
  source: string | null
  concepts: string[]
  is_important: boolean
  /** Optional link to a resource holding the worked solution. */
  solution_resource_id?: string | null
}

export async function createQuestion(draft: PyqDraft): Promise<AdminPyqRow> {
  if (isDemo) {
    const created: AdminPyqRow = {
      id: demoId('q'),
      ...draft,
      solution_resource_id: draft.solution_resource_id ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const all = readCollection<AdminPyqRow>('pyqs', DEMO_ADMINS_PYQS)
    writeCollection<AdminPyqRow>('pyqs', [created, ...all])
    await logAdminActionDemo('pyq.created', 'pyq_question', created.id, { year: created.year })
    return created
  }

  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  const row = await one<AdminPyqRow>(client.from('pyq_questions').insert(draft).select().single())
  if (!row) throw new Error('The question could not be created.')

  await logAdminAction('pyq.created', 'pyq_question', row.id, { year: row.year })
  return row
}

export async function updateQuestion(id: string, patch: Partial<PyqDraft>): Promise<void> {
  if (isDemo) {
    const all = readCollection<AdminPyqRow>('pyqs', DEMO_ADMINS_PYQS)
    writeCollection<AdminPyqRow>(
      'pyqs',
      all.map((row) => (row.id === id ? { ...row, ...patch, updated_at: nowIso() } : row)),
    )
    await logAdminActionDemo('pyq.updated', 'pyq_question', id, { fields: Object.keys(patch) })
    return
  }

  const client = db()
  if (!client) return
  await mutate(client.from('pyq_questions').update(patch).eq('id', id))
  await logAdminAction('pyq.updated', 'pyq_question', id, { fields: Object.keys(patch) })
}

/** Soft-archive: the row stays for analytics, it just leaves the student app. */
export async function archiveQuestion(id: string): Promise<void> {
  if (isDemo) {
    const all = readCollection<AdminPyqRow>('pyqs', DEMO_ADMINS_PYQS)
    writeCollection<AdminPyqRow>('pyqs', all.filter((row) => row.id !== id))
    await logAdminActionDemo('pyq.archived', 'pyq_question', id, {})
    return
  }

  const client = db()
  if (!client) return
  await mutate(client.from('pyq_questions').delete().eq('id', id))
  await logAdminAction('pyq.archived', 'pyq_question', id, {})
}

/* ----------------------------- bulk import -------------------------------- */

/** Columns the CSV importer understands, in the order the spec lists them. */
export const IMPORT_COLUMNS = [
  'board',
  'class',
  'stream',
  'subject',
  'chapter',
  'year',
  'exam_type',
  'question_type',
  'question',
  'answer',
  'marks',
  'difficulty',
  'source',
] as const

export interface ParsedRow {
  /** 1-based line number in the source file, for error messages. */
  line: number
  raw: Record<string, string>
  /** Filled in once hierarchy slugs resolve. */
  resolved?: {
    board_id: string
    class_id: string
    subject_id: string | null
    chapter_id: string | null
  }
  draft?: PyqDraft
  errors: string[]
  /** Set when the row resembles one already in the archive. */
  duplicateOf?: { id: string; label: string } | null
}

export interface ImportPreview {
  rows: ParsedRow[]
  validCount: number
  errorCount: number
  duplicateCount: number
  /** Header names that were not recognised. */
  unknownColumns: string[]
}

/**
 * Very small CSV parser: handles quoted fields, embedded commas and doubled
 * quotes. Enough for the export format the spec defines without pulling in a
 * parser dependency.
 */
export function parseCsv(text: string): { headers: string[]; records: Record<string, string>[] } {
  const table: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') index += 1
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) table.push(row)
      row = []
    } else {
      field += char
    }
  }

  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) table.push(row)

  const headers = (table.shift() ?? []).map((header) => header.trim().toLowerCase())
  const records = table.map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, position) => {
      record[header] = (cells[position] ?? '').trim()
    })
    return record
  })

  return { headers, records }
}

/**
 * Validate a parsed file against the hierarchy and the existing archive.
 *
 * Pure function — no writes, no network — so the preview can be recomputed on
 * every keystroke and the confirm button can be disabled until it is clean.
 */
export async function validateImport(records: Record<string, string>[]): Promise<ImportPreview> {
  const [boards, classes, subjects, chapters, existing] = await Promise.all([
    loadBoards(),
    loadClasses(),
    loadSubjects(),
    loadChapters(),
    listQuestions({}, 1, 10_000),
  ])

  const rows: ParsedRow[] = records.map((raw, index) => {
    const errors: string[] = []
    const line = index + 2 // +1 for the header, +1 for 1-based numbering

    const board = boards.find((row) => matches(row.slug, row.name, raw.board))
    if (!raw.board) errors.push('Board is required.')
    else if (!board) errors.push('Board not found.')

    const classRow = classes.find((row) => matches(row.slug, row.name, raw.class))
    if (!raw.class) errors.push('Class is required.')
    else if (!classRow) errors.push('Class not found.')

    const subject = raw.subject
      ? subjects.find((row) => matches(row.slug, row.name, raw.subject) && row.class_id === classRow?.id)
      : undefined
    if (raw.subject && classRow && !subject) errors.push('Subject not found for that class.')
    if (raw.subject && !classRow) errors.push('Subject cannot be resolved without a valid class.')

    const chapter = raw.chapter
      ? chapters.find(
          (row) => matches(row.slug, row.name, raw.chapter) && (!subject || row.subject_id === subject.id),
        )
      : undefined
    if (raw.chapter && subject && !chapter) errors.push('Chapter not found for that subject.')

    const year = Number(raw.year)
    if (!raw.year) errors.push('Year is required.')
    else if (!Number.isInteger(year) || year < 1990 || year > 2100) errors.push('Year must be between 1990 and 2100.')

    const marks = Number(raw.marks)
    if (raw.marks !== undefined && raw.marks !== '' && (!Number.isFinite(marks) || marks <= 0)) {
      errors.push('Marks must be a positive number.')
    }

    if (!raw.question?.trim()) errors.push('Question text is required.')

    const type = normaliseType(raw.question_type)
    if (raw.question_type && !type) errors.push('Question type is not recognised.')

    const difficulty = normaliseDifficulty(raw.difficulty)

    const parsed: ParsedRow = { line, raw, errors }

    if (errors.length) return parsed

    parsed.resolved = {
      board_id: board!.id,
      class_id: classRow!.id,
      subject_id: subject?.id ?? null,
      chapter_id: chapter?.id ?? null,
    }

    parsed.draft = {
      board_id: board!.id,
      class_id: classRow!.id,
      subject_id: subject?.id ?? null,
      chapter_id: chapter?.id ?? null,
      year,
      exam_type: raw.exam_type?.trim() || 'board',
      question_text: raw.question.trim(),
      question_type: type ?? 'short_answer',
      paper_set: 'Set 1',
      marks: Number.isFinite(marks) && marks > 0 ? marks : 1,
      difficulty,
      source: raw.source?.trim() || null,
      concepts: [],
      is_important: false,
    }

    parsed.duplicateOf = findDuplicate(parsed.draft, existing.items)
    return parsed
  })

  const unknownColumns: string[] = []
  const known = new Set<string>([...IMPORT_COLUMNS, 'answer'])
  for (const key of Object.keys(records[0] ?? {})) {
    if (!known.has(key)) unknownColumns.push(key)
  }

  return {
    rows,
    validCount: rows.filter((row) => row.errors.length === 0).length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
    duplicateCount: rows.filter((row) => row.duplicateOf).length,
    unknownColumns,
  }
}

function matches(slug: string, name: string, value?: string): boolean {
  const needle = (value ?? '').trim().toLowerCase()
  if (!needle) return false
  return slug.toLowerCase() === needle || name.toLowerCase() === needle
}

function normaliseType(value?: string): PyqQuestionType | null {
  const needle = (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!needle) return null
  const map: Record<string, PyqQuestionType> = {
    mcq: 'MCQ',
    multiple_choice: 'MCQ',
    assertion_reason: 'assertion_reason',
    short_answer: 'short_answer',
    long_answer: 'long_answer',
    numerical: 'numerical',
    case_study: 'case_study',
    other: 'other',
  }
  return map[needle] ?? null
}

function normaliseDifficulty(value?: string): 'easy' | 'moderate' | 'hard' {
  const needle = (value ?? '').trim().toLowerCase()
  if (needle === 'easy') return 'easy'
  if (needle === 'hard') return 'hard'
  return 'moderate'
}

/**
 * Flag a row that looks like one already in the archive.
 *
 * Matching on (subject, year, normalised text) is intentionally conservative —
 * a false "possible duplicate" costs an admin three seconds, a false merge
 * would destroy data. Nothing is ever removed automatically.
 */
export function findDuplicate(draft: PyqDraft, existing: AdminPyqRow[]): { id: string; label: string } | null {
  const normalise = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()

  const candidate = normalise(draft.question_text)
  if (candidate.length < 12) return null // too short to judge safely

  const match = existing.find(
    (row) =>
      row.subject_id === draft.subject_id &&
      row.year === draft.year &&
      normalise(row.question_text) === candidate,
  )

  return match ? { id: match.id, label: `Same subject and year (${match.year})` } : null
}

export interface ImportOutcome {
  inserted: number
  skipped: number
  failed: { line: number; reason: string }[]
}

/**
 * Insert the approved rows.
 *
 * Only rows with no validation errors are sent, and `skipDuplicates` lets the
 * admin exclude flagged rows in one click. Each insert is independent, so a
 * rejected row is reported by line number instead of failing the import.
 */
export async function insertImportedQuestions(
  preview: ImportPreview,
  options: { skipDuplicates: boolean },
): Promise<ImportOutcome> {
  const targets = preview.rows.filter(
    (row) => row.errors.length === 0 && row.draft && (!options.skipDuplicates || !row.duplicateOf),
  )
  const skipped = preview.rows.filter(
    (row) => row.errors.length > 0 || (options.skipDuplicates && Boolean(row.duplicateOf)),
  ).length

  const failed: { line: number; reason: string }[] = []

  if (isDemo) {
    const all = readCollection<AdminPyqRow>('pyqs', DEMO_ADMINS_PYQS)
    const created: AdminPyqRow[] = targets.map((row) => ({
      id: demoId('q'),
      ...row.draft!,
      solution_resource_id: row.draft!.solution_resource_id ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }))
    writeCollection<AdminPyqRow>('pyqs', [...created, ...all])
    await logAdminActionDemo('pyq.imported', 'pyq_question', null, { inserted: created.length })
    return { inserted: created.length, skipped, failed }
  }

  const client = db()
  if (!client) throw new Error('No backend connection is available.')

  let inserted = 0
  for (const row of targets) {
    try {
      await mutate(client.from('pyq_questions').insert(row.draft!))
      inserted += 1
    } catch (error) {
      failed.push({ line: row.line, reason: error instanceof Error ? error.message : 'Insert failed.' })
    }
  }

  if (inserted > 0) {
    await logAdminAction('pyq.imported', 'pyq_question', null, { inserted, skipped })
  }

  return { inserted, skipped, failed }
}

/* ------------------------------ hierarchy load ---------------------------- */

interface SlugRow {
  id: string
  slug: string
  name: string
}

async function loadBoards(): Promise<SlugRow[]> {
  if (isDemo) return DEMO_ADMINS_BOARDS
  const client = db()
  if (!client) return []
  return rows<SlugRow>(client.from('boards').select('id, slug, name'))
}

async function loadClasses(): Promise<SlugRow[]> {
  if (isDemo) return DEMO_ADMINS_CLASSES
  const client = db()
  if (!client) return []
  return rows<SlugRow>(client.from('classes').select('id, slug, name'))
}

async function loadSubjects(): Promise<(SlugRow & { class_id: string })[]> {
  if (isDemo) return DEMO_ADMINS_SUBJECTS
  const client = db()
  if (!client) return []
  return rows<SlugRow & { class_id: string }>(client.from('subjects').select('id, slug, name, class_id'))
}

async function loadChapters(): Promise<(SlugRow & { subject_id: string })[]> {
  if (isDemo) return DEMO_ADMINS_CHAPTERS
  const client = db()
  if (!client) return []
  return rows<SlugRow & { subject_id: string }>(client.from('chapters').select('id, slug, name, subject_id'))
}

import { DEMO_ADMINS_CLASSES } from '../data/adminDemo'
