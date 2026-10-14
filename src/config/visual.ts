/**
 * ---------------------------------------------------------------------------
 * StudyOS visual vocabulary — the bridge between design tokens and components.
 * ---------------------------------------------------------------------------
 * `src/styles/index.css` owns the actual colour values. This module owns the
 * *meaning*: "what does the AI surface look like?", "what does Chemistry look
 * like?", "what does a warning look like?".
 *
 * Components must never hand-pick a colour class for a themed element — they
 * look it up here. That is what keeps a subject consistent across the chapter
 * card, the planner timeline, the progress ring and the resource tile, and it
 * means a palette change is a one-line edit rather than a hunt through pages.
 *
 * Every value is a Tailwind utility class built from a token, so dark mode
 * switches with the rest of the app for free.
 */

/**
 * The palette a theme draws from. These map 1:1 onto the `--color-*` tokens
 * declared in `index.css`.
 */
export type PaletteKey =
  | 'brand'
  | 'accent'
  | 'mint'
  | 'coral'
  | 'amber'
  | 'sky'
  | 'success'
  | 'warning'
  | 'danger'
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'english'
  | 'computer'
  | 'neutral'

/** How a theme is rendered — every themed component gets these five handles. */
export interface ThemeColors {
  /** Solid fill. Icon tiles, dots, progress fills. */
  solid: string
  /** Tinted fill. Icon-tile backgrounds, soft cards, chips. */
  soft: string
  /** Text/icon colour that is legible *on* `soft`. */
  onSoft: string
  /** Text/icon colour that is legible *on* `solid`. */
  onSolid: string
  /** Broad radial wash for hero panels and chapter headers. */
  field: string
  /**
   * Raw CSS variable for the theme's hue, for SVG fills/strokes and inline
   * styles. Note that `@theme inline` does *not* emit `--color-*` variables,
   * so this must point at the source token declared in `:root`.
   */
  accentVar: string
}

const PALETTES: Record<PaletteKey, ThemeColors> = {
  brand: {
    solid: 'bg-brand',
    soft: 'bg-brand-soft',
    onSoft: 'text-brand-soft-fg',
    onSolid: 'text-brand-fg',
    field: 'field-warm',
    accentVar: 'var(--brand)',
  },
  accent: {
    solid: 'bg-accent',
    soft: 'bg-accent-soft',
    onSoft: 'text-accent-fg',
    onSolid: 'text-white',
    field: 'field-chemistry',
    accentVar: 'var(--accent)',
  },
  mint: {
    solid: 'bg-mint',
    soft: 'bg-mint-soft',
    onSoft: 'text-mint-fg',
    onSolid: 'text-white',
    field: 'field-chemistry',
    accentVar: 'var(--mint)',
  },
  coral: {
    solid: 'bg-coral',
    soft: 'bg-coral-soft',
    onSoft: 'text-coral-fg',
    onSolid: 'text-white',
    field: 'field-english',
    accentVar: 'var(--coral)',
  },
  amber: {
    solid: 'bg-amber',
    soft: 'bg-amber-soft',
    onSoft: 'text-amber-fg',
    onSolid: 'text-white',
    field: 'field-mathematics',
    accentVar: 'var(--amber)',
  },
  sky: {
    solid: 'bg-sky',
    soft: 'bg-sky-soft',
    onSoft: 'text-sky-fg',
    onSolid: 'text-white',
    field: 'field-physics',
    accentVar: 'var(--sky)',
  },
  success: {
    solid: 'bg-success',
    soft: 'bg-success-soft',
    onSoft: 'text-success',
    onSolid: 'text-white',
    field: 'field-chemistry',
    accentVar: 'var(--success)',
  },
  warning: {
    solid: 'bg-warning',
    soft: 'bg-warning-soft',
    onSoft: 'text-warning',
    onSolid: 'text-white',
    field: 'field-mathematics',
    accentVar: 'var(--warning)',
  },
  danger: {
    solid: 'bg-danger',
    soft: 'bg-danger-soft',
    onSoft: 'text-danger',
    onSolid: 'text-white',
    field: 'field-english',
    accentVar: 'var(--danger)',
  },
  physics: {
    solid: 'bg-physics',
    soft: 'bg-physics-soft',
    onSoft: 'text-physics-fg',
    onSolid: 'text-white',
    field: 'field-physics',
    accentVar: 'var(--physics)',
  },
  chemistry: {
    solid: 'bg-chemistry',
    soft: 'bg-chemistry-soft',
    onSoft: 'text-chemistry-fg',
    onSolid: 'text-white',
    field: 'field-chemistry',
    accentVar: 'var(--chemistry)',
  },
  mathematics: {
    solid: 'bg-mathematics',
    soft: 'bg-mathematics-soft',
    onSoft: 'text-mathematics-fg',
    onSolid: 'text-white',
    field: 'field-mathematics',
    accentVar: 'var(--mathematics)',
  },
  english: {
    solid: 'bg-english',
    soft: 'bg-english-soft',
    onSoft: 'text-english-fg',
    onSolid: 'text-white',
    field: 'field-english',
    accentVar: 'var(--english)',
  },
  computer: {
    solid: 'bg-computer',
    soft: 'bg-computer-soft',
    onSoft: 'text-computer-fg',
    onSolid: 'text-white',
    field: 'field-computer',
    accentVar: 'var(--computer)',
  },
  neutral: {
    solid: 'bg-surface-sunken',
    soft: 'bg-surface-muted',
    onSoft: 'text-muted',
    onSolid: 'text-foreground',
    field: 'field-warm',
    accentVar: 'var(--border-strong)',
  },
}

