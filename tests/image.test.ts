/**
 * Image → question policy — unit tests.
 *
 * The rule that matters most: an unreadable photo must FAIL LOUDLY instead of
 * being "solved" from a guess. A hallucinated transcription that a student
 * then acts on is worse than no answer at all.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateExtraction,
  isAllowedImageType,
  splitDataUrl,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_CHARS,
  MIN_LEGIBLE_CONFIDENCE,
  MIN_TEXT_CHARS,
  IMAGE_EXTRACT_PROMPT,
} from '../supabase/functions/_shared/ai/prompts/image.ts'

const QUESTION = 'A body of mass 2 kg accelerates at 3 m/s². Find the force.'

/* ------------------------------- extraction ------------------------------- */

test('a legible, confident transcription is accepted', () => {
  const decision = evaluateExtraction({ text: QUESTION, readable: true, confidence: 0.92 })
  assert.equal(decision.ok, true)
  assert.equal(decision.confidence, 0.92)
  assert.equal(decision.reason, undefined)
})

test('an unreadable photo fails with a helpful message instead of a guess', () => {
  const decision = evaluateExtraction({ text: QUESTION, readable: false, confidence: 0.9 })
  assert.equal(decision.ok, false)
  assert.equal(decision.reason, 'unreadable')
  assert.match(decision.message ?? '', /clearer, well-lit image/)
})

test('low confidence fails even when the model claims readability', () => {
  const decision = evaluateExtraction({ text: QUESTION, readable: true, confidence: 0.3 })
  assert.equal(decision.ok, false)
  assert.equal(decision.reason, 'low_confidence')
  assert.ok(decision.confidence < MIN_LEGIBLE_CONFIDENCE)
})

test('missing confidence falls back to a sensible default, not a pass-by-accident', () => {
  /* Readable with no confidence number → default 0.8 (accepted). */
  assert.equal(evaluateExtraction({ text: QUESTION, readable: true }).ok, true)
  /* Not readable with no confidence → default 0.3, rejected. */
  const decision = evaluateExtraction({ text: QUESTION, readable: false })
  assert.equal(decision.ok, false)
  assert.equal(decision.confidence, 0.3)
})

test('confidence is clamped into 0–1', () => {
  assert.equal(evaluateExtraction({ text: QUESTION, readable: true, confidence: 5 }).confidence, 1)
  assert.equal(evaluateExtraction({ text: QUESTION, readable: true, confidence: -2 }).confidence, 0)
  assert.equal(
    evaluateExtraction({ text: QUESTION, readable: true, confidence: Number.NaN }).confidence,
    0.8,
  )
})

test('a transcription too short to be a real question is rejected', () => {
  const decision = evaluateExtraction({ text: 'x = ?', readable: true, confidence: 0.95 })
  assert.equal(decision.ok, false)
  assert.equal(decision.reason, 'too_short')
  assert.ok('x = ?'.trim().length < MIN_TEXT_CHARS)
})

test('an empty extraction never reaches the solver', () => {
  assert.equal(evaluateExtraction({ text: '', readable: true, confidence: 0.9 }).ok, false)
  assert.equal(evaluateExtraction({}, ).ok, false)
})

test('every rejection carries a student-facing message', () => {
  const rejections = [
    evaluateExtraction({ text: QUESTION, readable: false }),
    evaluateExtraction({ text: QUESTION, readable: true, confidence: 0.1 }),
    evaluateExtraction({ text: '??', readable: true, confidence: 0.9 }),
  ]
  for (const decision of rejections) {
    assert.equal(decision.ok, false)
    assert.ok((decision.message ?? '').length > 10, 'rejection without a usable message')
  }
})

/* ------------------------------ upload policy ----------------------------- */

test('only whitelisted media types reach the vision model', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']) {
    assert.equal(isAllowedImageType(type), true, `${type} should be allowed`)
  }
  for (const type of ['image/gif', 'image/svg+xml', 'text/html', 'application/zip', '', 'image/png; charset=x']) {
    assert.equal(isAllowedImageType(type), false, `${type} should be rejected`)
  }
})

test('MIME checks are case/whitespace tolerant', () => {
  assert.equal(isAllowedImageType('IMAGE/PNG'), true)
  assert.equal(isAllowedImageType('  image/jpeg  '), true)
})

test('the allowlist stays small (no surprise types creep in)', () => {
  assert.equal(ALLOWED_IMAGE_TYPES.length, 6)
  assert.ok(MAX_IMAGE_CHARS <= 8 * 1024 * 1024, 'payload cap must stay Edge-Function friendly')
})

/* ------------------------------- data URLs ------------------------------- */

test('a data URL is split into payload + mime type', () => {
  const url = 'data:image/png;base64,iVBORw0KGgo='
  const split = splitDataUrl(url)
  assert.equal(split.mimeType, 'image/png')
  assert.equal(split.base64, 'iVBORw0KGgo=')
})

test('bare base64 passes through untouched', () => {
  const split = splitDataUrl('iVBORw0KGgo=')
  assert.equal(split.base64, 'iVBORw0KGgo=')
  assert.equal(split.mimeType, '')
})

test('a malformed data URL yields an empty payload (never a silent half-parse)', () => {
  assert.equal(splitDataUrl('data:image/png;base64').base64, '')
  assert.equal(splitDataUrl('').base64, '')
})

/* ----------------------------- vision prompt ------------------------------ */

test('the vision prompt transcribes only — it must never solve', () => {
  assert.match(IMAGE_EXTRACT_PROMPT, /Do NOT solve it/)
  assert.match(IMAGE_EXTRACT_PROMPT, /Do NOT add anything that is not on the image/)
  assert.match(IMAGE_EXTRACT_PROMPT, /"readable": true\|false/)
  assert.match(IMAGE_EXTRACT_PROMPT, /"confidence": 0\.0-1\.0/)
})
