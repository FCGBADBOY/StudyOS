import type { Exam } from '@/types'

/**
 * Upcoming exams. Dates are ISO (YYYY-MM-DD) so the countdown logic is
 * timezone-safe and ready to be swapped for API data later.
 */
export const EXAMS: Exam[] = [
  {
    id: 'exam-unit-test-3',
    name: 'Unit Test III — Physics & Chemistry',
    board: 'cbse',
    classId: 'class-12',
    date: '2026-10-21',
    subjects: ['physics', 'chemistry'],
    color: 'warning',
  },
  {
    id: 'exam-preboard-1',
    name: 'Pre-Board Examination',
    board: 'cbse',
    classId: 'class-12',
    date: '2026-12-08',
    subjects: ['physics', 'chemistry', 'mathematics', 'english', 'computer-science'],
    color: 'brand',
  },
  {
    id: 'exam-english',
    name: 'CBSE Class 12 — English Core',
    board: 'cbse',
    classId: 'class-12',
    date: '2027-02-17',
    subjects: ['english'],
    color: 'accent',
  },
  {
    id: 'exam-physics',
    name: 'CBSE Class 12 — Physics',
    board: 'cbse',
    classId: 'class-12',
    date: '2027-02-22',
    subjects: ['physics'],
    color: 'danger',
  },
  {
    id: 'exam-chemistry',
    name: 'CBSE Class 12 — Chemistry',
    board: 'cbse',
    classId: 'class-12',
    date: '2027-03-01',
    subjects: ['chemistry'],
    color: 'accent',
  },
  {
    id: 'exam-mathematics',
    name: 'CBSE Class 12 — Mathematics',
    board: 'cbse',
    classId: 'class-12',
    date: '2027-03-09',
    subjects: ['mathematics'],
    color: 'brand',
  },
]

/** The next exam that has not passed yet. */
export function nextExam(): Exam | undefined {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return EXAMS.filter((exam) => new Date(`${exam.date}T00:00:00`) >= now).sort(
    (a, b) => a.date.localeCompare(b.date),
  )[0]
}
