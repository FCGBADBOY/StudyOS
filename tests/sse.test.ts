/**
 * SSE stream parsing — unit tests.
 *
 * The tutor streams over Server-Sent Events. These tests pin the wire format
 * the browser parser accepts: frames split on blank lines, comment lines
 * ignored, malformed frames dropped (never crash the chat), and the fold that
 * assembles the final answer + metadata + error state.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseFrame,
  parseSseDocument,
  foldEvents,
} from '../src/ai/providers/sse.ts'
import type { ChatStreamEvent } from '../src/ai/types.ts'

function frame(type: string, extra: Record<string, unknown> = {}): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...extra })}`
}

/* -------------------------------- parseFrame ------------------------------ */

test('a delta frame parses into a typed event', () => {
  const event = parseFrame(frame('delta', { text: 'Electric potential is…' }))
  assert.deepEqual(event, { type: 'delta', text: 'Electric potential is…' })
})

test('a frame without a data line is ignored', () => {
  assert.equal(parseFrame('event: delta'), null)
  assert.equal(parseFrame(''), null)
  assert.equal(parseFrame(': keep-alive comment'), null)
})

test('a malformed JSON frame is dropped, not thrown', () => {
  assert.equal(parseFrame('data: {not json'), null)
  assert.equal(parseFrame('data: '), null)
})

test('a frame whose payload is not an event is dropped', () => {
  assert.equal(parseFrame('data: 42'), null)
  assert.equal(parseFrame('data: "a string"'), null)
  assert.equal(parseFrame('data: null'), null)
  /* Object without a type field is not an event either. */
  assert.equal(parseFrame('data: {"foo":"bar"}'), null)
})

test('extra fields survive parsing (meta/payload shapes stay intact)', () => {
  const meta = { type: 'meta', meta: { type: 'answer', intent: 'concept', mode: 'explain' } }
  const event = parseFrame(`data: ${JSON.stringify(meta)}`)
  assert.deepEqual(event, meta)
})

/* ----------------------------- parseSseDocument --------------------------- */

test('a full document parses into ordered events, comments skipped', () => {
  const document = [
    ': connected',
    frame('status', { label: 'Searching StudyOS resources…' }),
    '',
    frame('meta', { meta: { type: 'answer', intent: 'concept', mode: 'explain' } }),
    '',
    frame('delta', { text: 'Gauss law' }),
    '',
    frame('delta', { text: ' states…' }),
    '',
    frame('done', { payload: { text: 'Gauss law states…', meta: null } }),
    '',
  ].join('\n')

  const events = parseSseDocument(document)
  assert.deepEqual(
    events.map((event) => event.type),
    ['status', 'meta', 'delta', 'delta', 'done'],
  )
})

test('a truncated document yields the complete events parsed so far', () => {
  const partial = [
    frame('delta', { text: 'Half an answer' }),
    '',
    'event: delta\ndata: {"type":"delta","text":" that was cut',
  ].join('\n')
  const events = parseSseDocument(partial)
  assert.deepEqual(events, [{ type: 'delta', text: 'Half an answer' }])
})

test('an error frame parses like any other event', () => {
  const events = parseSseDocument(frame('error', { code: 'rate_limited', message: 'Slow down.' }))
  assert.deepEqual(events, [{ type: 'error', code: 'rate_limited', message: 'Slow down.' }])
})

/* ------------------------------- foldEvents ------------------------------- */

test('deltas concatenate in order into the streamed text', () => {
  const events = parseSseDocument(
    [frame('delta', { text: 'Hello ' }), '', frame('delta', { text: 'world' }), ''].join('\n'),
  )
  assert.equal(foldEvents(events).text, 'Hello world')
})

test('the done payload wins: final text and meta replace the partial stream', () => {
  const events: ChatStreamEvent[] = [
    { type: 'delta', text: 'partial ' },
    { type: 'meta', meta: { type: 'answer', intent: 'concept', mode: 'explain' } },
    {
      type: 'done',
      payload: {
        text: 'final full answer',
        meta: { type: 'pyq_list', intent: 'pyq', mode: 'explain' },
      },
    },
  ]
  const state = foldEvents(events)
  assert.equal(state.text, 'final full answer')
  assert.equal(state.meta?.type, 'pyq_list')
  assert.equal(state.payload?.text, 'final full answer')
})

test('done keeps the earlier meta when the payload has none', () => {
  const events: ChatStreamEvent[] = [
    { type: 'meta', meta: { type: 'answer', intent: 'concept', mode: 'explain' } },
    { type: 'done', payload: { text: 'ok', meta: null } },
  ]
  assert.equal(foldEvents(events).meta?.type, 'answer')
})

test('status labels accumulate for the retrieval status line', () => {
  const events: ChatStreamEvent[] = [
    { type: 'status', label: 'Searching StudyOS resources…' },
    { type: 'status', label: 'Reading your MistakeBook…' },
    { type: 'delta', text: 'x' },
  ]
  const state = foldEvents(events)
  assert.deepEqual(state.status, ['Searching StudyOS resources…', 'Reading your MistakeBook…'])
  assert.equal(state.text, 'x')
})

test('an error frame is preserved for the UI to render', () => {
  const events: ChatStreamEvent[] = [
    { type: 'delta', text: 'partial' },
    { type: 'error', code: 'no_provider', message: 'The tutor is not configured yet.' },
  ]
  const state = foldEvents(events)
  assert.equal(state.error?.code, 'no_provider')
  assert.equal(state.error?.message, 'The tutor is not configured yet.')
  assert.equal(state.payload, null)
})

test('an empty event list folds into a clean empty state (no crash)', () => {
  const state = foldEvents([])
  assert.equal(state.text, '')
  assert.equal(state.meta, null)
  assert.equal(state.payload, null)
  assert.deepEqual(state.status, [])
  assert.equal(state.error, null)
})

/* --------------------- end-to-end wire format round-trip ------------------ */

test('a realistic streamed answer round-trips through parse + fold', () => {
  const document = [
    ': keep-alive',
    frame('status', { label: 'Searching StudyOS resources…' }),
    '',
    frame('status', { label: 'Checking PYQ archive…' }),
    '',
    frame('meta', { meta: { type: 'answer', intent: 'concept', mode: 'explain', grounded: true } }),
    '',
    frame('delta', { text: 'Gauss law: ' }),
    '',
    frame('delta', { text: 'the total flux through a closed surface equals the enclosed charge / ε₀.' }),
    '',
    frame('done', {
      payload: {
        text: 'Gauss law: the total flux through a closed surface equals the enclosed charge / ε₀.',
        meta: { type: 'answer', intent: 'concept', mode: 'explain', grounded: true },
      },
    }),
    '',
  ].join('\n')

  const state = foldEvents(parseSseDocument(document))
  assert.equal(state.status.length, 2)
  assert.equal(state.meta?.grounded, true)
  assert.ok(state.text.startsWith('Gauss law:'))
  assert.ok(state.text.includes('ε₀'))
  assert.equal(state.error, null)
})
