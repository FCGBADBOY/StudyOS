/**
 * Subject-aware, class-aware, board-aware prompt construction.
 *
 * This module is the difference between "an AI summary" and "notes a student
 * would actually revise from" (spec §10–§14):
 *
 *   - the *section structure* differs per subject (a Chemistry note carries
 *     reagents and name reactions; a Physics note carries derivations);
 *   - the *framing* differs per class (Class 8 foundational → Class 12
 *     advanced + derivations) so one generic note is never copied across
 *     classes;
 *   - the *scope* is the official syllabus for that board/session, not the
 *     whole textbook.
 *
 * Output is always ORIGINAL explanatory material synthesised from the syllabus
 * and approved sources — never a rewrite of a copyrighted chapter (spec §19).
 *
 * Pure: strings and data only, shared by the browser (to preview what will be
 * generated) and the worker (to actually generate).
 */
import type { DepthLevel, NoteType } from './types'
import { DEPTH_DESCRIPTIONS } from './types'

/** Bump whenever the prompts change — stored on every generated note. */
export const PROMPT_VERSION = 'ce-notes-v1'

/** Generated questions are never presented as real past papers. */
export const AI_PRACTICE_LABEL = 'AI-GENERATED PRACTICE'

/* -------------------------------------------------------------------------- */
/* Subject classification                                                     */
/* -------------------------------------------------------------------------- */

export type SubjectKind =
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'computer_science'
  | 'english'
  | 'general'

const SUBJECT_ALIASES: Array<{ kind: SubjectKind; test: RegExp }> = [
  { kind: 'physics', test: /\bphysics\b/i },
  { kind: 'chemistry', test: /\bchem\b|chemistry|organic chem|inorganic chem/i },
  { kind: 'mathematics', test: /\bmath|mathematics|maths\b|algebra|calculus|geometry/i },
  { kind: 'computer_science', test: /computer|informatics|\bit\b|\bcs\b|programming|software/i },
  { kind: 'english', test: /\benglish\b|literature|prose|poetry/i },
]

/** Classify a subject from its name/slug/code. Falls back to `general`. */
export function classifySubject(input: { name?: string; slug?: string; code?: string } | null | undefined): SubjectKind {
  const haystack = [input?.name, input?.slug, input?.code].filter(Boolean).join(' ')
  if (!haystack.trim()) return 'general'
  for (const entry of SUBJECT_ALIASES) {
    if (entry.test.test(haystack)) return entry.kind
  }
  return 'general'
}

/* -------------------------------------------------------------------------- */
/* Section structures (spec §11)                                              */
/* -------------------------------------------------------------------------- */

export interface SectionSpec {
  key: string
  heading: string
  /** What the model must produce in this section — never a vague "write more". */
  instruction: string
}

const PHYSICS_SECTIONS: SectionSpec[] = [
  { key: 'concept', heading: 'Concept', instruction: 'State the idea in plain language before any mathematics.' },
  { key: 'definition', heading: 'Definitions', instruction: 'Give each term exactly as the syllabus words it.' },
  { key: 'explanation', heading: 'Explanation', instruction: 'Build the reasoning step by step; name the assumptions.' },
  { key: 'formula', heading: 'Formulas', instruction: 'List every formula with its symbols and SI units.' },
  { key: 'derivation', heading: 'Derivation', instruction: 'Derive where the syllabus expects it; show each step.' },
  { key: 'diagram', heading: 'Diagram', instruction: 'Describe an original, clearly labelled diagram — do not reproduce a textbook figure.' },
  { key: 'example', heading: 'Worked Example', instruction: 'One fully solved numerical with units carried through.' },
  { key: 'common_mistakes', heading: 'Common Mistakes', instruction: 'Errors students actually make in this chapter.' },
  { key: 'exam_tips', heading: 'Exam Tips', instruction: 'How this chapter has been asked — command words, mark splits.' },
  { key: 'quick_revision', heading: 'Quick Revision', instruction: 'A ten-line recap a student can read the night before the exam.' },
]

