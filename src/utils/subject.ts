import type { SubjectId } from '@/types'
import { subjectTheme, themeColors, themeRing, type ThemeKey } from '@/config/visual'

/**
 * Per-subject accent utilities.
 *
 * The colour values live in `src/styles/index.css` and are resolved through the
 * shared theme vocabulary (`@/config/visual`), so a subject looks identical
 * here, in a chapter card, in the planner timeline and in a progress ring.
 */
export interface SubjectAccent {
  /** Readable-on-tint foreground. Use for labels and initials. */
  text: string
  /** Soft tinted ground. */
  soft: string
  /** Saturated fill — dots, rails, chart bars. */
  solid: string
  /** Ring colour at low emphasis. */
  ring: string
  /** The semantic theme key, for passing to IconTile / Illustration / Badge. */
  theme: ThemeKey
}

const CACHE = new Map<string, SubjectAccent>()

export function subjectAccent(id?: string): SubjectAccent {
  const key = (id ?? 'physics').toLowerCase()
  const cached = CACHE.get(key)
  if (cached) return cached

  const theme = subjectTheme(key)
  const c = themeColors(theme)
  const accent: SubjectAccent = {
    text: c.onSoft,
    soft: c.soft,
    solid: c.solid,
    ring: themeRing(theme),
    theme,
  }
  CACHE.set(key, accent)
  return accent
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
