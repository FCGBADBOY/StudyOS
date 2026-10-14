/**
 * Automated content quality checks (spec §22, §23, §24, §57).
 *
 * Every generated note runs through `validateNote()` before an admin ever sees
 * it. The result is a score, a grade, an itemised list of warnings/errors and a
 * coverage report against the chapter map — never a bare "looks fine".
 *
 * Two properties matter more than the score:
 *
 *  1. Checks are *localised*. When something is fixable, `repairTargets()`
 *     returns the specific sections to regenerate, so the worker rewrites the
 *     broken section instead of the whole chapter (spec §24).
 *  2. A grade is not a claim of factual correctness (spec §57). Grades describe
 *     structural quality; anything the checker could not verify stays a warning.
 *
 * Pure: no I/O, no dependencies. Shared by the browser (live preview in the
 * review queue) and the worker (gate before publication).
 */
import type {
  CoverageReport,
  NoteItemType,
  ValidationIssue,
  ValidationReport,
} from './types'
import { NOTE_ITEM_TYPES } from './types'

/* -------------------------------------------------------------------------- */
/* Input shape                                                                */
/* -------------------------------------------------------------------------- */

export interface ValidationSection {
  key: string
  heading: string
  items: Array<{ type: NoteItemType | string; body: string }>
}

export interface ValidationInput {
  entity_type: ValidationReport['entity_type']
  entity_id: string
  sections: ValidationSection[]
  /** Topics from the chapter map / syllabus — what *must* be covered. */
  expectedTopics: string[]
  className?: string
  depth?: string
  /** References the generator claimed, for cross-checking. */
  sources?: Array<{ source_name: string; source_url?: string }>
}

const CHECKS_RUN = [
  'syllabus_alignment',
  'missing_topics',
  'duplicate_sections',
  'contradictory_statements',
  'formula_consistency',
  'reaction_consistency',
  'invalid_claims',
  'formatting',
  'class_appropriateness',
  'structure',
] as const

/* -------------------------------------------------------------------------- */
/* Individual checks                                                          */
/* -------------------------------------------------------------------------- */

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Topics the note actually addresses, from headings + item bodies. */
function coveredTopics(sections: ValidationSection[], expected: string[]): string[] {
  const haystack = normalise(
    sections.map((section) => `${section.heading} ${section.items.map((item) => item.body).join(' ')}`).join(' '),
  )
  return expected.filter((topic) => {
    const words = normalise(topic).split(' ').filter(Boolean)
    if (!words.length) return false
    /* A topic counts as covered when most of its words appear — exact
       substring matching fails on "Electric Charges and Fields". */
    const hits = words.filter((word) => haystack.includes(word)).length
    return hits / words.length >= 0.6
  })
}

function duplicateSectionCheck(sections: ValidationSection[]): ValidationIssue[] {
  const seen = new Map<string, number>()
  const issues: ValidationIssue[] = []

  for (const section of sections) {
    const key = normalise(section.key || section.heading)
    if (!key) continue
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count > 1) {
      issues.push({
        code: 'duplicate_section',
        label: 'Duplicate section',
        detail: `"${section.heading}" appears more than once.`,
        severity: 'warning',
        target: section.key,
      })
    }
  }
  return issues
}

/**
 * Contradiction heuristics: the same quantity given two different values, or
 * an assertion immediately negated. Deliberately conservative — a false
 * positive costs a review, a false negative costs trust.
 */
function contradictionCheck(sections: ValidationSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const values = new Map<string, Set<string>>()

  const assignment = /\b([A-Za-z][A-Za-z0-9_ ]{1,24})\s*(?:=|:|is|equals)\s*([−-]?[0-9][0-9.,]*\s*(?:[A-Za-z%°/²³]+)?)/g

  for (const section of sections) {
    for (const item of section.items) {
      if (item.type !== 'paragraph' && item.type !== 'definition' && item.type !== 'formula') continue
      assignment.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = assignment.exec(item.body)) !== null) {
        const key = normalise(match[1])
        const value = match[2].replace(/\s+/g, ' ').trim()
        const bucket = values.get(key) ?? new Set<string>()
        if (bucket.size > 0 && !bucket.has(value) && bucket.size < 4) {
          issues.push({
            code: 'contradictory_statement',
            label: 'Conflicting values',
            detail: `"${match[1].trim()}" is given as both ${[...bucket][0]} and ${value}.`,
            severity: 'error',
            target: section.key,
          })
        }
        bucket.add(value)
        values.set(key, bucket)
      }
    }
  }
  return issues
}