const CHEMISTRY_SECTIONS: SectionSpec[] = [
  { key: 'concept', heading: 'Concept', instruction: 'The idea in plain language.' },
  { key: 'definition', heading: 'Definitions', instruction: 'IUPAC-precise wording where it matters.' },
  { key: 'reactions', heading: 'Reactions', instruction: 'Balanced equations with conditions; use the reaction block format.' },
  { key: 'reagents', heading: 'Reagents & Conditions', instruction: 'What each reagent does and the conditions required.' },
  { key: 'mechanism', heading: 'Mechanism', instruction: 'Only where the syllabus asks for it; show electron movement in words.' },
  { key: 'name_reactions', heading: 'Name Reactions', instruction: 'Name, equation, and the condition that makes it happen.' },
  { key: 'exceptions', heading: 'Exceptions', instruction: 'The exceptions examiners deliberately test.' },
  { key: 'conversions', heading: 'Conversions', instruction: 'Two or three conversion chains with reagents in order.' },
  { key: 'common_mistakes', heading: 'Common Mistakes', instruction: 'Misremembered reagents, wrong conditions, sign errors.' },
  { key: 'quick_revision', heading: 'Quick Revision', instruction: 'Reactions and definitions to read the night before.' },
]

const MATHS_SECTIONS: SectionSpec[] = [
  { key: 'concept', heading: 'Concept', instruction: 'What the topic actually is, without jargon.' },
  { key: 'formula', heading: 'Formulas', instruction: 'Every formula with the condition under which it holds.' },
  { key: 'conditions', heading: 'Conditions & Domains', instruction: 'Validity conditions, domains, restrictions.' },
  { key: 'method', heading: 'Method', instruction: 'The repeatable procedure, numbered.' },
  { key: 'example', heading: 'Solved Example', instruction: 'One complete solution with each step justified.' },
  { key: 'common_mistakes', heading: 'Common Mistakes', instruction: 'Where marks are routinely lost.' },
  { key: 'practice', heading: 'Practice Questions', instruction: 'Graded questions with answers kept separate.' },
  { key: 'quick_revision', heading: 'Quick Revision', instruction: 'Formulas and method steps only.' },
]

const CS_SECTIONS: SectionSpec[] = [
  { key: 'concept', heading: 'Concept', instruction: 'The idea and where it is used.' },
  { key: 'syntax', heading: 'Syntax', instruction: 'Exact syntax or notation as the syllabus specifies.' },
  { key: 'example', heading: 'Example', instruction: 'A short, runnable example.' },
  { key: 'output', heading: 'Output', instruction: 'The literal output of the example.' },
  { key: 'common_errors', heading: 'Common Errors', instruction: 'Compile/logic errors students hit here.' },
  { key: 'practice', heading: 'Practice', instruction: 'Exercises that build on each other.' },
  { key: 'quick_revision', heading: 'Quick Revision', instruction: 'Syntax and definitions to memorise.' },
]

const ENGLISH_SECTIONS: SectionSpec[] = [
  { key: 'concept', heading: 'Overview', instruction: 'What this text/topic is about.' },
  { key: 'definition', heading: 'Key Terms', instruction: 'Literary and grammatical terms used in the syllabus.' },
  { key: 'explanation', heading: 'Explanation', instruction: 'Line-by-line sense of the passage or form.' },
  { key: 'devices', heading: 'Literary Devices', instruction: 'Devices actually present, with the line that shows each.' },
  { key: 'theme', heading: 'Themes', instruction: 'Themes with supporting moments.' },
  { key: 'example', heading: 'Model Answer', instruction: 'One full answer in the expected format and length.' },
  { key: 'common_mistakes', heading: 'Common Mistakes', instruction: 'Quotation without context, unsupported claims.' },
  { key: 'quick_revision', heading: 'Quick Revision', instruction: 'Quotes, terms and points to carry into the exam.' },
]

