import type { Board, ClassOption, StreamOption, SubjectId } from '@/types'

export const BOARDS: Board[] = [
  {
    id: 'cbse',
    name: 'CBSE',
    short: 'CBSE',
    description: 'Central Board of Secondary Education — NCERT aligned.',
    classCount: 5,
    resourceCount: 4820,
  },
  {
    id: 'icse',
    name: 'ICSE',
    short: 'ICSE',
    description: 'Council for the Indian School Certificate Examinations.',
    classCount: 5,
    resourceCount: 2640,
  },
  {
    id: 'isc',
    name: 'ISC',
    short: 'ISC',
    description: 'Indian School Certificate — Class 11 & 12 focus.',
    classCount: 2,
    resourceCount: 1510,
  },
  {
    id: 'state-boards',
    name: 'State Boards',
    short: 'STATE',
    description: 'Maharashtra, Tamil Nadu, UP, WB, Karnataka and 15 more.',
    classCount: 5,
    resourceCount: 3980,
  },
  {
    id: 'other',
    name: 'Other',
    short: 'OTHER',
    description: 'IB, IGCSE, NIOS and open schooling curricula.',
    classCount: 4,
    resourceCount: 760,
  },
]

export const CLASSES: ClassOption[] = [
  { id: 'class-9', name: 'Class 9', description: 'Build the fundamentals', senior: false },
  { id: 'class-10', name: 'Class 10', description: 'First board examination', senior: false },
  { id: 'class-11', name: 'Class 11', description: 'Stream foundations', senior: true },
  { id: 'class-12', name: 'Class 12', description: 'Board year — everything on the line', senior: true },
  { id: 'other', name: 'Other', description: 'Diploma, entrance or custom syllabus', senior: true },
]

export const STREAMS: StreamOption[] = [
  {
    id: 'science',
    name: 'Science',
    description: 'Physics, Chemistry, Mathematics / Biology',
    subjects: ['physics', 'chemistry', 'mathematics', 'english', 'computer-science'],
  },
  {
    id: 'commerce',
    name: 'Commerce',
    description: 'Accountancy, Business Studies, Economics',
    subjects: ['english', 'mathematics'],
  },
  {
    id: 'humanities',
    name: 'Humanities',
    description: 'History, Political Science, Geography, Psychology',
    subjects: ['english'],
  },
]

/** Subject options offered during onboarding for the selected stream. */
export const SUBJECT_OPTIONS: { id: SubjectId; name: string; description: string }[] = [
  { id: 'physics', name: 'Physics', description: 'Mechanics to modern physics' },
  { id: 'chemistry', name: 'Chemistry', description: 'Physical, organic & inorganic' },
  { id: 'mathematics', name: 'Mathematics', description: 'Calculus, algebra, probability' },
  { id: 'english', name: 'English', description: 'Flamingo & Vistas core reader' },
  { id: 'computer-science', name: 'Computer Science', description: 'Python, SQL & networks' },
]

export function getBoard(id?: string): Board | undefined {
  return BOARDS.find((b) => b.id === id)
}

export function getClassOption(id?: string): ClassOption | undefined {
  return CLASSES.find((c) => c.id === id)
}

export function getStream(id?: string): StreamOption | undefined {
  return STREAMS.find((s) => s.id === id)
}
