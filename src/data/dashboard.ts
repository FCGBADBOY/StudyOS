import type { ContinueItem, ProgressSnapshot, QuickAction, TodayFocus } from '@/types'
import { ALL_CHAPTERS, getSubject } from './subjects'

/** Personalised "Today's Study" recommendation. */
export const TODAY_FOCUS: TodayFocus = {
  id: 'focus-nernst',
  title: 'Electrochemistry — Nernst Equation',
  subjectId: 'chemistry',
  subjectName: 'Chemistry',
  minutes: 32,
  difficulty: 'Moderate',
  progress: 45,
  reason: 'Repeated 8 times in the last 10 years of board papers.',
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'ask-ai', label: 'Ask AI', hint: 'Doubts, instant', to: '/ai-tutor', icon: 'sparkles' },
  { id: 'scan', label: 'Scan Question', hint: 'Camera or gallery', to: '/ai-tutor', icon: 'scan' },
  { id: 'pyq', label: 'PYQs', hint: '18,642 solved', to: '/pyq', icon: 'file-text' },
  { id: 'formula', label: 'Formula Sheet', hint: 'All subjects', to: '/formula-flow', icon: 'sigma' },
  { id: 'mistakes', label: 'MistakeBook', hint: '17 to revise', to: '/mistakebook', icon: 'book-marked' },
]

export const CONTINUE_STUDYING: ContinueItem[] = [
  {
    id: 'continue-1',
    subjectId: 'chemistry',
    subjectName: 'Chemistry',
    chapterSlug: 'alcohols-phenols-and-ethers',
    chapter: 'Alcohols, Phenols and Ethers',
    progress: 60,
    lastStudied: '2 hours ago',
    minutesLeft: 48,
  },
  {
    id: 'continue-2',
    subjectId: 'physics',
    subjectName: 'Physics',
    chapterSlug: 'electromagnetic-induction',
    chapter: 'Electromagnetic Induction',
    progress: 45,
    lastStudied: 'Yesterday',
    minutesLeft: 65,
  },
  {
    id: 'continue-3',
    subjectId: 'mathematics',
    subjectName: 'Mathematics',
    chapterSlug: 'integrals',
    chapter: 'Integrals',
    progress: 30,
    lastStudied: '2 days ago',
    minutesLeft: 120,
  },
  {
    id: 'continue-4',
    subjectId: 'computer-science',
    subjectName: 'Computer Science',
    chapterSlug: 'computer-networks',
    chapter: 'Computer Networks',
    progress: 30,
    lastStudied: '3 days ago',
    minutesLeft: 55,
  },
]

export const PROGRESS_SNAPSHOT: ProgressSnapshot = {
  weekMinutes: 742,
  questionsSolved: 386,
  accuracy: 78,
  streak: 12,
}

export interface WeakChapter {
  id: string
  subjectId: string
  subjectName: string
  chapter: string
  slug: string
  progress: number
  accuracy: number
}

/**
 * Weakest chapters across subjects — chapters explicitly flagged as weak plus
 * the lowest-progress chapters, capped at four for the dashboard.
 */
export function getWeakChapters(limit = 4): WeakChapter[] {
  const flagged = ALL_CHAPTERS.filter((row) => row.chapter.weak)
    .map(({ subject, chapter }) => ({
      id: chapter.id,
      subjectId: subject.id,
      subjectName: subject.name,
      chapter: chapter.title,
      slug: chapter.slug,
      progress: chapter.progress,
      accuracy: Math.max(38, Math.round(subject.accuracy * (0.55 + chapter.progress / 300))),
    }))
    .sort((a, b) => a.progress - b.progress)

  if (flagged.length >= limit) return flagged.slice(0, limit)

  const fillers = ALL_CHAPTERS.filter((row) => !row.chapter.weak && row.chapter.progress < 55)
    .sort((a, b) => a.chapter.progress - b.chapter.progress)
    .slice(0, limit - flagged.length)
    .map(({ subject, chapter }) => ({
      id: chapter.id,
      subjectId: subject.id,
      subjectName: subject.name,
      chapter: chapter.title,
      slug: chapter.slug,
      progress: chapter.progress,
      accuracy: Math.max(40, Math.round(subject.accuracy * (0.6 + chapter.progress / 300))),
    }))

  return [...flagged, ...fillers].slice(0, limit)
}

/** Per-subject roll-up used on the dashboard chips. */
export function subjectSummaries() {
  return ['physics', 'chemistry', 'mathematics'].map((id) => {
    const subject = getSubject(id)
    return subject
      ? {
          id: subject.id,
          name: subject.name,
          progress: subject.progress,
          accuracy: subject.accuracy,
        }
      : null
  }).filter(Boolean)
}