const GENERAL_SECTIONS: SectionSpec[] = [
  { key: 'concept', heading: 'Concept', instruction: 'The idea in plain language.' },
  { key: 'definition', heading: 'Definitions', instruction: 'Syllabus wording.' },
  { key: 'explanation', heading: 'Explanation', instruction: 'Step-by-step reasoning.' },
  { key: 'formula', heading: 'Key Formulas / Facts', instruction: 'Anything that must be memorised.' },
  { key: 'example', heading: 'Example', instruction: 'One worked example.' },
  { key: 'common_mistakes', heading: 'Common Mistakes', instruction: 'Typical errors.' },
  { key: 'exam_tips', heading: 'Exam Tips', instruction: 'How to structure the answer.' },
  { key: 'quick_revision', heading: 'Quick Revision', instruction: 'A short recap.' },
]

export const SECTION_TEMPLATES: Record<SubjectKind, SectionSpec[]> = {
  physics: PHYSICS_SECTIONS,
  chemistry: CHEMISTRY_SECTIONS,
  mathematics: MATHS_SECTIONS,
  computer_science: CS_SECTIONS,
  english: ENGLISH_SECTIONS,
  general: GENERAL_SECTIONS,
}

/**
 * Sections for a depth. `quick` keeps the revision core; `exam_master` adds
 * the exam-facing sections; `standard`/`detailed` keep the full structure.
 */
export function sectionsFor(kind: SubjectKind, depth: DepthLevel): SectionSpec[] {
  const all = SECTION_TEMPLATES[kind]
  if (depth === 'quick') {
    const keep = new Set(['concept', 'definition', 'formula', 'quick_revision', 'common_mistakes', 'reactions', 'method'])
    return all.filter((section) => keep.has(section.key))
  }
  if (depth === 'exam_master') {
    const keep = new Set([
      'definition', 'formula', 'common_mistakes', 'exam_tips', 'quick_revision',
      'conditions', 'name_reactions', 'exceptions', 'method', 'theme', 'devices',
    ])
    return all.filter((section) => keep.has(section.key))
  }
  return all
}

/* -------------------------------------------------------------------------- */
/* Class-aware framing (spec §12)                                              */
/* -------------------------------------------------------------------------- */

export type ClassLevel = 'foundational' | 'board' | 'advanced'

export interface ClassFraming {
  level: ClassLevel
  label: string
  guidance: string
}

export function framingForClass(className: string | null | undefined): ClassFraming {
  const match = /(\d{1,2})/.exec(className ?? '')
  const year = match ? Number(match[1]) : null

  if (year !== null && year <= 8) {
    return {
      level: 'foundational',
      label: 'Foundation (≤ Class 8)',
      guidance:
        'Explain for a younger student: concrete everyday analogies first, no unexplained notation, no derivations unless the syllabus asks, short sentences, and every new term defined the moment it appears.',
    }
  }
  if (year !== null && year <= 10) {
    return {
      level: 'board',
      label: 'Board year (Class 9–10)',
      guidance:
        'Board-oriented: syllabus wording, marked scheme language, definitions exactly as they are examined, worked examples in the answer format boards expect, and an explicit note of what is out of syllabus.',
    }
  }
  return {
    level: 'advanced',
    label: 'Senior (Class 11–12)',
    guidance:
      'Advanced: derivations where the syllabus requires them, formal notation, units and sign conventions, connections to the prerequisites, and the higher-order points examiners award marks for.',
  }
}

/* -------------------------------------------------------------------------- */
/* Board / syllabus scoping (spec §13)                                         */
/* -------------------------------------------------------------------------- */

export interface GenerationContext {
  boardName: string
  academicSession: string
  className: string
  subjectName: string
  chapterName: string
  topics: string[]
  depth: DepthLevel
  noteType: NoteType
  /** Approved material the model may draw on, in priority order. */
  sources?: Array<{ name: string; note?: string }>
  /** Unresolved material that must be flagged rather than invented. */
  unresolved?: string[]
}

