/**
 * Tutor mode catalogue (browser side).
 *
 * The server owns the *system prompts* (`supabase/functions/_shared/prompts`);
 * this module owns what the student sees and the short instruction the UI
 * sends with a message so the server can pick the right intent fast:
 *
 *   "mode:hint — give me a hint"          → hint mode, no solution
 *
 * Keep the wording honest: modes promise *format*, never a guaranteed mark.
 */
import { AI_MODES, type AIAction, type AIMode } from '@/ai/types'

export interface ModeDefinition {
  id: AIMode
  label: string
  /** One-line description used under the mode heading. */
  hint: string
  /** Placeholder in the composer while this mode is active. */
  placeholder: string
  /** Short client-side instruction prepended to the raw message. */
  instruction: string
  /** Shown in the empty state so the mode is discoverable. */
  example: string
}

export const MODE_CATALOG: Record<AIMode, ModeDefinition> = {
  explain: {
    id: 'explain',
    label: 'Explain',
    hint: 'Concept walkthrough, grounded in your syllabus',
    placeholder: 'Explain a concept, a law or a diagram…',
    instruction: 'Explain the concept clearly and ground it in the syllabus.',
    example: 'Explain Kirchhoff’s loop rule',
  },
  solve: {
    id: 'solve',
    label: 'Solve',
    hint: 'Step-by-step working, every line justified',
    placeholder: 'Paste a numerical or a full question…',
    instruction: 'Solve it step by step. Show working, not just the answer.',
    example: 'Find the emf of Zn | Zn²⁺ ‖ Ag⁺ | Ag',
  },
  hint: {
    id: 'hint',
    label: 'Hint',
    hint: 'A nudge — never the full solution',
    placeholder: 'What are you stuck on?',
    instruction: 'Give one hint only. Do not reveal the final answer.',
    example: 'I am stuck on this capacitor numerical',
  },
  '3-mark': {
    id: '3-mark',
    label: '3-Mark Answer',
    hint: 'Three distinct points, exam length',
    placeholder: 'Ask for a 3-mark answer…',
    instruction: 'Write a 3-mark answer: three distinct, exam-relevant points.',
    example: 'Give me a 3-mark answer on the Wheatstone bridge',
  },
  '5-mark': {
    id: '5-mark',
    label: '5-Mark Answer',
    hint: 'Structured long answer with derivation',
    placeholder: 'Ask for a long answer or derivation…',
    instruction: 'Write a 5-mark answer with a labelled structure and full derivation.',
    example: 'Derive the lens maker’s formula',
  },
  revise: {
    id: 'revise',
    label: 'Revise',
    hint: 'Condensed revision from your weak areas',
    placeholder: 'What should I revise?',
    instruction: 'Produce a tight revision summary for this topic.',
    example: 'Revise electrochemistry for tomorrow’s test',
  },
  quiz: {
    id: 'quiz',
    label: 'Quiz Me',
    hint: 'Practice questions labelled AI-GENERATED',
    placeholder: 'Quiz me on a chapter…',
    instruction: 'Generate practice questions. Label them AI-GENERATED PRACTICE.',
    example: 'Quiz me on current electricity',
  },
  simplify: {
    id: 'simplify',
    label: 'Simplify',
    hint: 'Plain language, no jargon',
    placeholder: 'Make this easier to understand…',
    instruction: 'Rewrite in plain language a Class 12 student can follow.',
    example: 'Simplify the Nernst equation for me',
  },
}

export const MODE_LIST: ModeDefinition[] = AI_MODES.map((id) => MODE_CATALOG[id])

/* ------------------------------ action chips ------------------------------ */

export interface ActionDefinition {
  id: AIAction
  label: string
  /** Message the chip sends when clicked (server keeps the thread context). */
  message: string
}

export const ACTION_CATALOG: Record<AIAction, ActionDefinition> = {
  explain_simpler: { id: 'explain_simpler', label: 'Explain simpler', message: 'Explain that again, more simply.' },
  give_example: { id: 'give_example', label: 'Give an example', message: 'Give me a worked example of this.' },
  give_hint: { id: 'give_hint', label: 'Give a hint', message: 'Give me a hint without solving it.' },
  show_pyqs: { id: 'show_pyqs', label: 'Past-year questions', message: 'Show me past-year questions on this topic.' },
  quiz_me: { id: 'quiz_me', label: 'Quiz me', message: 'Quiz me on this topic.' },
  make_flashcards: { id: 'make_flashcards', label: 'Make flashcards', message: 'Turn this into flashcards.' },
  next_hint: { id: 'next_hint', label: 'Next hint', message: 'Give me the next hint.' },
  reveal_solution: { id: 'reveal_solution', label: 'Show solution', message: 'Now show me the full solution.' },
  save: { id: 'save', label: 'Save to notes', message: 'Save this answer to my notes.' },
}

/** Message sent for an action chip, prefixed so the server intent is obvious. */
export function actionMessage(action: AIAction): string {
  return ACTION_CATALOG[action]?.message ?? ''
}

/** Build the wire message: a short instruction line + the student's text. */
export function buildModeMessage(raw: string, mode: AIMode): string {
  const instruction = MODE_CATALOG[mode]?.instruction
  const text = raw.trim()
  if (!instruction) return text
  return `[${instruction}] ${text}`
}

/** Suggested prompts for the empty state, grouped by mode. */
export const MODE_EXAMPLES: AIMode[] = ['explain', 'solve', 'hint', '3-mark', 'revise', 'quiz']

export function modeExamples(): string[] {
  return MODE_EXAMPLES.map((id) => MODE_CATALOG[id].example)
}
