/**
 * Note generation: prompt → model → validate → repair → persist.
 *
 * The pipeline is deliberately unskippable (spec §34–§38):
 *
 *   1. build the context from the *database* (board, class, subject, chapter,
 *      syllabus topics) — never from what a page happens to say;
 *   2. build the prompt from `prompts.ts`, which is versioned so a regeneration
 *      can be told apart from an original;
 *   3. ask the model for structured JSON only;
 *   4. `validateNote()` — coverage, duplicates, contradictions, class
 *      appropriateness, structure;
 *   5. repair *only* the sections validation flagged, then re-validate;
 *   6. persist sections + items + validation + provenance;
 *   7. leave the note in `needs_review`. Nothing here publishes.
 *
 * Chapter failures are isolated: every error is caught by the caller and
 * turned into a job failure for that chapter alone.
 */
import { extractJson } from '../ai/providers/provider.interface.ts'
import type { AiProvider } from '../ai/providers/provider.interface.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  PROMPT_VERSION,
  promptFor,
  type GenerationContext,
} from '../../../../src/content-engine/prompts.ts'
import {
  countWords,
  repairTargets,
  validateNote,
  type ValidationSection,
} from '../../../../src/content-engine/validation.ts'
import type { DepthLevel, NoteType } from '../../../../src/content-engine/types.ts'

/** The exact document shape the model is asked to return. */
export interface ModelNoteDocument {
  title?: string
  sections: Array<{
    key?: string
    heading: string
    summary?: string
    items: Array<{ type?: string; body: string }>
  }>
}

export interface GenerateNoteInput {
  chapter: {
    id: string
    name: string
    board_id: string | null
    class_id: string | null
    subject_id: string | null
    boardName: string
    className: string
    subjectName: string
    topics: string[]
  }
  noteType: NoteType
  depth: DepthLevel
  academicSession: string
  jobId?: string | null
  userId?: string | null
}

export interface GenerateNoteOutput {
  noteId: string
  qualityScore: number
  qualityGrade: string
  wordCount: number
  repaired: string[]
  passed: boolean
}

/** `sections` as validation wants them, from either source shape. */
function asValidationSections(document: ModelNoteDocument): ValidationSection[] {
  return (document.sections ?? []).map((section, index) => ({
    key: section.key ?? section.heading ?? `section-${index}`,
    heading: section.heading ?? '',
    items: (section.items ?? []).map((item) => ({
      type: item.type ?? 'paragraph',
      body: item.body ?? '',
    })),
  }))
}

function normaliseDocument(document: ModelNoteDocument): ModelNoteDocument {
  return {
    title: document.title,
    sections: (document.sections ?? []).map((section, index) => ({
      key: section.key ?? slugOf(section.heading) || `section-${index + 1}`,
      heading: section.heading,
      summary: section.summary,
      items: (section.items ?? [])
        .filter((item) => typeof item.body === 'string' && item.body.trim().length > 0)
        .map((item) => ({ type: item.type ?? 'paragraph', body: item.body.trim() })),
    })).filter((section) => section.items.length > 0),
  }
}