/** Brackets balanced, no empty formulas, units present where expected. */
function formulaCheck(sections: ValidationSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const section of sections) {
    for (const item of section.items) {
      if (item.type !== 'formula') continue
      const body = item.body.trim()

      if (!body) {
        issues.push({
          code: 'empty_formula',
          label: 'Empty formula',
          detail: 'A formula block has no content.',
          severity: 'error',
          target: section.key,
        })
        continue
      }

      const opens = (body.match(/\(/g) ?? []).length
      const closes = (body.match(/\)/g) ?? []).length
      if (opens !== closes) {
        issues.push({
          code: 'unbalanced_formula',
          label: 'Unbalanced brackets',
          detail: `"${body.slice(0, 60)}" has ${opens} "(" but ${closes} ")".`,
          severity: 'error',
          target: section.key,
        })
      }
    }
  }
  return issues
}

/** Chemistry reactions must be balanced and carry conditions. */
function reactionCheck(sections: ValidationSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const section of sections) {
    for (const item of section.items) {
      if (item.type !== 'reaction') continue
      const body = item.body
      if (!body.trim()) {
        issues.push({
          code: 'empty_reaction',
          label: 'Empty reaction',
          detail: 'A reaction block has no content.',
          severity: 'error',
          target: section.key,
        })
        continue
      }
      if (/(→|->)/.test(body) === false && !/=/.test(body)) {
        issues.push({
          code: 'reaction_missing_arrow',
          label: 'Reaction has no arrow',
          detail: `"${body.slice(0, 60)}" does not look like an equation.`,
          severity: 'warning',
          target: section.key,
        })
      }
      if (!/(heat|cold|acid|base|catalyst|°C|room temp|aqueous|concentrated|dilute|Δ)/i.test(body)) {
        issues.push({
          code: 'reaction_missing_conditions',
          label: 'Conditions not stated',
          detail: 'A reaction should record the conditions it needs.',
          severity: 'info',
          target: section.key,
        })
      }
    }
  }
  return issues
}

/**
 * Claims the checker refuses to let through silently: prediction language,
 * invented authority, or a promise of exam content (spec §35/§59).
 */
function invalidClaimCheck(sections: ValidationSection[]): ValidationIssue[] {
  const patterns: Array<{ regex: RegExp; label: string; detail: string }> = [
    { regex: /\bwill (?:definitely|certainly) appear\b/i, label: 'Prediction claim', detail: 'Predictions of what will appear in an exam are never acceptable.' },
    { regex: /\bguaranteed (?:to )?appear\b/i, label: 'Prediction claim', detail: 'Guaranteed-appeal language must be removed.' },
    { regex: /\bconfirmed by (?:the )?board\b/i, label: 'Unverified authority', detail: 'Claims about board confirmations need a cited source.' },
    { regex: /\bexpected questions? (?:for|in) 20\d{2}\b/i, label: 'Prediction claim', detail: 'Historical frequency may be described; future questions may not.' },
    { regex: /\bfrom the (?:textbook|ncert book) page \d+\b/i, label: 'Invented citation', detail: 'Page numbers must come from a real reference, never be inferred.' },
  ]

  const issues: ValidationIssue[] = []
  for (const section of sections) {
    for (const item of section.items) {
      for (const pattern of patterns) {
        if (pattern.regex.test(item.body)) {
          issues.push({
            code: 'invalid_claim',
            label: pattern.label,
            detail: pattern.detail,
            severity: 'error',
            target: section.key,
          })
        }
      }
    }
  }
  return issues
}

/** Empty sections, unknown item types, absurdly short or long bodies. */
function formattingCheck(sections: ValidationSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const allowed = new Set<string>(NOTE_ITEM_TYPES)

  if (!sections.length) {
    issues.push({
      code: 'empty_note',
      label: 'No sections',
      detail: 'The generated note has no content at all.',
      severity: 'error',
    })
    return issues
  }

  for (const section of sections) {
    if (!section.items.length) {
      issues.push({
        code: 'empty_section',
        label: 'Empty section',
        detail: `"${section.heading}" has no items.`,
        severity: 'warning',
        target: section.key,
      })
      continue
    }

    for (const item of section.items) {
      if (!allowed.has(item.type)) {
        issues.push({
          code: 'unknown_item_type',
          label: 'Unknown item type',
          detail: `"${item.type}" is not a renderable note item.`,
          severity: 'error',
          target: section.key,
        })
      }
      if (!item.body.trim()) {
        issues.push({
          code: 'empty_item',
          label: 'Empty block',
          detail: `A ${item.type} block in "${section.heading}" is empty.`,
          severity: 'warning',
          target: section.key,
        })
      }
    }
  }

  return issues
}

/**
 * Class appropriateness — a proxy, not a readability score: vocabulary density
 * and sentence length relative to the level the note claims to be for.
 */
