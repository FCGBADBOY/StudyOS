/**
 * Previous Year Questions service.
 *
 * Reads `pyq_questions` (plus the SQL views in
 * `supabase/migrations/*_pyq_intelligence.sql`) so every number on the PYQ
 * Intelligence screen — frequency by year, chapter frequency, marks and
 * difficulty splits, repeat rate — is computed by the database, never
 * hard-coded in the frontend.
 */
import type {
  ConceptFrequency,
  PyqDifficultySlice,
  PyqOverview,
  PyqPaper,
  PyqQuestion,
  PyqSubjectStat,
} from '@/types'
import type {
  PyqChapterStatRow,
  PyqConceptStatRow,
  PyqDifficultyStatRow,
  PyqFilter,
  PyqMarksStatRow,
  PyqQuestionRow,
  PyqRowType,
  PyqYearStatRow,
} from '@/types/pyq'
import { PYQ_OVERVIEW as DEMO_OVERVIEW, getPaper as demoGetPaper, papersForSubject as demoPapers, PYQ_PAPERS as DEMO_PAPERS, questionsForSubject as demoQuestions } from '@/data/pyq'
import { db, isDemo, memo, rows, toSubjectId } from './shared'

/* ------------------------------- mappings -------------------------------- */

const TYPE_MAP: Record<PyqRowType, PyqQuestion['type']> = {
  MCQ: 'MCQ',
  assertion_reason: 'AR',
  short_answer: 'SA',
  long_answer: 'LA',
  numerical: 'Numerical',
  case_study: 'Case-based',
  other: 'Other',
}

const DIFFICULTY_MAP = { easy: 'Easy', moderate: 'Medium', hard: 'Hard' } as const

interface QuestionEmbed extends PyqQuestionRow {
  chapters: {
    id: string
    slug: string
    name: string
    subjects: { slug: string; name: string } | null
  } | null
  boards: { short_name: string } | null
  classes: { slug: string } | null
}

function toQuestion(row: QuestionEmbed, repeated: boolean): PyqQuestion {
  const chapter = row.chapters
  return {
    id: row.id,
    question: row.question_text,
    year: row.year,
    board: row.boards?.short_name ?? 'CBSE',
    subjectId: toSubjectId(chapter?.subjects?.slug),
    chapterSlug: chapter?.slug ?? '',
    chapter: chapter?.name ?? 'Chapter',
    marks: row.marks,
    difficulty: DIFFICULTY_MAP[row.difficulty] ?? 'Medium',
    type: TYPE_MAP[row.question_type] ?? 'SA',
    concepts: row.concepts ?? [],
    repeated,
    important: row.is_important,
  }
}

/* ------------------------------- question set ----------------------------- */

/** All questions for the archive, with chapter/subject/board context. */
async function loadQuestions(): Promise<QuestionEmbed[]> {
  return memo('pyq:questions', async () => {
    const client = db()
    if (!client) return []
    return rows<QuestionEmbed>(
      client
        .from('pyq_questions')
        .select('*, chapters(id, slug, name, subjects(slug, name)), boards(short_name), classes(slug)')
        .order('year', { ascending: false })
        .limit(1000),
    )
  })
}

/** Questions sharing a `group_key` are the repeats the intelligence screen tracks. */
function repeatFlags(list: QuestionEmbed[]): Map<string, boolean> {
  const counts = new Map<string, number>()
  list.forEach((row) => {
    if (!row.group_key) return
    counts.set(row.group_key, (counts.get(row.group_key) ?? 0) + 1)
  })
  const flags = new Map<string, boolean>()
  list.forEach((row) => flags.set(row.id, Boolean(row.group_key && (counts.get(row.group_key) ?? 0) > 1)))
  return flags
}

export async function getPyqQuestions(filter: PyqFilter = {}): Promise<PyqQuestion[]> {
  if (isDemo) return demoQuestions(undefined)

  const list = await loadQuestions()
  const flags = repeatFlags(list)

  return list
    .filter((row) => {
      const chapter = row.chapters
      if (filter.chapterSlug && chapter?.slug !== filter.chapterSlug) return false
      if (filter.subjectSlug && chapter?.subjects?.slug !== filter.subjectSlug) return false
      if (filter.year && row.year !== filter.year) return false
      if (filter.marks && row.marks !== filter.marks) return false
      if (filter.difficulty && row.difficulty !== filter.difficulty) return false
      if (filter.important && !row.is_important) return false
      if (filter.boardSlug && row.boards?.short_name.toLowerCase() !== filter.boardSlug) return false
      return true
    })
    .map((row) => toQuestion(row, Boolean(flags.get(row.id))))
}

