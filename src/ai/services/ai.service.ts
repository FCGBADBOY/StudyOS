/**
 * AI service layer — the only module the UI calls for AI features.
 *
 * Rules:
 *  - no provider keys here (or anywhere in the browser): every call is an
 *    edge function invoked with the student's own JWT;
 *  - failures surface as `AiError` with a safe code — components render
 *    `friendlyAiError()` copy, never a raw provider message;
 *  - streaming is the default (`streamChat`), JSON endpoints are used for the
 *    structured features (search / quiz / flashcards / similar / admin).
 */
import { AiError, friendlyAiError, type StreamHandlers } from '@/ai/providers/provider.interface'
import { edgeProvider } from '@/ai/providers/edge.provider'
import { isDemo, db } from '@/services/shared'
import type {
  AiSearchResponse,
  ChatRequest,
  FlashcardItem,
  QuizItem,
  ResponseMeta,
} from '@/ai/types'

export { AiError, friendlyAiError }

/** `true` when a backend (and therefore an AI edge function) exists. */
export const aiAvailable = !isDemo

export interface QuizGeneration {
  id: string | null
  title: string
  items: QuizItem[]
  subjectId: string | null
  chapterId: string | null
  difficulty: string
}

export interface FlashcardGeneration {
  id: string | null
  title: string
  cards: FlashcardItem[]
  subjectId: string | null
  chapterId: string | null
  sourceType: string
}

export interface SimilarQuestion {
  question: string
  answer: string
  approach: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  marks: number
  sources: ResponseMeta['sources']
}

function guard(): void {
  if (!aiAvailable) {
    throw new AiError('no_provider', 'The AI tutor needs a backend connection.')
  }
}

/**
 * Stream one tutor turn.
 *
 * Resolves with the completed payload; `handlers` receive status lines, the
 * metadata block (sources arrive *before* the text), each delta and the final
 * `done`. Aborting `signal` stops generation server-side too.
 */
export async function streamChat(
  request: ChatRequest,
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
) {
  guard()
  return edgeProvider.stream(request, handlers, signal)
}

/** Hybrid retrieval without generation (library search, "find sources"). */
export async function searchAi(
  query: string,
  options: { subjectId?: string | null; chapterId?: string | null; includePyqs?: boolean; limit?: number } = {},
  signal?: AbortSignal,
): Promise<AiSearchResponse & { sources: ResponseMeta['sources'] }> {
  guard()
  return edgeProvider.post<AiSearchResponse & { sources: ResponseMeta['sources'] }>(
    'ai-search',
    {
      query,
      subjectId: options.subjectId ?? null,
      chapterId: options.chapterId ?? null,
      includePyqs: options.includePyqs ?? true,
      limit: options.limit ?? 8,
    },
    signal,
  )
}

export interface QuizSpec {
  subjectId?: string | null
  chapterId?: string | null
  difficulty?: 'easy' | 'medium' | 'hard'
  count?: number
  questionType?: 'mcq' | 'short_answer' | 'numerical' | 'mixed'
  save?: boolean
}

/** AI-GENERATED PRACTICE quiz, grounded in retrieved StudyOS content. */
export async function generateQuiz(spec: QuizSpec = {}, signal?: AbortSignal): Promise<QuizGeneration> {
  guard()
  const response = await edgeProvider.post<{ quiz: QuizGeneration }>('ai-quiz', spec, signal)
  return response.quiz
}

export async function generateFlashcards(
  input: { subjectId?: string | null; chapterId?: string | null; query: string; source?: string },
  signal?: AbortSignal,
): Promise<FlashcardGeneration> {
  guard()
  const response = await edgeProvider.post<{ deck: FlashcardGeneration }>('ai-flashcards', input, signal)
  return response.deck
}

/** A similar practice question derived from a PYQ or a solved question. */
export async function similarQuestion(
  input: { question: string; subjectId?: string | null; chapterId?: string | null },
  signal?: AbortSignal,
): Promise<SimilarQuestion> {
  guard()
  const response = await edgeProvider.post<{ similar: SimilarQuestion }>('ai-similar-question', input, signal)
  return response.similar
}

/** Image/question solver: streams the worked solution (server-side checks
 *  image legibility first and fails with `image_unreadable` instead of
 *  guessing; images live in memory for that request only). */
