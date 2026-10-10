/**
 * Edge transport — the *only* way the browser talks to a model.
 *
 * Everything goes through Supabase Edge Functions with the user's JWT; the
 * anon key lives in `VITE_SUPABASE_ANON_KEY` (public by design, protected by
 * RLS). Provider secrets and the service-role key stay server-side.
 *
 * `ai-chat` answers with `text/event-stream`:
 *
 *   status → "Searching StudyOS library"
 *   meta   → sources, intent, confidence (arrives *before* the text)
 *   delta  → incremental answer text
 *   done   → ids + usage
 *   error  → client-safe code/message
 */
import { supabase } from '@/lib/supabase'
import { parseFrame } from './sse'
import { AiError, type AiProviderClient, type StreamHandlers, type StreamResult } from './provider.interface'
import type { ChatRequest } from '@/ai/types'

const FUNCTIONS_BASE = (): string => {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  return url ? `${url.replace(/\/$/, '')}/functions/v1` : '/functions/v1'
}

/** Anon key (public) + current user JWT. Never a service-role key. */
async function authHeaders(extra: Record<string, string> = {}): Promise<Headers> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
    ...extra,
  })
  const token = await accessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function raiseForStatus(response: Response): Promise<never> {
  let code = 'unavailable'
  let message = 'The AI service is unavailable.'
  try {
    const body = (await response.json()) as { code?: string; message?: string; error?: string }
    code = body.code ?? body.error ?? code
    message = body.message ?? message
  } catch {
    /* non-JSON error body (proxy/HTML) — keep the generic copy */
  }
  if (response.status === 401) code = 'unauthorized'
  if (response.status === 403) code = 'forbidden'
  if (response.status === 429) code = 'rate_limited'
  if (response.status === 503 && code === 'unavailable') code = 'no_provider'
  throw new AiError(code, message, response.status)
}

/** POST JSON to an edge function and decode the JSON document reply. */
async function postJson<T>(functionName: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${FUNCTIONS_BASE()}/${functionName}`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body ?? {}),
      signal: signal ?? null,
    })
  } catch (error) {
    if (signal?.aborted) throw new AiError('aborted', 'Request cancelled')
    throw new AiError('network', error instanceof Error ? error.message : 'Network error')
  }
  if (!response.ok) await raiseForStatus(response)
  return (await response.json()) as T
}

/** POST JSON to an edge function and decode SSE frames as they arrive. */
async function postStream(
  functionName: string,
  body: unknown,
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
): Promise<StreamResult> {
  const controller = new AbortController()
  const externalAbort = () => controller.abort()
  signal?.addEventListener('abort', externalAbort)
  const timeout = window.setTimeout(() => controller.abort(), 120_000)

  let response: Response
  try {
    response = await fetch(`${FUNCTIONS_BASE()}/${functionName}`, {
      method: 'POST',
      headers: await authHeaders({ Accept: 'text/event-stream' }),
      body: JSON.stringify({ ...(typeof body === 'object' && body !== null ? body : {}), stream: true }),
      signal: controller.signal,
    })
  } catch (error) {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', externalAbort)
    if (signal?.aborted) throw new AiError('aborted', 'Generation stopped')
    throw new AiError('network', error instanceof Error ? error.message : 'Network error')
  }

  if (!response.ok) {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', externalAbort)
    await raiseForStatus(response)
  }

  const result: StreamResult = { text: '', meta: null, payload: null }
  const reader = response.body?.getReader()
  if (!reader) {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', externalAbort)
    return result
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        dispatchFrame(frame, result, handlers)
        boundary = buffer.indexOf('\n\n')
      }
    }
    // Anything still buffered is a final (possibly un-terminated) frame.
    if (buffer.trim()) dispatchFrame(buffer, result, handlers)
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new AiError('timeout', 'Generation timed out')
    }
    if (signal?.aborted) throw new AiError('aborted', 'Generation stopped')
    throw new AiError('network', error instanceof Error ? error.message : 'Stream interrupted')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', externalAbort)
    reader.releaseLock?.()
  }

  return result
}

/** Parse one SSE frame and forward it to the handlers. */
function dispatchFrame(frame: string, result: StreamResult, handlers: StreamHandlers): void {
  const event = parseFrame(frame)
  if (!event) return // comment / malformed frame — ignore rather than break the stream

  handlers.onEvent?.(event)

  switch (event.type) {
    case 'status':
      handlers.onStatus?.(event.label)
      break
    case 'meta':
      result.meta = event.meta
      handlers.onMeta?.(event.meta)
      break
    case 'delta':
      result.text += event.text
      handlers.onDelta?.(event.text)
      break
    case 'done':
      result.payload = event.payload
      result.text = event.payload.text || result.text
      result.meta = event.payload.meta ?? result.meta
      handlers.onDone?.(event.payload)
      break
    case 'error': {
      const error = new AiError(event.code, event.message)
      handlers.onError?.(error)
      // A mid-stream error keeps the partial text: `done` may still follow.
      break
    }
  }
}

/** The single client the AI UI uses. */
export const edgeProvider: AiProviderClient = {
  name: 'supabase-edge',
  stream: (request: ChatRequest, handlers?: StreamHandlers, signal?: AbortSignal) =>
    postStream('ai-chat', request, handlers, signal),
  post: <T>(functionName: string, body?: unknown, signal?: AbortSignal) =>
    postJson<T>(functionName, body, signal),
}
