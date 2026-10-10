/**
 * Server-Sent Events plumbing for streaming AI replies.
 *
 * The edge function emits a tiny, typed event protocol that the browser
 * (`src/ai/providers/edge.provider.ts`) consumes:
 *
 *   status  → retrieval / tool status lines ("Searching StudyOS notes…")
 *   meta    → structured response metadata (sources, intent, confidence…)
 *   delta   → a chunk of answer text
 *   done    → completion payload (ids, usage, latency)
 *   error   → a client-safe error (never a raw provider error)
 *
 * When the client asks for JSON (`Accept: application/json` or `stream:false`)
 * the same generator is drained and returned as one document, so providers
 * that cannot stream degrade gracefully instead of breaking.
 */
import { corsHeaders } from './cors.ts'
import { toAppError, type AppError } from './http.ts'

export type AiEvent =
  | { type: 'status'; label: string }
  | { type: 'meta'; meta: unknown }
  | { type: 'delta'; text: string }
  | { type: 'done'; payload: unknown }
  | { type: 'error'; code: string; message: string }

function frame(event: AiEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export function wantsStream(request: Request, bodyWantsStream?: boolean): boolean {
  if (bodyWantsStream === false) return false
  const accept = request.headers.get('accept') ?? ''
  if (accept.includes('application/json') && !accept.includes('text/event-stream')) return false
  return true
}

/** Wrap an event generator in a streaming SSE response. */
export function sseResponse(request: Request, events: AsyncGenerator<AiEvent>): Response {
  const encoder = new TextEncoder()
  const aborted = { value: false }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const cleanup = () => {
        aborted.value = true
      }
      request.signal.addEventListener('abort', cleanup)
      try {
        controller.enqueue(encoder.encode(': studyos ai stream\n\n'))
        for await (const event of events) {
          if (aborted.value) break
          controller.enqueue(encoder.encode(frame(event)))
          if (event.type === 'done' || event.type === 'error') break
        }
      } catch (error) {
        const appError: AppError = toAppError(error)
        try {
          controller.enqueue(
            encoder.encode(
              frame({
                type: 'error',
                code: appError.code,
                message: appError.message,
              }),
            ),
          )
        } catch {
          /* client already gone — nothing to send */
        }
      } finally {
        request.signal.removeEventListener('abort', cleanup)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      aborted.value = true
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      ...corsHeaders(request),
    },
  })
}

/**
 * Drain the same generator into a single JSON document (non-streaming client).
 * The final `done` payload wins; earlier events are folded in.
 */
export async function collectEvents<T>(events: AsyncGenerator<AiEvent>): Promise<{
  meta?: unknown
  payload?: T
  status: string[]
  text: string
}> {
  const status: string[] = []
  let meta: unknown
  let text = ''
  let payload: T | undefined

  for await (const event of events) {
    if (event.type === 'status') status.push(event.label)
    else if (event.type === 'meta') meta = event.meta
    else if (event.type === 'delta') text += event.text
    else if (event.type === 'done') payload = event.payload as T
    else if (event.type === 'error') {
      throw Object.assign(new Error(event.message), { code: event.code })
    }
  }

  return { meta, payload, status, text }
}