export async function solveQuestion(
  input: {
    question?: string
    imageBase64?: string
    mimeType?: string
    conversationId?: string | null
    subjectId?: string | null
    chapterId?: string | null
  },
  signal?: AbortSignal,
  handlers: StreamHandlers = {},
) {
  guard()
  return edgeProvider.post<{
    text: string
    meta: ResponseMeta | null
    conversationId?: string
    messageId?: string | null
  }>(
    'ai-question-solver',
    {
      question: (input.question ?? '').slice(0, 4000) || undefined,
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      conversationId: input.conversationId ?? null,
      subjectId: input.subjectId ?? null,
      chapterId: input.chapterId ?? null,
      stream: false,
    },
    signal,
  ).then((result) => {
    handlers.onDelta?.(result.text)
    if (result.meta) handlers.onMeta?.(result.meta)
    return result
  })
}

/* ------------------------------- admin ------------------------------------ */

export interface AiAnalytics {
  window: string
  generatedAt: string
  usage: {
    totalRequests: number
    totalInputTokens: number
    totalOutputTokens: number
    estimatedCostUsd: number
    byFeature: Record<string, { requests: number; inputTokens: number; outputTokens: number }>
  }
  reliability: {
    events: number
    byStatus: Record<string, number>
    errorsByCode: Record<string, number>
    providers: Record<string, number>
    latencyMs: { p50: number; p95: number; max: number }
  }
  retrieval: {
    used: number
    groundedAnswers: number
    ungroundedAnswers: number
    averageSources: number
    chunksIndexed: number
    support: {
      embeddingModel: string
      embeddingDim: number
      configured: boolean
      toolPlanning: string
      topK: number
    }
  }
  questions: { byType: Record<string, number> }
  conversations: { threads: number; messages: number }
  embeddings: {
    jobs: { pending: number; processing: number; completed: number; failed: number }
    failures: Array<Record<string, unknown>>
  }
  limits: {
    dailyRequestsPerUser: number
    dailyRequestsPerFeature: number
    requestTimeoutMs: number
    maxOutputTokens: number
  }
}

export interface EmbeddingStatus {
  queue: { pending: number; processing: number; completed: number; failed: number }
  chunks: number
  failures: Array<Record<string, unknown>>
  jobs: Array<Record<string, unknown>>
  provider: string
  embeddingModel: string
  configured: boolean
  expectedDimension: number
}

/** Admin → AI aggregates (staff only; the edge function re-checks permission). */
export async function getAiAnalytics(signal?: AbortSignal): Promise<AiAnalytics> {
  guard()
  return edgeProvider.post<AiAnalytics>('ai-admin', { action: 'analytics' }, signal)
}

/** Admin → embeddings pipeline: queue summary + failures. */
export async function getEmbeddingStatus(signal?: AbortSignal): Promise<EmbeddingStatus> {
  guard()
  return edgeProvider.post<EmbeddingStatus>('ai-embeddings', { action: 'status' }, signal)
}

/** Retry every failed embedding job (optionally one target). */
export async function retryFailedJobs(scope?: {
  scope?: 'resource' | 'chapter' | 'rebuild_all'
  resourceId?: string
  chapterId?: string
}): Promise<{ requeued: number }> {
  guard()
  return edgeProvider.post<{ requeued: number }>('ai-admin', { action: 'retry_failed', ...scope })
}

/** Drop stored chunks for a target and enqueue a fresh indexing pass. */
export async function rebuildIndex(target: {
  scope: 'resource' | 'chapter' | 'rebuild_all'
  resourceId?: string
  chapterId?: string
}): Promise<{ cleared: boolean; enqueued: number; scope: string }> {
  guard()
  return edgeProvider.post<{ cleared: boolean; enqueued: number; scope: string }>('ai-admin', {
    action: 'rebuild',
    ...target,
  })
}

/** Process queued embedding jobs (staff-triggered "Run now"). */
export async function runEmbeddingQueue(limit = 6): Promise<{
  completed: number
  failed: number
  skipped: number
  chunksWritten: number
  pending: number
  dimension: number
}> {
  guard()
  return edgeProvider.post('ai-embeddings', { action: 'run', limit })
}

/** Today's own quota, so the composer can warn before a rate-limit error. */
export async function getUsageToday(): Promise<
  Array<{ feature: string; requests: number; input_tokens: number; output_tokens: number }>
> {
  const client = db()
  if (!client) return []
  try {
    const { data, error } = await client.rpc('ai_usage_today')
    if (error) return []
    return (data ?? []) as Array<{ feature: string; requests: number; input_tokens: number; output_tokens: number }>
  } catch {
    return []
  }
}