function slugOf(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function askForDocument(
  provider: AiProvider,
  system: string,
  user: string,
  json: boolean,
): Promise<ModelNoteDocument> {
  const result = await provider.generateText({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    json,
    temperature: 0.3,
    maxTokens: 6000,
  })
  return extractJson<ModelNoteDocument>(result.text)
}

/**
 * Generate one note end to end and write it out.
 *
 * Returns the new note id; the caller owns the job row (progress, failure).
 */
export async function generateNote(
  sb: SupabaseClient,
  provider: AiProvider,
  input: GenerateNoteInput,
): Promise<GenerateNoteOutput> {
  const context: GenerationContext = {
    boardName: input.chapter.boardName,
    academicSession: input.academicSession,
    className: input.chapter.className,
    subjectName: input.chapter.subjectName,
    chapterName: input.chapter.name,
    topics: input.chapter.topics,
    depth: input.depth,
    noteType: input.noteType,
  }

  const system = promptFor(input.noteType, context)
  const user = [
    `Write the ${input.noteType} material for "${input.chapter.name}".`,
    `Return JSON with this shape: {"title": string, "sections": [{"key": string, "heading": string, "summary"?: string, "items": [{"type": "paragraph|definition|formula|derivation|example|reaction|table|tip|warning|question|answer|diagram|heading", "body": string}]}]}.`,
    'Use "table" rows as `a | b | c` lines and multiple paragraphs separated by a blank line.',
    input.chapter.topics.length ? `Cover these syllabus topics: ${input.chapter.topics.join(', ')}.` : '',
    'If you are not certain of a fact, write "not verified" instead of guessing.',
  ].filter(Boolean).join('\n')

  let document = normaliseDocument(await askForDocument(provider, system, user, true))
  if (document.sections.length === 0) {
    throw new Error('The model returned an empty document.')
  }

  /* ---- 4. validate ---- */
  let sections = asValidationSections(document)
  let report = validateNote({
    entity_type: 'note',
    entity_id: 'pending',
    sections,
    expectedTopics: input.chapter.topics,
    className: input.chapter.className,
    depth: input.depth,
  })

  /* ---- 5. targeted repair (only the flagged sections) ---- */
  const repaired: string[] = []
  const targets = repairTargets(report, sections)
  if (targets.length > 0) {
    const targetSections = sections.filter((section) => targets.includes(section.key))
    const repairPrompt = [
      'Rewrite ONLY the sections listed below so they fix these problems:',
      ...report.errors.concat(report.warnings).map((issue) => `- ${issue.label}${issue.detail ? `: ${issue.detail}` : ''}`),
      ...(report.coverage.missing.length
        ? [`Also make sure these syllabus topics are addressed: ${report.coverage.missing.join(', ')}.`]
        : []),
      '',
      'Return the FULL document again with the same shape, keeping sections that were fine exactly as they were.',
      '',
      'SECTIONS TO FIX:',
      ...targetSections.map((section) => `## ${section.heading}\n${section.items.map((item) => item.body).join('\n')}`),
    ].join('\n')

    try {
      const repairedDocument = normaliseDocument(
        await askForDocument(provider, `You are repairing study material. ${system}`, repairPrompt, true),
      )
      if (repairedDocument.sections.length > 0) {
        document = mergeSections(document, repairedDocument, targets)
        sections = asValidationSections(document)
        report = validateNote({
          entity_type: 'note',
          entity_id: 'pending',
          sections,
          expectedTopics: input.chapter.topics,
          className: input.chapter.className,
          depth: input.depth,
        })
        repaired.push(...targets)
      }
    } catch {
      /* A failed repair is not a failed note — the original stands and the
         validation report explains what a reviewer should look at. */
    }
  }

  /* ---- 6. persist ---- */
  const wordCount = countWords(sections)
  const title = document.title?.trim() || `${input.chapter.name} — ${titleFor(input.noteType)}`

  const { data: noteRow, error: noteError } = await sb
    .from('generated_notes')
    .insert({
      chapter_id: input.chapter.id,
      board_id: input.chapter.board_id,
      class_id: input.chapter.class_id,
      subject_id: input.chapter.subject_id,
      academic_session: input.academicSession,
      note_type: input.noteType,
      depth: input.depth,
      title,
      status: report.passed ? 'needs_review' : 'validation_failed',
      quality_score: report.quality_score,
      quality_grade: report.quality_grade,
      word_count: wordCount,
      generation_source: 'ai',
      source_references: [],
      generation_model: provider.model,
      prompt_version: PROMPT_VERSION,
      generation_version: 1,
      content_hash: await hashOf(title + JSON.stringify(document.sections)),
      job_id: input.jobId ?? null,
      created_by: input.userId ?? null,
    })
    .select('id')
    .single()

  if (noteError || !noteRow) {
    throw new Error(`Could not save the generated note: ${noteError?.message ?? 'unknown error'}`)
  }
  const noteId = noteRow.id as string

  /* Sections must be inserted before their items (FK). */
  const sectionRows: Array<{ id: string; section_key: string }> = []
  for (const [index, section] of document.sections.entries()) {
    const { data: sectionRow, error: sectionError } = await sb
      .from('note_sections')
      .insert({
        note_id: noteId,
        section_key: section.key ?? `section-${index + 1}`,
        position: index,
        heading: section.heading,
        summary: section.summary ?? null,
      })
      .select('id, section_key')
      .single()
    if (sectionError || !sectionRow) {
      throw new Error(`Could not save section "${section.heading}".`)
    }
    sectionRows.push({ id: sectionRow.id as string, section_key: sectionRow.section_key as string })
  }

  const itemRows = document.sections.flatMap((section, sectionIndex) => {
    const parent = sectionRows[sectionIndex]
    if (!parent) return []
    return section.items.map((item, itemIndex) => ({
      section_id: parent.id,
      position: itemIndex,
      item_type: item.type ?? 'paragraph',
      body: item.body,
      meta: {},
    }))
  })
  if (itemRows.length > 0) {
    const { error: itemError } = await sb.from('note_items').insert(itemRows)
    if (itemError) throw new Error(`Could not save the note body: ${itemError.message}`)
  }

  const { error: validationError } = await sb.from('content_validation_results').insert({
    entity_type: 'note',
    entity_id: noteId,
    job_id: input.jobId ?? null,
    checks_run: report.checks_run,
    quality_score: report.quality_score,
    quality_grade: report.quality_grade,
    passed: report.passed,
    warnings: report.warnings,
    errors: report.errors,
    coverage: report.coverage,
    repair_attempts: repaired.length ? 1 : 0,
    repaired_targets: repaired,
  })
  if (validationError) {
    /* Non-fatal: the note still exists, the report simply will not render. */
    console.warn('[content-engine] validation save failed', validationError.message)
  }

  return {
    noteId,
    qualityScore: report.quality_score,
    qualityGrade: report.quality_grade,
    wordCount,
    repaired,
    passed: report.passed,
  }
}

/** Keeps untouched sections byte-identical and swaps in repaired ones. */
function mergeSections(
  original: ModelNoteDocument,
  repairedDoc: ModelNoteDocument,
  targets: string[],
): ModelNoteDocument {
  const repairedByKey = new Map(
    repairedDoc.sections.map((section) => [slugOf(section.key ?? section.heading), section]),
  )
  return {
    title: repairedDoc.title ?? original.title,
    sections: original.sections.map((section) => {
      const key = slugOf(section.key ?? section.heading)
      return targets.includes(key) ? (repairedByKey.get(key) ?? section) : section
    }),
  }
}

function titleFor(noteType: NoteType): string {
  const map: Record<NoteType, string> = {
    notes: 'Notes',
    quick_revision: 'Quick Revision',
    formula_sheet: 'Formula Sheet',
    important_concepts: 'Important Concepts',
    common_mistakes: 'Common Mistakes',
    practice_questions: 'Practice Questions',
    flashcards: 'Flashcards',
    quiz: 'Quiz',
    sample_paper: 'Sample Paper',
  }
  return map[noteType] ?? 'Notes'
}

async function hashOf(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
