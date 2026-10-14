/**
 * Historical analysis over collected papers (spec §35, §36, §77).
 *
 * The wording matters as much as the maths: this is *historical frequency* and
 * *past-paper trend*. StudyOS never renders it as a prediction of what will
 * appear in a future exam, and `invalidClaimLanguage()` exists so the UI can
 * refuse to render copy that overstates it.
 *
 * Pure: no I/O, no dependencies.
 */

export interface PastPaperQuestion {
  id: string
  year: number
  marks: number
  question_type: string
  difficulty?: string | null
  chapter_id?: string | null
  chapter_name?: string | null
  topic?: string | null
  concepts?: string[]
}

export interface ChapterAnalysis {
  chapterId: string | null
  chapterName: string
  questionCount: number
  yearsCovered: number
  lastYear: number | null
  averageMarks: number
  /** Times each topic/concept was asked, newest-first tie-break. */
  frequency: Array<{ concept: string; count: number }>
  marksDistribution: Array<{ marks: number; count: number }>
  typeDistribution: Array<{ type: string; count: number }>
  yearDistribution: Array<{ year: number; count: number }>
  difficultyDistribution: Array<{ difficulty: string; count: number }>
}

/** Percentages that always sum to 0 when there is nothing to count. */
export function distribution<T>(
  values: T[],
  key: (value: T) => string,
): Array<{ key: string; count: number; percent: number }> {
  if (!values.length) return []
  const counts = new Map<string, number>()

  for (const value of values) {
    const bucket = key(value) || 'unknown'
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([bucket, count]) => ({ key: bucket, count, percent: Math.round((count / values.length) * 100) }))
    .sort((a, b) => b.count - a.count)
}

/** How often each concept has been asked — "historical frequency", not a forecast. */
export function conceptFrequency(questions: PastPaperQuestion[], limit = 8): Array<{ concept: string; count: number }> {
  const counts = new Map<string, number>()

  for (const question of questions) {
    const concepts = question.concepts?.length
      ? question.concepts
      : question.topic
        ? [question.topic]
        : []
    for (const concept of concepts) {
      const trimmed = concept.trim()
      if (trimmed) counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count || a.concept.localeCompare(b.concept))
    .slice(0, limit)
}

export function analyseChapter(questions: PastPaperQuestion[], chapterName: string, chapterId: string | null): ChapterAnalysis {
  const years = questions.map((question) => question.year).filter((year) => Number.isFinite(year))
  const uniqueYears = [...new Set(years)].sort((a, b) => a - b)

  return {
    chapterId,
    chapterName,
    questionCount: questions.length,
    yearsCovered: uniqueYears.length,
    lastYear: uniqueYears.length ? uniqueYears[uniqueYears.length - 1] : null,
    averageMarks: questions.length
      ? Math.round((questions.reduce((total, question) => total + (question.marks || 0), 0) / questions.length) * 10) / 10
      : 0,
    frequency: conceptFrequency(questions),
    marksDistribution: distribution(questions, (question) => String(question.marks || 0)).map((entry) => ({
      marks: Number(entry.key) || 0,
      count: entry.count,
    })),
    typeDistribution: distribution(questions, (question) => question.question_type || 'other').map((entry) => ({
      type: entry.key,
      count: entry.count,
    })),
    yearDistribution: distribution(questions, (question) => String(question.year)).map((entry) => ({
      year: Number(entry.key) || 0,
      count: entry.count,
    })),
    difficultyDistribution: distribution(questions, (question) => question.difficulty || 'moderate').map((entry) => ({
      difficulty: entry.key,
      count: entry.count,
    })),
  }
}

/** Section structure of a paper — used by the sample-paper analysis (spec §36). */
export interface PaperStructure {
  sectionCount: number
  totalMarks: number | null
  questionTypes: Array<{ type: string; count: number }>
  marksSpread: Array<{ marks: number; count: number }>
}

export function analysePaperStructure(
  sections: Array<{ name: string; marks?: number | null; question_count?: number | null; question_types?: string[] }>,
  questions: Array<{ question_type: string; marks: number | null }>,
): PaperStructure {
  const knownSections = sections.filter((section) => typeof section.marks === 'number')
  const totalMarks = knownSections.length
    ? knownSections.reduce((total, section) => total + (section.marks ?? 0), 0)
    : null

  return {
    sectionCount: sections.length,
    totalMarks,
    questionTypes: distribution(questions, (question) => question.question_type || 'other').map((entry) => ({
      type: entry.key,
      count: entry.count,
    })),
    marksSpread: distribution(
      questions.filter((question) => typeof question.marks === 'number'),
      (question) => String(question.marks),
    ).map((entry) => ({ marks: Number(entry.key) || 0, count: entry.count })),
  }
}

/* -------------------------------------------------------------------------- */
/* Honest labelling                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Wording that is safe to show next to a frequency chart.
 *
 * Anything that implies foresight must be rejected before it reaches a
 * student, because a study app that claims to predict papers is lying.
 */
export const HISTORICAL_LABELS = {
  title: 'Historical Analysis',
  frequency: 'Historical frequency',
  trend: 'Past-paper trend',
  mostTested: 'Most frequently tested topics',
  yearsCovered: 'Years covered',
  marksProfile: 'Marks distribution',
  questionProfile: 'Question types',
} as const

const UNSAFE_LANGUAGE = [
  /\bexpected (?:questions?|topics?) (?:in|for|of) 20\d{2}\b/i,
  /\bwill (?:be )?(?:come|appear|be asked)\b/i,
  /\bpredict(?:ed|ion)s?\b/i,
  /\bguaranteed\b/i,
  /\bconfirmed questions?\b/i,
]

/** Copy that would turn history into a promise. */
export function invalidClaimLanguage(text: string): string | null {
  for (const pattern of UNSAFE_LANGUAGE) {
    const match = pattern.exec(text)
    if (match) return match[0]
  }
  return null
}

/** Safe sentence for a chapter's history, built only from real data. */
export function describeAnalysis(analysis: ChapterAnalysis): string {
  if (!analysis.questionCount) {
    return 'No past questions have been indexed for this chapter yet.'
  }
  const years =
    analysis.yearsCovered > 1
      ? ` across ${analysis.yearsCovered} years (${analysis.lastYear ?? '—'} being the most recent)`
      : ''
  const top = analysis.frequency[0]
  return `${analysis.questionCount} question${analysis.questionCount === 1 ? '' : 's'} recorded${years}.${
    top ? ` "${top.concept}" has been asked ${top.count} time${top.count === 1 ? '' : 's'}.` : ''
  } This is historical frequency, not a prediction.`
}
