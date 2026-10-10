/**
 * Shared AI-layer types (server side).
 *
 * The browser keeps a mirrored, browser-safe copy in `src/ai/types` — this
 * module must stay import-free so it can also be unit tested outside Deno.
 */

/* --------------------------------- modes ---------------------------------- */

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

/* --------------------------------- intents -------------------------------- */

/**
 * What the student is actually asking for. Detected server-side from the
 * message + mode (see prompts/intent.ts) so retrieval and the system prompt
 * can be chosen deliberately instead of hoping the model guesses.
 */
export const AI_INTENTS = [
  'concept',
  'solve',
  'hint',
  'exam_answer',
  'revision',
  'pyq',
  'formula',
  'reaction',
  'quiz',
  'flashcards',
  'similar',
  'mistake_review',
  'study_advice',
  'chat',
] as const

export type AIIntent = (typeof AI_INTENTS)[number]

/* -------------------------------- requests -------------------------------- */

export interface ChatFocus {
  subjectId?: string | null
  chapterId?: string | null
  subjectSlug?: string | null
  chapterSlug?: string | null
  difficulty?: 'Easy' | 'Moderate' | 'Hard' | null
  /** Structured follow-up action emitted by the answer cards in the UI. */
  action?: AIAction
  /** Which hint the student is on (hint mode is progressive). */
  hintIndex?: number
  /** Mistake id when the request is "explain my mistake". */
  mistakeId?: string | null
}

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

export interface ChatRequest {
  conversationId?: string | null
  message: string
  mode: AIMode
  focus?: ChatFocus
  regenerate?: boolean
  stream?: boolean
}

/* -------------------------------- responses ------------------------------- */

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
  /** `pyq` sources are real archive rows; `generated` marks AI-made material. */
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
  intent: AIIntent
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
  /** True when nothing in StudyOS matched — the model answered from general knowledge. */
  grounded: boolean
}

/* ------------------------------ student context --------------------------- */

export interface StudentContext {
  userId: string
  name: string | null
  board: string | null
  className: string | null
  stream: string | null
  boardId: string | null
  classId: string | null
  streamId: string | null
  targetExam: string | null
  examDate: string | null
  dailyGoalMinutes: number
  /** Focused subject/chapter for this conversation (may be null). */
  subjectId: string | null
  chapterId: string | null
  subject: string | null
  chapter: string | null
  weakChapters: Array<{ chapter: string; subject: string; accuracy: number | null }>
  recentMistakes: Array<{
    id: string
    question: string
    type: string
    chapter: string | null
    subject: string | null
  }>
  upcomingExams: Array<{ title: string; date: string; daysAway: number; subject: string | null }>
  activity: {
    minutesThisWeek: number
    questionsThisWeek: number
    accuracyThisWeek: number | null
    chaptersStudied: string[]
  }
}

/* -------------------------------- retrieval ------------------------------- */

export interface RetrievalFilters {
  boardId?: string | null
  classId?: string | null
  streamId?: string | null
  subjectId?: string | null
  chapterId?: string | null
  resourceType?: string | null
}

export interface RetrievedChunk {
  id: string
  content: string
  chunkIndex: number
  sectionTitle: string | null
  contentKind: string
  resourceId: string | null
  chapterId: string | null
  subjectId: string | null
  chapterName: string | null
  subjectName: string | null
  resourceTitle: string | null
  resourceType: string | null
  metadata: Record<string, unknown>
  score: number
}

export interface RetrievedPyq {
  id: string
  year: number
  examType: string
  questionText: string
  questionType: string
  paperSet: string
  marks: number
  difficulty: string
  concepts: string[]
  chapterId: string | null
  chapterName: string | null
  subjectId: string | null
  subjectName: string | null
}

/* ---------------------------------- tools --------------------------------- */

export type ToolName =
  | 'search_resources'
  | 'search_pyqs'
  | 'get_chapter'
  | 'get_formula'
  | 'get_user_progress'
  | 'get_user_mistakes'
  | 'get_upcoming_exams'
  | 'get_bookmarks'

export interface ToolCall {
  name: ToolName
  args: Record<string, unknown>
}

export interface ToolOutcome {
  name: ToolName
  label: string
  ok: boolean
  /** Compact, display-safe summary the prompt (and the UI) can use. */
  summary: string
  itemCount: number
  truncated: boolean
}

/* ------------------------------- generated -------------------------------- */

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
