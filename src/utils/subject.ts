import type { SubjectId } from '@/types'

/**
 * Per-subject accent utilities. Colours come from the design tokens so they
 * stay consistent (and theme-aware) across every card in the app.
 */
export interface SubjectAccent {
  text: string
  soft: string
  solid: string
  ring: string
}

const ACCENTS: Record<SubjectId, SubjectAccent> = {
  physics: { text: 'text-physics', soft: 'bg-physics/10', solid: 'bg-physics', ring: 'ring-physics/30' },
  chemistry: {
    text: 'text-chemistry',
    soft: 'bg-chemistry/10',
    solid: 'bg-chemistry',
    ring: 'ring-chemistry/30',
  },
  mathematics: {
    text: 'text-mathematics',
    soft: 'bg-mathematics/10',
    solid: 'bg-mathematics',
    ring: 'ring-mathematics/30',
  },
  english: { text: 'text-english', soft: 'bg-english/10', solid: 'bg-english', ring: 'ring-english/30' },
  'computer-science': {
    text: 'text-computer',
    soft: 'bg-computer/10',
    solid: 'bg-computer',
    ring: 'ring-computer/30',
  },
}

export function subjectAccent(id?: string): SubjectAccent {
  return ACCENTS[(id ?? 'physics') as SubjectId] ?? ACCENTS.physics
}

export function subjectInitial(id?: string): string {
  const map: Record<string, string> = {
    physics: 'Ph',
    chemistry: 'Ch',
    mathematics: 'Ma',
    english: 'En',
    'computer-science': 'CS',
  }
  return map[id ?? ''] ?? 'St'
}

/** Difficulty → tone mapping used consistently on chapter/question cards. */
export function difficultyTone(difficulty: string): 'success' | 'warning' | 'danger' {
  switch (difficulty) {
    case 'Easy':
      return 'success'
    case 'Moderate':
    case 'Medium':
      return 'warning'
    default:
      return 'danger'
  }
}