/**
 * Semantic themes. A surface picks the one that matches *what it is for*, not
 * the colour it happens to be — so re-branding the AI surface later is one edit.
 */
export type ThemeKey =
  /* functional surfaces */
  | 'ai'
  | 'scan'
  | 'pyq'
  | 'formula'
  | 'mistakes'
  | 'reaction'
  | 'library'
  | 'planner'
  | 'progress'
  | 'notes'
  | 'quiz'
  | 'paper'
  | 'flashcard'
  | 'video'
  | 'external'
  | 'diagram'
  | 'reference'
  | 'revision'
  | 'other'
  | 'search'
  | 'profile'
  | 'settings'
  | 'exam'
  | 'streak'
  /* subjects — matched by subject id or slug */
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'english'
  | 'computer'
  | 'general'
  /* standalone palette hues, so any surface can pick a colour by name */
  | 'sky'
  | 'coral'
  | 'amber'
  | 'mint'
  /* status */
  | 'success'
  | 'warning'
  | 'danger'
  | 'brand'
  | 'neutral'

/**
 * Ring class per palette — declared literally so Tailwind's source scanner
 * sees it (never build these with string concatenation).
 */
const RINGS: Record<PaletteKey, string> = {
  brand: 'ring-brand/30',
  accent: 'ring-accent/30',
  mint: 'ring-mint/30',
  coral: 'ring-coral/30',
  amber: 'ring-amber/30',
  sky: 'ring-sky/30',
  success: 'ring-success/30',
  warning: 'ring-warning/30',
  danger: 'ring-danger/30',
  physics: 'ring-physics/30',
  chemistry: 'ring-chemistry/30',
  mathematics: 'ring-mathematics/30',
  english: 'ring-english/30',
  computer: 'ring-computer/30',
  neutral: 'ring-border-strong',
}

/** Low-emphasis ring for a themed surface (focus rings, selection halos). */
export function themeRing(theme: ThemeKey): string {
  return RINGS[THEME_TO_PALETTE[theme] ?? 'brand']
}

/** Semantic theme → palette. */
const THEME_TO_PALETTE: Record<ThemeKey, PaletteKey> = {
  ai: 'brand',
  scan: 'mint',
  pyq: 'amber',
  formula: 'amber',
  mistakes: 'coral',
  reaction: 'accent',
  library: 'sky',
  planner: 'sky',
  progress: 'mint',
  notes: 'sky',
  quiz: 'accent',
  paper: 'amber',
  flashcard: 'sky',
  video: 'coral',
  external: 'neutral',
  diagram: 'accent',
  reference: 'brand',
  revision: 'amber',
  other: 'neutral',
  search: 'brand',
  profile: 'coral',
  settings: 'sky',
  exam: 'amber',
  streak: 'coral',

  physics: 'physics',
  chemistry: 'chemistry',
  mathematics: 'mathematics',
  english: 'english',
  computer: 'computer',
  general: 'brand',

  sky: 'sky',
  coral: 'coral',
  amber: 'amber',
  mint: 'mint',

  success: 'success',
  warning: 'warning',
  danger: 'danger',
  brand: 'brand',
  neutral: 'neutral',
}

/** Resolve a semantic theme to its palette classes. */
export function themeColors(theme: ThemeKey): ThemeColors {
  return PALETTES[THEME_TO_PALETTE[theme] ?? 'brand']
}

/**
 * Subject identity by id/slug. Anything unrecognised falls back to `general`,
 * so the app never renders an un-themed element when a new subject is added by
 * the content team.
 */
const SUBJECT_ALIASES: Record<string, ThemeKey> = {
  physics: 'physics',
  'physical-science': 'physics',
  chemistry: 'chemistry',
  maths: 'mathematics',
  math: 'mathematics',
  mathematics: 'mathematics',
  english: 'english',
  'english-core': 'english',
  'computer-science': 'computer',
  cs: 'computer',
  informatics: 'computer',
  biology: 'chemistry',
  'political-science': 'english',
  economics: 'mathematics',
  history: 'english',
  geography: 'general',
}

/** Best-effort subject theme for an id/slug/label. */
export function subjectTheme(subject?: string | null): ThemeKey {
  if (!subject) return 'general'
  const key = subject.trim().toLowerCase().replace(/\s+/g, '-')
  return SUBJECT_ALIASES[key] ?? SUBJECT_ALIASES[key.replace(/-/g, '')] ?? 'general'
}

/**
 * Resource type → theme. Drives the Library card treatment so a Formula Sheet
 * is recognisable at a glance without reading its label.
 */
const RESOURCE_THEMES: Record<string, ThemeKey> = {
  notes: 'notes',
  'revision-notes': 'revision',
  'formula-sheet': 'formula',
  'important-questions': 'quiz',
  'sample-paper': 'paper',
  diagram: 'diagram',
  'reference-material': 'reference',
  video: 'video',
  other: 'other',
  pyq: 'pyq',
  quiz: 'quiz',
  flashcard: 'flashcard',
  reaction: 'reaction',
  external: 'external',
  resource: 'notes',
}

export function resourceTheme(type?: string | null): ThemeKey {
  if (!type) return 'other'
  const key = type.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return RESOURCE_THEMES[key] ?? RESOURCE_THEMES[key.replace(/-/g, '')] ?? 'other'
}

/**
 * Mistake severity → theme. Deliberately warm rather than alarming: a mistake
 * is information, not a failure.
 */
export function severityTheme(kind?: string | null): ThemeKey {
  switch ((kind ?? '').toLowerCase()) {
    case 'concept':
      return 'brand'
    case 'calculation':
      return 'amber'
    case 'formula':
      return 'mathematics'
    case 'careless':
      return 'coral'
    default:
      return 'neutral'
  }
}
