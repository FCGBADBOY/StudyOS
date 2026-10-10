/**
 * Browser-side provider contract.
 *
 * The real provider (OpenAI / Gemini / Anthropic) is only ever reachable from
 * the edge functions — the browser has no keys, no SDK and no direct model
 * access. All it knows is:
 *
 *   stream(chat, handlers, signal)  → SSE text/status/meta/done events
 *   post(fn, body, signal)          → one JSON document (search, quiz, admin…)
 *
 * Swapping the server-side provider never touches this file; adding a second
 * *client* transport (e.g. a websocket) would be done here.
 */
import type { ChatRequest, ChatStreamEvent } from '@/ai/types'

export interface StreamHandlers {
  onEvent?: (event: ChatStreamEvent) => void
  onStatus?: (label: string) => void
  onMeta?: (meta: Extract<ChatStreamEvent, { type: 'meta' }>['meta']) => void
  onDelta?: (text: string) => void
  onDone?: (payload: Extract<ChatStreamEvent, { type: 'done' }>['payload']) => void
  onError?: (error: AiError) => void
}

export interface AiProviderClient {
  readonly name: string
  /** Stream one chat turn. Resolves with the final payload (or `null` on abort). */
  stream(request: ChatRequest, handlers?: StreamHandlers, signal?: AbortSignal): Promise<StreamResult>
  /** POST a JSON body to an edge function and read the JSON reply. */
  post<T>(functionName: string, body?: unknown, signal?: AbortSignal): Promise<T>
}

export interface StreamResult {
  text: string
  meta: Extract<ChatStreamEvent, { type: 'meta' }>['meta'] | null
  payload: Extract<ChatStreamEvent, { type: 'done' }>['payload'] | null
}

/** Client-safe failure. `code` matches the server's `AppError` codes. */
export class AiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 0) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
  }
}

/** Friendly copy per failure code — never show a raw provider message. */
export const AI_ERROR_COPY: Record<string, string> = {
  no_provider: 'The AI tutor is not configured on this deployment yet. Everything else in StudyOS still works.',
  rate_limited: 'You have hit today’s AI limit. It resets at midnight — your notes and progress keep working.',
  unauthorized: 'Please sign in again to use the AI tutor.',
  forbidden: 'You do not have permission to use this AI feature.',
  invalid_request: 'That request was not valid. Try rephrasing it.',
  timeout: 'The tutor took too long to answer. Try a shorter question.',
  unavailable: 'The AI provider is temporarily unavailable. Try again in a moment.',
  model_error: 'The model returned something unexpected. Try again.',
  aborted: 'Generation stopped.',
  network: 'We could not reach the tutor. Check your connection and try again.',
  no_embedding_provider: 'Semantic search is not configured on this deployment, so keyword search is being used.',
}

export function friendlyAiError(error: unknown): string {
  if (error instanceof AiError) return AI_ERROR_COPY[error.code] ?? error.message
  if (error instanceof Error && /abort/i.test(error.name)) return AI_ERROR_COPY.aborted
  return AI_ERROR_COPY.network
}
