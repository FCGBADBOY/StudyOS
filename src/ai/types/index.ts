/**
 * Browser-safe mirror of the server AI contract
 * (`supabase/functions/_shared/ai/types.ts`).
 *
 * Keep this file free of imports — it is the shared vocabulary between the
 * streaming client, the services and the UI, and it must never reference a
 * server secret or an edge-only module.
 */

/* --------------------------------- modes ---------------------------------- */

/** The eight tutor modes. Switchable at any point inside a thread. */
export const AI_MODES = [
  'explain',
  'solve',
  'hint',
  '3-mark',
  '5-mark',
  'revise',
  'quiz',
  'simplify',
] as const

export type AIMode = (typeof AI_MODES)[number]

export function isAiMode(value: unknown): value is AIMode {
  return typeof value === 'string' && (AI_MODES as readonly string[]).includes(value)
}

/* -------------------------------- requests -------------------------------- */

/** Structured follow-ups the answer cards can emit (`focus.action`). */
export const AI_ACTIONS = [
  'explain_simpler',
  'give_example',
  'give_hint',
  'show_pyqs',
  'quiz_me',
  'make_flashcards',
  'next_hint',
  'reveal_solution',
  'save',
] as const

export type AIAction = (typeof AI_ACTIONS)[number]

export interface ChatFocus {
  subjectId?: string | null
  chapterId?: string | null
  subjectSlug?: string | null
  chapterSlug?: string | null
  difficulty?: 'Easy' | 'Moderate' | 'Hard' | null
  action?: AIAction
  /** Progressive hints: 0 = first nudge, 2 = almost-there. */
  hintIndex?: number
  mistakeId?: string | null
}

export interface ChatRequest {
  conversationId?: string | null
  message: string
  mode: AIMode
  focus?: ChatFocus
  regenerate?: boolean
}

/* ------------------------------- responses -------------------------------- */

export type SourceKind =
  | 'notes'
  | 'revision_notes'
  | 'formula_sheet'
  | 'important_questions'
  | 'sample_paper'
  | 'reference_material'
  | 'diagram'
  | 'video'
  | 'other'
  | 'pyq'
  | 'chapter'
  | 'book'

export interface Source {
  id: string
  kind: SourceKind
  title: string
  chapter?: string | null
  chapterSlug?: string | null
  subject?: string | null
  subjectSlug?: string | null
  board?: string | null
  className?: string | null
  page?: number | null
  section?: string | null
  year?: number | null
  marks?: number | null
  /** Short excerpt actually used for the answer (never invented). */
  excerpt?: string | null
  score?: number | null
  /** In-app route the source card links to. */
  href?: string | null
  /** `generated` marks AI-made practice material. */
  generated?: boolean
}

export type ResponseType =
  | 'answer'
  | 'hint'
  | 'pyq_list'
  | 'formula_list'
  | 'revision_plan'
  | 'mistake_analysis'
  | 'quiz'
  | 'flashcards'
  | 'similar_question'
  | 'greeting'
  | 'clarify'

export interface HintProgress {
  index: number
  total: number
  hasMore: boolean
}

export interface ResponseMeta {
  type: ResponseType
  intent: string
  mode: AIMode
  confidence: number
  sources: Source[]
  relatedQuestions: string[]
  subject?: string | null
  chapter?: string | null
  hint?: HintProgress
  /** Names of the internal tools that ran (shown as a status line). */
  tools: string[]
  retrievalUsed: boolean
  /** True when nothing in StudyOS matched — flag it instead of implying grounding. */
  grounded: boolean
  quiz?: QuizItem[]
  flashcards?: FlashcardItem[]
  similarQuestion?: { title: string; body: string; marks: number; difficulty?: string }
}

export interface ChatDonePayload {
  conversationId: string
  messageId: string | null
  latencyMs: number
  text: string
  meta: ResponseMeta
  usage: { inputTokens: number | null; outputTokens: number | null }
}

/* ------------------------------- stream events ---------------------------- */

export type ChatStreamEvent =
  | { type: 'status'; label: string }
  | { type: 'meta'; meta: ResponseMeta }
  | { type: 'delta'; text: string }
  | { type: 'done'; payload: ChatDonePayload }
  | { type: 'error'; code: string; message: string }

/* --------------------------------- generated ------------------------------ */

export interface QuizItem {
  id: string
  question: string
  options?: string[]
  answer: string
  explanation?: string
  marks: number
  difficulty: 'easy' | 'medium' | 'hard'
  source?: string
  generated: true
}

export interface FlashcardItem {
  id: string
  question: string
  answer: string
  difficulty: 'easy' | 'medium' | 'hard'
  source?: string
  generated: true
}

/* ------------------------------- conversations ---------------------------- */

export interface ConversationSummary {
  id: string
  title: string
  mode: AIMode | null
  subjectId: string | null
  chapterId: string | null
  messageCount: number
  updatedAt: string
  createdAt: string
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  mode: AIMode | null
  meta: Record<string, unknown> | null
  createdAt: string
}

/* -------------------------------- search ---------------------------------- */

export interface AiSearchResult {
  id: string
  kind: 'chunk' | 'pyq'
  title: string
  excerpt: string
  subject: string | null
  chapter: string | null
  score: number
  href: string | null
  generated?: boolean
  year?: number | null
  marks?: number | null
}

export interface AiSearchResponse {
  query: string
  results: AiSearchResult[]
  usedVector: boolean
  degraded: 'none' | 'keyword' | 'unavailable'
  latencyMs: number
}
