/**
 * JSON bulk import for PYQs.
 *
 * The CSV path reuses `parseCsv` + `validateImport` from the PYQ service. JSON
 * needs its own reader because an export is usually an array of objects with
 * human-readable keys (or the snake_case column names), and a malformed file
 * must fail loudly with a line-equivalent reference rather than silently
 * importing nothing.
 *
 * Validation, duplicate detection and the actual write all go through the same
 * functions as CSV, so both formats are checked identically — there is no
 * second, weaker code path.
 */
import {
  insertImportedQuestions,
  validateImport,
  type ImportPreview,
} from './adminPyq.service'
import { IMPORT_COLUMNS } from './adminPyq.service'

/** Shape the import screen renders after a JSON parse. */
export interface JsonImportOutcome {
  added: number
  skipped: number
  failed: number
}

export interface JsonImportResult {
  preview: ImportPreview
  outcome: JsonImportOutcome
}

/**
 * Aliases accepted for each logical column, so an export produced by another
 * tool still lands in the right field without hand-editing.
 */
const KEY_ALIASES: Record<string, string[]> = {
  board: ['board', 'board_name', 'boardname'],
  class: ['class', 'class_name', 'classname', 'grade'],
  stream: ['stream', 'stream_name'],
  subject: ['subject', 'subject_name'],
  chapter: ['chapter', 'chapter_name'],
  year: ['year', 'exam_year'],
  exam_type: ['exam_type', 'examtype', 'exam'],
  question_type: ['question_type', 'type', 'qtype'],
  question: ['question', 'question_text', 'text', 'prompt'],
  answer: ['answer', 'solution', 'answer_text'],
  marks: ['marks', 'mark', 'total_marks'],
  difficulty: ['difficulty', 'level'],
  source: ['source', 'reference', 'origin'],
}

/** Normalise a key: lowercase, strip everything but letters and digits. */
function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, '')
}

/** Map one JSON object onto the flat record `validateImport` expects. */
function normaliseRecord(raw: Record<string, unknown>, index: number): Record<string, string> {
  const record: Record<string, string> = {}

  for (const [column, aliases] of Object.entries(KEY_ALIASES)) {
    for (const alias of aliases) {
      const match = Object.keys(raw).find((key) => canonicalKey(key) === canonicalKey(alias))
      if (!match) continue
      const value = raw[match]
      record[column] = value == null ? '' : String(value).trim()
      break
    }
  }

  /* An object with none of the known keys is almost certainly the wrong file. */
  if (Object.keys(record).length === 0 && Object.keys(raw).length > 0) {
    throw new Error(
      `Row ${index + 1} has no recognised columns. Expected fields like ${IMPORT_COLUMNS.slice(0, 4).join(', ')}.`,
    )
  }

  return record
}

/**
 * Parse and validate a JSON export without writing anything.
 *
 * Accepts either a bare array, or `{ questions: [...] }` / `{ data: [...] }`.
 * Throws with a row reference when the structure is unusable, so the caller can
 * show a precise message instead of an empty table.
 */
export async function importPyqJson(text: string): Promise<JsonImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON. Check it and try again.')
  }

  /* Unwrap the common wrapper objects. */
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'questions' in (parsed as Record<string, unknown>)
      ? (parsed as { questions: unknown }).questions
      : parsed && typeof parsed === 'object' && 'data' in (parsed as Record<string, unknown>)
        ? (parsed as { data: unknown }).data
        : null

  if (!Array.isArray(list)) {
    throw new Error('Expected an array of questions, or an object with a "questions" array.')
  }

  if (list.length === 0) {
    throw new Error('That file contains no questions.')
  }

  const records = list.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Row ${index + 1} is not an object.`)
    }
    return normaliseRecord(entry as Record<string, unknown>, index)
  })

  const preview = await validateImport(records)

  /* An import that has already been applied reports its own totals. */
  const outcome: JsonImportOutcome = {
    added: preview.validCount,
    skipped: preview.errorCount + preview.duplicateCount,
    failed: preview.errorCount,
  }

  return { preview, outcome }
}

export { insertImportedQuestions }