/**
 * The system prompt shared by every generation call.
 *
 * Three rules do the heavy lifting: stay inside the syllabus, produce original
 * explanatory material (never reproduce a textbook), and refuse rather than
 * invent. Everything else is structure.
 */
export function buildSystemPrompt(context: GenerationContext): string {
  const kind = classifySubject({ name: context.subjectName })
  const framing = framingForClass(context.className)
  const sections = sectionsFor(kind, context.depth)

  return [
    `You are writing original StudyOS study material for ${context.boardName}, ${context.className}, ${context.subjectName}.`,
    `Academic session: ${context.academicSession}. Chapter: ${context.chapterName}.`,
    '',
    'SCOPE',
    `Cover only: ${context.topics.length ? context.topics.join(', ') : context.chapterName}.`,
    'Do not teach material outside this syllabus. If a useful idea is out of scope, say so in one line instead of expanding on it.',
    '',
    'AUTHENTICITY',
    'Write original explanatory material. Do not reproduce or paraphrase a copyrighted textbook chapter, and do not copy any third-party website.',
    'Explain from first principles, using the approved reference material listed below.',
    'Never invent a year, a paper number, an official exam pattern, a page number or a source URL. If you do not know, write "not verified".',
    '',
    'LEVEL',
    `${framing.label}: ${framing.guidance}`,
    '',
    `DEPTH — ${context.depth}: ${DEPTH_DESCRIPTIONS[context.depth]}`,
    '',
    'STRUCTURE',
    'Return JSON with this exact shape:',
    '{"title": string, "sections": [{"key": string, "heading": string, "items": [{"type": string, "body": string}]}]}',
    'Allowed item types: heading, paragraph, definition, formula, derivation, example, reaction, table, tip, warning, question, answer, diagram.',
    'Use `formula` for anything symbolic, `reaction` for chemical equations, `warning` for common mistakes, `table` for comparisons.',
    'Sections to produce, in order:',
    ...sections.map((section) => `  ${section.key} — ${section.heading}: ${section.instruction}`),
    '',
    'SOURCES (cite by name, never invent a URL)',
    ...(context.sources?.length
      ? context.sources.map((source) => `  - ${source.name}${source.note ? ` (${source.note})` : ''}`)
      : ['  - General model knowledge (mark as "general knowledge" in references)']),
    ...(context.unresolved?.length
      ? ['', 'UNRESOLVED — flag these rather than guessing:', ...context.unresolved.map((entry) => `  - ${entry}`)]
      : []),
    '',
    'ACCURACY',
    'Check every formula and equation for consistency before returning. A section you cannot complete confidently must be returned as {"type": "warning", "body": "Section requires review"}.',
  ].join('\n')
}

/* -------------------------------------------------------------------------- */
/* Specialised generation prompts                                             */
/* -------------------------------------------------------------------------- */

export function buildRevisionPrompt(context: GenerationContext): string {
  return [
    buildSystemPrompt({ ...context, noteType: 'quick_revision', depth: 'quick' }),
    '',
    'EXTRA',
    'Quick revision only: no derivations, no long explanations. Bullet-length lines, formulas in symbolic form, and the five things most likely to be forgotten under exam pressure.',
  ].join('\n')
}

export function buildFormulaPrompt(context: GenerationContext): string {
  return [
    `Create a formula sheet for ${context.boardName} ${context.className} ${context.subjectName}, chapter "${context.chapterName}".`,
    `Session ${context.academicSession}. Topics: ${context.topics.join(', ')}.`,
    '',
    'Return JSON: {"formulas": [{"formula": string, "meaning": string, "variables": [{"symbol": string, "meaning": string, "unit": string}], "topic": string}]}',
    'Only formulas that genuinely belong to this syllabus. Every variable needs a meaning and, where applicable, an SI unit.',
    'Never invent an equation. If a relationship is approximate or conditional, say so in `meaning`.',
  ].join('\n')
}

