/**
 * Client-side academic focus for AI requests.
 *
 * Retrieval filters are decided **server-side** from the student's profile
 * (board / class / stream), so the browser only sends what the student
 * explicitly picked: "answer this for *this* subject/chapter". Anything wider
 * would let a client talk its way past RLS — it never can, because the search
 * RPCs are `security invoker`.
 */
import type { ChatFocus } from '@/ai/types'

export interface FocusInput {
  subjectId?: string | null
  chapterId?: string | null
  subjectSlug?: string | null
  chapterSlug?: string | null
  difficulty?: ChatFocus['difficulty']
}

/** Build a focus object, dropping empty strings so the payload stays tidy. */
export function buildFocus(input: FocusInput = {}): ChatFocus | undefined {
  const focus: ChatFocus = {
    subjectId: input.subjectId || null,
    chapterId: input.chapterId || null,
    subjectSlug: input.subjectSlug || null,
    chapterSlug: input.chapterSlug || null,
    difficulty: input.difficulty ?? null,
  }
  const hasValue =
    Boolean(focus.subjectId) ||
    Boolean(focus.chapterId) ||
    Boolean(focus.subjectSlug) ||
    Boolean(focus.chapterSlug) ||
    Boolean(focus.difficulty)
  return hasValue ? focus : undefined
}

/** Human label for a focus (used in the tutor header: "Physics · Current Electricity"). */
export function focusLabel(focus: ChatFocus | undefined): string | null {
  if (!focus) return null
  const chapter = focus.chapterSlug ?? focus.chapterId
  const subject = focus.subjectSlug ?? focus.subjectId
  if (chapter && subject) return `${titleize(subject)} · ${titleize(slugToWords(chapter))}`
  if (chapter) return titleize(slugToWords(chapter))
  if (subject) return titleize(subject)
  return null
}

function slugToWords(value: string): string {
  if (!value.includes('-')) return value
  return value.replace(/-/g, ' ')
}

function titleize(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}