/* --------------------------------- papers --------------------------------- */

function buildPapers(list: QuestionEmbed[]): PyqPaper[] {
  const groups = new Map<string, QuestionEmbed[]>()
  list.forEach((row) => {
    const key = `${row.year}|${row.board_id}|${row.subject_id ?? 'x'}|${row.exam_type}|${row.paper_set}`
    const bucket = groups.get(key) ?? []
    bucket.push(row)
    groups.set(key, bucket)
  })

  const flags = repeatFlags(list)

  return Array.from(groups.entries())
    .map(([key, bucket]) => {
      const first = bucket[0]
      const chapter = first.chapters
      const subjectSlug = chapter?.subjects?.slug ?? 'physics'
      const [year, , , examType, set] = key.split('|')

      const sorted = [...bucket].sort((a, b) => a.marks - b.marks || a.question_text.localeCompare(b.question_text))
      const byMarks = new Map<number, PyqQuestion[]>()
      sorted.forEach((row) => {
        const question = toQuestion(row, Boolean(flags.get(row.id)))
        const list = byMarks.get(row.marks) ?? []
        list.push(question)
        byMarks.set(row.marks, list)
      })

      const letters = 'ABCDEFGH'
      let index = 0
      const sections = Array.from(byMarks.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([marks, questions]) => ({
          name: `Section ${letters[index++ % letters.length]}`,
          questions: `${questions.length} question${questions.length === 1 ? '' : 's'}`,
          marks: `${marks} mark${marks === 1 ? '' : 's'} each`,
        }))

      const totalMarks = sorted.reduce((sum, row) => sum + row.marks, 0)

      return {
        id: key,
        slug: `${year}-${(first.boards?.short_name ?? 'cbse').toLowerCase()}-${subjectSlug}-${slugifySet(set)}`,
        year: Number(year),
        board: first.boards?.short_name ?? 'CBSE',
        classId: (first.classes?.slug ?? 'class-12') as PyqPaper['classId'],
        subjectId: toSubjectId(subjectSlug),
        subjectName: chapter?.subjects?.name ?? 'Physics',
        set: examType && examType !== 'board' ? titleOf(examType) : set || 'Set 1',
        duration: totalMarks >= 60 ? '3 hours' : '2 hours',
        marks: totalMarks,
        sections,
        questions: sorted.map((row) => toQuestion(row, Boolean(flags.get(row.id)))),
      }
    })
    .sort((a, b) => b.year - a.year)
}