export function buildReactionPrompt(context: GenerationContext): string {
  return [
    `Extract the named and important chemical reactions for ${context.boardName} ${context.className} Chemistry, chapter "${context.chapterName}".`,
    `Session ${context.academicSession}. Topics: ${context.topics.join(', ')}.`,
    '',
    'Return JSON: {"reactions": [{"reactants": string, "reagents": string, "conditions": string, "products": string, "reaction_name": string | null, "mechanism": string | null, "topic": string, "verified": boolean}]}',
    'Set `reaction_name` only when the reaction is genuinely named in the syllabus and you are confident of the name — otherwise null.',
    'Set `verified` true only when reactants, reagents, conditions and products are all consistent.',
  ].join('\n')
}

export function buildQuizPrompt(context: GenerationContext): string {
  return [
    `Write a chapter quiz for ${context.boardName} ${context.className} ${context.subjectName}, "${context.chapterName}".`,
    `Session ${context.academicSession}. Topics: ${context.topics.join(', ')}. Depth: ${context.depth}.`,
    '',
    'Return JSON: {"title": string, "questions": [{"id": string, "prompt": string, "options": string[], "answer": string, "explanation": string, "difficulty": "easy" | "moderate" | "hard", "marks": number}]}',
    '4 to 8 questions. Exactly one correct option. The answer must appear verbatim in options.',
    'Every question must test a topic listed above — no invented syllabus content.',
    `Label the set "${AI_PRACTICE_LABEL}": these are original practice questions, never presented as a past paper.`,
  ].join('\n')
}

export function buildFlashcardPrompt(context: GenerationContext): string {
  return [
    `Create flashcards for ${context.boardName} ${context.className} ${context.subjectName}, "${context.chapterName}".`,
    `Session ${context.academicSession}. Topics: ${context.topics.join(', ')}.`,
    '',
    'Return JSON: {"cards": [{"front": string, "back": string}]}',
    '8 to 16 cards. One fact per card. Fronts are a question or a term; backs are under 25 words.',
    'Mix definitions, formulas, reactions and exceptions according to the subject.',
  ].join('\n')
}

export function buildChapterMapPrompt(context: GenerationContext): string {
  return [
    `Build a structured chapter map for ${context.boardName} ${context.className} ${context.subjectName}, "${context.chapterName}".`,
    `Session ${context.academicSession}. Seed topics: ${context.topics.join(', ') || '(none supplied)'}.`,
    '',
    'Return JSON: {"topics": [{"name": string, "subtopics": string[], "learning_objectives": string[], "prerequisites": string[], "formulas": string[], "important_concepts": string[]}]}',
    'Stay strictly inside the syllabus for this board and session. Order the topics as they should be taught.',
  ].join('\n')
}

export function buildPracticePrompt(context: GenerationContext): string {
  return [
    `Write original ${AI_PRACTICE_LABEL} for ${context.boardName} ${context.className} ${context.subjectName}, "${context.chapterName}".`,
    `Session ${context.academicSession}. Topics: ${context.topics.join(', ')}.`,
    '',
    'Return JSON: {"questions": [{"prompt": string, "type": "MCQ" | "assertion_reason" | "short_answer" | "long_answer" | "numerical" | "case_study", "marks": number, "difficulty": "easy" | "moderate" | "hard", "answer": string, "explanation": string, "topic": string}]}',
    'Produce a spread of types and marks consistent with the chapter weight, not a copy of any paper.',
    'Never label these as a PYQ or a previous year question.',
  ].join('\n')
}

/** Map a note type onto the prompt builder the worker should use. */
export function promptFor(noteType: NoteType, context: GenerationContext): string {
  switch (noteType) {
    case 'quick_revision':
      return buildRevisionPrompt(context)
    case 'formula_sheet':
      return buildFormulaPrompt(context)
    case 'practice_questions':
      return buildPracticePrompt(context)
    case 'flashcards':
      return buildFlashcardPrompt(context)
    case 'quiz':
      return buildQuizPrompt(context)
    default:
      return buildSystemPrompt(context)
  }
}
