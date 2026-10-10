import type { Chapter, Resource, ResourceType, Subject } from '@/types'
import { slugify } from '@/utils/format'

/** Tabs shown on subject and chapter pages. */
export const RESOURCE_TABS: { id: ResourceType; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'pyq', label: 'PYQs' },
  { id: 'sample-paper', label: 'Sample Papers' },
  { id: 'important-questions', label: 'Important Questions' },
  { id: 'formula-sheet', label: 'Formula Sheet' },
  { id: 'diagram', label: 'Diagrams' },
  { id: 'revision', label: 'Revision' },
  { id: 'video', label: 'Videos' },
  { id: 'reference', label: 'Reference' },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Deterministic resource builder: every chapter gets a full, plausible set of
 * resources derived from its metadata (so the UI looks populated everywhere).
 */
export function buildChapterResources(subject: Subject, chapter: Chapter): Resource[] {
  const seed = chapter.questionCount + chapter.pyqCount

  const resources: Resource[] = [
    {
      id: `res:${subject.id}:${chapter.slug}:notes`,
      type: 'notes',
      title: `${chapter.title} — NCERT Notes`,
      subjectId: subject.id,
      chapterSlug: chapter.slug,
      description: `Concept notes covering ${chapter.topics.slice(0, 3).join(', ')}.`,
      meta: `${clamp(Math.round(chapter.estimatedMinutes / 4), 8, 48)} pages`,
      size: `${clamp(Math.round(seed / 34), 1, 9)}.${seed % 9} MB`,
      updated: '2 days ago',
      downloaded: true,
    },
    {
      id: `res:${subject.id}:${chapter.slug}:pyq`,
      type: 'pyq',
      title: `Previous Year Questions — ${chapter.title}`,
      subjectId: subject.id,
      chapterSlug: chapter.slug,
      description: `${chapter.pyqCount} board questions with step-by-step solutions, tagged by year.`,
      meta: `${chapter.pyqCount} questions`,
      questions: chapter.pyqCount,
      updated: 'Yesterday',
    },
    {
      id: `res:${subject.id}:${chapter.slug}:important`,
      type: 'important-questions',
      title: `Important Questions — ${chapter.title}`,
      subjectId: subject.id,
      chapterSlug: chapter.slug,
      description: `High-probability questions ranked by repetition in the last 10 years.`,
      meta: `${clamp(Math.round(chapter.pyqCount / 3.4), 8, 40)} questions`,
      questions: clamp(Math.round(chapter.pyqCount / 3.4), 8, 40),
      updated: '4 days ago',
    },
    {
      id: `res:${subject.id}:${chapter.slug}:formula`,
      type: 'formula-sheet',
      title: `Formula Sheet — ${chapter.title}`,
      subjectId: subject.id,
      chapterSlug: chapter.slug,
      description: `Every equation, constant and unit you need in the exam hall.`,
      meta: `${clamp(Math.round(chapter.topics.length * 0.8), 3, 14)} pages`,
      size: '1.2 MB',
      updated: '1 week ago',
      bookmarked: chapter.favorite,
    },
    {
      id: `res:${subject.id}:${chapter.slug}:diagram`,
      type: 'diagram',
      title: `Diagrams — ${chapter.title}`,
      subjectId: subject.id,
      chapterSlug: chapter.slug,
      description: `Label-ready diagrams with exam marking points.`,
      meta: `${clamp(chapter.topics.length, 3, 12)} diagrams`,
      updated: '1 week ago',
      downloaded: true,
    },
    {
      id: `res:${subject.id}:${chapter.slug}:revision`,
      type: 'revision',
      title: `Revision Sheet — ${chapter.title}`,
      subjectId: subject.id,
      chapterSlug: chapter.slug,
      description: `One-pass summary: definitions, results and common traps.`,
      meta: `${clamp(Math.round(chapter.estimatedMinutes / 30), 3, 9)} pages`,
      size: '0.6 MB',
      updated: '3 days ago',
    },
    {
      id: `res:${subject.id}:${chapter.slug}:sample`,
      type: 'sample-paper',
      title: `Sample Paper — ${chapter.topics[0] ?? chapter.title}`,
      subjectId: subject.id,
      chapterSlug: chapter.slug,
      description: `Chapter-weighted practice paper in board exam format.`,
      meta: `${clamp(Math.round(seed / 40), 10, 35)} questions`,
      questions: clamp(Math.round(seed / 40), 10, 35),
      updated: '5 days ago',
    },
  ]

  return resources
}

/** Subject-level resources (whole-syllabus material). */
export function buildSubjectResources(subject: Subject): Resource[] {
  return [
    {
      id: `res:${subject.id}:syllabus-notes`,
      type: 'notes',
      title: `${subject.name} — Full Syllabus Notes`,
      subjectId: subject.id,
      description: `${subject.totalChapters} chapters, exam-ready and mapped to the latest syllabus.`,
      meta: `${subject.totalChapters * 9} pages`,
      size: '14.2 MB',
      updated: 'Yesterday',
      downloaded: true,
    },
    {
      id: `res:${subject.id}:sample-set`,
      type: 'sample-paper',
      title: `${subject.name} — CBSE Sample Paper Set A`,
      subjectId: subject.id,
      description: 'Full-length paper with marking scheme and solution key.',
      meta: '70 marks · 3 hours',
      updated: '3 days ago',
    },
    {
      id: `res:${subject.id}:important-bank`,
      type: 'important-questions',
      title: `${subject.name} — Most Repeated Questions`,
      subjectId: subject.id,
      description: 'Questions that repeat across the last 10 board papers.',
      meta: '120 questions',
      questions: 120,
      updated: 'Today',
    },
    {
      id: `res:${subject.id}:formula-sheet`,
      type: 'formula-sheet',
      title: `${subject.name} — Master Formula Sheet`,
      subjectId: subject.id,
      description: 'Every formula in the syllabus with SI units and conditions.',
      meta: '18 pages',
      size: '2.4 MB',
      updated: '1 week ago',
      bookmarked: true,
    },
    {
      id: `res:${subject.id}:pyq-pack`,
      type: 'pyq',
      title: `${subject.name} — 15-Year PYQ Compilation`,
      subjectId: subject.id,
      description: 'All boards, all sets, sorted chapter-wise with solutions.',
      meta: `${subject.chapters.reduce((sum, chapter) => sum + chapter.pyqCount, 0)} questions`,
      updated: 'Today',
    },
  ]
}

export function resourcesOfType(resources: Resource[], type: ResourceType): Resource[] {
  const filtered = resources.filter((resource) => resource.type === type)
  return filtered.length ? filtered : resources.filter((resource) => resource.type === 'notes')
}

export { slugify }
