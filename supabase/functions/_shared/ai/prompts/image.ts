/**
 * Image → text policy for the question solver (pure — unit-tested).
 *
 * Image privacy rules (spec §35):
 *   - the image lives in memory for this request only: never written to
 *     storage, logs or the database;
 *   - only the extracted TEXT is persisted (as a normal chat message);
 *   - an unreadable photo fails loudly instead of being "solved" from a
 *     guess — students must never act on a hallucinated transcription.
 */

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const

/** ~6 MB once base64-encoded (Edge Functions body limit friendly). */
export const MAX_IMAGE_CHARS = 8 * 1024 * 1024

/** Below this, the transcription is not trustworthy enough to solve from. */
export const MIN_LEGIBLE_CONFIDENCE = 0.5

/** A question shorter than this cannot be a real question. */
export const MIN_TEXT_CHARS = 8

/** Vision prompt: transcribe only, never solve, and flag unreadable parts. */
export const IMAGE_EXTRACT_PROMPT = `Transcribe this study question image so it can be solved.

Rules:
- Capture every number, unit, symbol, option (a-d) and diagram label you can read.
- Printed text, handwriting, equations and simple diagrams are all in scope.
- Do NOT solve it. Do NOT add anything that is not on the image.
- If parts are unreadable, transcribe what you can and set "readable" to false.
- Reply with JSON only:
{"text": "<full transcription>", "readable": true|false, "confidence": 0.0-1.0}`

export interface ImageExtraction {
  text?: string
  readable?: boolean
  confidence?: number | null
}

export interface ExtractionDecision {
  ok: boolean
  /** 0–1 confidence actually used for the decision. */
  confidence: number
  /** Client-safe reason when `ok` is false. */
  reason?: 'unreadable' | 'low_confidence' | 'too_short'
  message?: string
}

const UNREADABLE_MESSAGE =
  "I couldn't read part of the question clearly. Please upload a clearer, well-lit image of just the question."

/**
 * Decide whether an extracted transcription is safe to solve from.
 *
 * Fails (rather than guessing) when the vision model reports the image as
 * unreadable, when confidence is low, or when almost nothing was extracted.
 */
export function evaluateExtraction(extraction: ImageExtraction): ExtractionDecision {
  const readable = extraction.readable === true
  const text = (extraction.text ?? '').trim()
  const confidence = clampConfidence(extraction.confidence, readable ? 0.8 : 0.3)

  if (!readable) return { ok: false, confidence, reason: 'unreadable', message: UNREADABLE_MESSAGE }
  if (confidence < MIN_LEGIBLE_CONFIDENCE) {
    return { ok: false, confidence, reason: 'low_confidence', message: UNREADABLE_MESSAGE }
  }
  if (text.length < MIN_TEXT_CHARS) {
    return { ok: false, confidence, reason: 'too_short', message: UNREADABLE_MESSAGE }
  }
  return { ok: true, confidence }
}

function clampConfidence(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(value, 0), 1)
}

/** `true` when the upload's MIME type is one we can hand to the vision model. */
export function isAllowedImageType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes((mimeType ?? '').toLowerCase().trim())
}

/** Data URL or bare base64 → the payload we send (and a MIME type guess). */
export function splitDataUrl(raw: string): { base64: string; mimeType: string } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed.startsWith('data:')) return { base64: trimmed, mimeType: '' }
  const header = trimmed.slice(0, 60).match(/^data:([\w/+.-]+);/)
  const comma = trimmed.indexOf(',')
  return {
    base64: comma === -1 ? '' : trimmed.slice(comma + 1),
    mimeType: header?.[1]?.toLowerCase() ?? '',
  }
}