function slugifySet(set: string | undefined): string {
  return (set ?? 'set-1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleOf(value: string): string {
  return value
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function getPyqPapers(subjectId?: string): Promise<PyqPaper[]> {
  if (isDemo) return subjectId ? demoPapers(subjectId) : DEMO_PAPERS

  const list = await loadQuestions()
  const papers = buildPapers(list)
  return subjectId ? papers.filter((paper) => paper.subjectId === subjectId) : papers
}

export async function getPaper(slug?: string): Promise<PyqPaper | undefined> {
  if (!slug) return undefined
  if (isDemo) return demoGetPaper(slug)

  const papers = await getPyqPapers()
  return papers.find((paper) => paper.slug === slug || paper.id === slug)
}

/* ------------------------------- intelligence ----------------------------- */

/**
 * Everything the PYQ Intelligence dashboard shows, straight from SQL views:
 * most frequent chapters, year frequency, marks/difficulty distribution and
 * repeated concept groups.
 */
export async function getPyqOverview(): Promise<PyqOverview> {
  if (isDemo) return DEMO_OVERVIEW

  const client = db()
  if (!client) return DEMO_OVERVIEW

  return memo('pyq:overview', async () => {
    const [chapterStats, yearStats, marksStats, difficultyStats, conceptStats, questionCount] =
      await Promise.all([
        rows<PyqChapterStatRow>(client.from('pyq_chapter_stats').select('*')),
        rows<PyqYearStatRow>(client.from('pyq_year_stats').select('*')),
        rows<PyqMarksStatRow>(client.from('pyq_marks_stats').select('*')),
        rows<PyqDifficultyStatRow>(client.from('pyq_difficulty_stats').select('*')),
        rows<PyqConceptStatRow>(client.from('pyq_concept_stats').select('*')),
        client.from('pyq_questions').select('id', { count: 'exact', head: true }),
      ])

    const totalQuestions = questionCount.count ?? 0
    const years = yearStats.map((row) => row.year).sort()
    const repeatCount = conceptStats.reduce((sum, row) => sum + Math.max(0, row.question_count - 1), 0)
    const repeatRate = totalQuestions ? Math.round((repeatCount / totalQuestions) * 100) : 0
    const papersScanned = await countPapers()

    /* Subject display names, taken from the question rows themselves. */
    const questionList = await loadQuestions()
    const subjectNames = new Map<string, string>()
    questionList.forEach((row) => {
      const subject = row.chapters?.subjects
      if (subject) subjectNames.set(subject.slug, subject.name)
    })

    const topConcepts: ConceptFrequency[] = conceptStats.slice(0, 6).map((row) => {
      const appearances = row.question_count
      return {
        id: row.concept.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: row.concept,
        subjectId: toSubjectId(row.subject_slug),
        chapter: row.concept,
        appearances,
        priority: appearances >= 6 ? 'HIGH PRIORITY' : appearances >= 3 ? 'MEDIUM PRIORITY' : 'LOW PRIORITY',
        years: row.years ?? [],
        marks: Math.round(row.average_marks),
        difficulty: row.last_difficulty === 'easy' ? 'Easy' : row.last_difficulty === 'hard' ? 'Hard' : 'Medium',
        trend: (row.years ?? []).slice(-5).map((year) => yearStats.find((stat) => stat.year === year)?.question_count ?? 0),
      }
    })

    const chaptersBySubject = new Map<string, { questions: number; chapters: Set<string> }>()
    chapterStats.forEach((row) => {
      const entry = chaptersBySubject.get(row.subject_slug) ?? { questions: 0, chapters: new Set() }
      entry.questions += row.question_count
      entry.chapters.add(row.chapter_id)
      chaptersBySubject.set(row.subject_slug, entry)
    })

    const subjectStats: PyqSubjectStat[] = Array.from(chaptersBySubject.entries())
      .map(([slug, entry]) => {
        const subjectConcepts = conceptStats.filter((row) => row.subject_slug === slug)
        const repeated = subjectConcepts.reduce((sum, row) => sum + Math.max(0, row.question_count - 1), 0)
        return {
          subjectId: toSubjectId(slug),
          subjectName: subjectNames.get(slug) ?? titleOf(slug),
          questions: entry.questions,
          chaptersCovered: entry.chapters.size,
          repeatRate: entry.questions ? Math.min(100, Math.round((repeated / entry.questions) * 100)) : 0,
        }
      })
      .sort((a, b) => b.questions - a.questions)

    const difficulty: PyqDifficultySlice[] = ['easy', 'moderate', 'hard'].map((level) => {
      const match = difficultyStats.find((row) => row.difficulty === level)
      const value = totalQuestions && match ? Math.round((match.question_count / totalQuestions) * 100) : 0
      return {
        label: (level === 'moderate' ? 'Medium' : level === 'easy' ? 'Easy' : 'Hard') as PyqDifficultySlice['label'],
        value,
      }
    })

    return {
      questionsAnalyzed: totalQuestions,
      papersScanned,
      yearsCovered: years.length ? years[years.length - 1] - years[0] + 1 : 0,
      repeatRate,
      topConcepts,
      frequentChapters: chapterStats
        .slice()
        .sort((a, b) => b.question_count - a.question_count)
        .slice(0, 5)
        .map((row) => ({
          chapter: row.chapter_name,
          subjectId: toSubjectId(row.subject_slug),
          count: row.question_count,
        })),
      difficulty,
      subjectStats,
    }
  })
}

async function countPapers(): Promise<number> {
  const list = await loadQuestions()
  const keys = new Set(
    list.map((row) => `${row.year}|${row.board_id}|${row.subject_id ?? 'x'}|${row.exam_type}|${row.paper_set}`),
  )
  return keys.size
}
