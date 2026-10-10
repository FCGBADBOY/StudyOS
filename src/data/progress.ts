import type { ProgressReport } from '@/types'

/**
 * Analytics payload for the progress dashboard.
 * `daily` sums to 742 minutes / 386 questions — the same figures the
 * dashboard snapshot shows, so the product reads as internally consistent.
 */
export const PROGRESS_REPORT: ProgressReport = {
  weekMinutes: 742,
  weekMinutesTrend: 12,
  questionsSolved: 386,
  questionsTrend: 9,
  averageAccuracy: 78,
  accuracyTrend: 6,
  chaptersCompleted: 7,
  streak: 12,
  daily: [
    { day: 'Mon', minutes: 95, questions: 42 },
    { day: 'Tue', minutes: 120, questions: 58 },
    { day: 'Wed', minutes: 60, questions: 30 },
    { day: 'Thu', minutes: 140, questions: 64 },
    { day: 'Fri', minutes: 110, questions: 51 },
    { day: 'Sat', minutes: 157, questions: 76 },
    { day: 'Sun', minutes: 60, questions: 65 },
  ],
  subjectStats: [
    { subjectId: 'physics', subjectName: 'Physics', accuracy: 74, questions: 1284, minutes: 1840, trend: 4 },
    { subjectId: 'chemistry', subjectName: 'Chemistry', accuracy: 81, questions: 1396, minutes: 1720, trend: 6 },
    { subjectId: 'mathematics', subjectName: 'Mathematics', accuracy: 68, questions: 1642, minutes: 2160, trend: -2 },
    { subjectId: 'english', subjectName: 'English', accuracy: 88, questions: 486, minutes: 520, trend: 1 },
    { subjectId: 'computer-science', subjectName: 'Computer Science', accuracy: 79, questions: 612, minutes: 640, trend: 3 },
  ],
  strongest: [
    { topic: 'Electrostatics', subjectId: 'physics', value: 92 },
    { topic: 'Haloalkanes and Haloarenes', subjectId: 'chemistry', value: 96 },
    { topic: 'The Last Lesson', subjectId: 'english', value: 98 },
    { topic: 'Matrices', subjectId: 'mathematics', value: 88 },
  ],
  weakest: [
    { topic: 'Probability', subjectId: 'mathematics', value: 22 },
    { topic: 'Coordination Compounds', subjectId: 'chemistry', value: 30 },
    { topic: 'Wave Optics', subjectId: 'physics', value: 32 },
    { topic: 'Integrals', subjectId: 'mathematics', value: 34 },
  ],
  rings: [
    { label: 'Syllabus covered', value: 58, color: 'brand' },
    { label: 'Weekly goal', value: 74, color: 'accent' },
    { label: 'PYQ completion', value: 41, color: 'warning' },
  ],
  monthlyGoalMinutes: 3000,
  completedGoalMinutes: 2380,
}