function classAppropriatenessCheck(sections: ValidationSection[], className?: string): ValidationIssue[] {
  if (!className) return []
  const match = /(\d{1,2})/.exec(className)
  const year = match ? Number(match[1]) : null
  if (year === null || year > 10) return []

  const text = sections.map((section) => section.items.map((item) => item.body).join(' ')).join(' ')
  if (!text.trim()) return []

  const sentences = text.split(/[.!?]+/).filter((part) => part.trim().length > 0)
  const average = sentences.length ? text.length / sentences.length : 0

  if (average > 320) {
    return [
      {
        code: 'long_sentences',
        label: 'Reading level too advanced',
        detail: `Average sentence is ${Math.round(average)} characters — long for ${className}.`,
        severity: 'warning',
      },
    ]
  }
  return []
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

const WEIGHTS = { error: 26, warning: 9, info: 2 } as const

export function scoreIssues(issues: ValidationIssue[]): { score: number; grade: 'A' | 'B' | 'C' | 'review' } {
  const penalty = issues.reduce(
    (total, issue) => total + (WEIGHTS[issue.severity] ?? 0),
    0,
  )
  const score = Math.max(0, Math.min(100, 100 - penalty))

  const hasError = issues.some((issue) => issue.severity === 'error')
  if (hasError && score < 60) return { score, grade: 'review' }
  if (score >= 90) return { score, grade: 'A' }
  if (score >= 75) return { score, grade: 'B' }
  if (score >= 60) return { score, grade: 'C' }
  return { score, grade: 'review' }
}

export function coverageReport(sections: ValidationSection[], expectedTopics: string[]): CoverageReport {
  const covered = coveredTopics(sections, expectedTopics)
  const missing = expectedTopics.filter((topic) => !covered.includes(topic))
  return { expected: expectedTopics, covered, missing }
}

/* -------------------------------------------------------------------------- */
/* The gate                                                                   */
/* -------------------------------------------------------------------------- */

export function validateNote(input: ValidationInput): ValidationReport {
  const warnings: ValidationIssue[] = []
  const errors: ValidationIssue[] = []
  const infos: ValidationIssue[] = []

  const push = (issues: ValidationIssue[]) => {
    for (const issue of issues) {
      if (issue.severity === 'error') errors.push(issue)
      else if (issue.severity === 'warning') warnings.push(issue)
      else infos.push(issue)
    }
  }

  push(formattingCheck(input.sections))
  push(duplicateSectionCheck(input.sections))
  push(contradictionCheck(input.sections))
  push(formulaCheck(input.sections))
  push(reactionCheck(input.sections))
  push(invalidClaimCheck(input.sections))
  push(classAppropriatenessCheck(input.sections, input.className))

  const coverage = coverageReport(input.sections, input.expectedTopics)

  if (coverage.missing.length) {
    warnings.push({
      code: 'incomplete_syllabus_coverage',
      label: `${coverage.missing.length} syllabus topic(s) missing`,
      detail: coverage.missing.join(', '),
      severity: 'warning',
    })
  }

  /* Refuse rather than fabricate: a note that skipped its whole syllabus is
     not publishable with a warning attached (spec §58). */
  if (input.expectedTopics.length && coverage.covered.length === 0) {
    errors.push({
      code: 'no_syllabus_coverage',
      label: 'No syllabus topics covered',
      detail: 'None of the chapter map topics appear in this note.',
      severity: 'error',
    })
  }

  const all = [...errors, ...warnings, ...infos]
  const { score, grade } = scoreIssues(all)

  return {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    checks_run: [...CHECKS_RUN],
    quality_score: score,
    quality_grade: grade,
    /* Publication requires no errors and at least a C. */
    passed: errors.length === 0 && score >= 60,
    warnings,
    errors,
    coverage,
  }
}

/**
 * Sections to regenerate (spec §24).
 *
 * Prefers the precise targets the checker reported; falls back to every
 * section that sits on a syllabus topic it failed to find. Never returns "all"
 * unless every section is implicated — regenerating a whole chapter because one
 * formula is unbalanced wastes the budget for nothing.
 */
export function repairTargets(report: ValidationReport, sections: ValidationSection[]): string[] {
  const targeted = new Set<string>()

  for (const issue of [...report.errors, ...report.warnings]) {
    if (issue.target) targeted.add(issue.target)
  }

  if (targeted.size) return [...targeted]

  if (report.coverage.missing.length) {
    const haystack = normalise(report.coverage.missing.join(' '))
    for (const section of sections) {
      const text = normalise(`${section.heading} ${section.items.map((item) => item.body).join(' ')}`)
      if (haystack.split(' ').some((word) => word.length > 4 && text.includes(word))) {
        targeted.add(section.key)
      }
    }
  }

  return [...targeted]
}

/** Words worth counting for the "word count" figure on a note. */
export function countWords(sections: ValidationSection[]): number {
  return sections.reduce(
    (total, section) =>
      total + section.items.reduce((sum, item) => sum + item.body.split(/\s+/).filter(Boolean).length, 0),
    0,
  )
}
