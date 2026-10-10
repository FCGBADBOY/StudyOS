/**
 * Pure SSE frame parser for the AI stream protocol (no browser APIs, no
 * imports — unit-testable outside a bundler).
 *
 * Wire format (see `supabase/functions/_shared/sse.ts`):
 *
 *   event: delta
 *   data: {"type":"delta","text":"…"}
 *
 *   (frames are separated by a blank line; comment lines start with ":")
 */
import type { ChatStreamEvent } from '@/ai/types'

/** Parse a single `event:`/`data:` frame into a typed event (or `null`). */
export function parseFrame(frame: string): ChatStreamEvent | null {
  const lines = frame.split('\n').map((line) => line.trim())
  const dataLine = lines.find((line) => line.startsWith('data:'))
  if (!dataLine) return null

  try {
    const parsed = JSON.parse(dataLine.slice(5).trim()) as ChatStreamEvent
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

/** Parse a whole (or partial) SSE document into events, ignoring comments. */
export function parseSseDocument(document: string): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = []
  for (const frame of document.split('\n\n')) {
    if (!frame.trim()) continue
    /* Comment lines (": keep-alive") may appear anywhere inside a frame —
       even before the event fields — so strip them instead of dropping the
       whole frame (some proxies inject them inline). */
    const body = frame
      .split('\n')
      .filter((line) => !line.trimStart().startsWith(':'))
      .join('\n')
    if (!body.trim()) continue
    const event = parseFrame(body)
    if (event) events.push(event)
  }
  return events
}

/** Accumulated state of a streamed answer. */
export interface StreamState {
  text: string
  meta: Extract<ChatStreamEvent, { type: 'meta' }>['meta'] | null
  payload: Extract<ChatStreamEvent, { type: 'done' }>['payload'] | null
  status: string[]
  error: Extract<ChatStreamEvent, { type: 'error' }> | null
}

/** Fold a list of events into the accumulated stream state. */
export function foldEvents(events: ChatStreamEvent[]): StreamState {
  const state: StreamState = { text: '', meta: null, payload: null, status: [], error: null }

  for (const event of events) {
    switch (event.type) {
      case 'status':
        state.status.push(event.label)
        break
      case 'meta':
        state.meta = event.meta
        break
      case 'delta':
        state.text += event.text
        break
      case 'done':
        state.payload = event.payload
        state.text = event.payload.text || state.text
        state.meta = event.payload.meta ?? state.meta
        break
      case 'error':
        state.error = event
        break
    }
  }

  return state
}
