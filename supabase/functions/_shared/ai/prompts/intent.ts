/**
 * Rule-based intent detection (pure, unit-tested).
 *
 * The mode chips already tell us a lot; the message text narrows it further so
 * retrieval, tools and the response shape are chosen deliberately rather than
 * left to the model. Deliberately conservative: anything unrecognised falls
 * back to a concept explanation.
 */
import type { AIAction, AIIntent, AIMode } from '../types.ts'

const ACTION_INTENT: Partial<Record<AIAction, AIIntent>> = {
  show_pyqs: 'pyq',
  quiz_me: 'quiz',
  make_flashcards: 'flashcards',
  give_hint: 'hint',
  next_hint: 'hint',
  reveal_solution: 'solve',
}

const MODE_INTENT: Record<AIMode, AIIntent> = {
  explain: 'concept',
  solve: 'solve',
  hint: 'hint',
  '3-mark': 'exam_answer',
  '5-mark': 'exam_answer',
  revise: 'revision',
  quiz: 'quiz',
  simplify: 'concept',
}

interface Pattern {
  intent: AIIntent
  test: RegExp
}

/* Order matters: the first match wins. */
const PATTERNS: Pattern[] = [
  { intent: 'quiz', test: /\b(quiz me|make a quiz|mcqs?|multiple[- ]choice|objective questions?)\b/i },
  { intent: 'flashcards', test: /\b(flash ?cards?|revision cards?)\b/i },
  { intent: 'similar', test: /\b(similar question|another question|practice question|more questions? like)\b/i },
  {
    intent: 'pyq',
    test: /\b(previous[- ]year|past[- ]year|pyq|board paper|board exam question|last year'?s question)\b/i,
  },
  {
    intent: 'mistake_review',
    test: /\b(explain (my|this) mistake|my mistakebook|why was my answer wrong|mistake i made)\b/i,
  },
  { intent: 'study_advice', test: /\b(what should i study|study today|study plan|recommend|give me advice|where do i focus)\b/i },
  { intent: 'revision', test: /\b(revise me|revision session|quick revision|summari[sz]e .* for (the )?exam|review me)\b/i },
  { intent: 'reaction', test: /\b(reagent|reaction of|name the (product|reaction)|with\s+\w+\s+and\s+NaOH|mechanism)\b/i },
  { intent: 'formula', test: /\b(formulas?|equation sheet|list of (formula|equation)s?)\b/i },
  { intent: 'hint', test: /\b(hint|nudge|clue|stuck|don'?t know where to start)\b/i },
  { intent: 'solve', test: /\b(solve|calculate|compute|find the value|numerical|how many|determine)\b/i },
]

/** Detect what the student wants from a message + selected mode. */
export function detectIntent(question: string, mode: AIMode, action?: AIAction): AIIntent {
  if (action && ACTION_INTENT[action]) return ACTION_INTENT[action] as AIIntent

  const text = question.trim()
  if (!text) return MODE_INTENT[mode]

  /* A greeting or meta question ("who are you?") is plain chat. */
  if (/^(hi|hello|hey|yo|namaste|good (morning|evening|afternoon))\b/i.test(text) && text.length < 40) {
    return 'chat'
  }

  /* When the student picked a structural mode, honour it unless the text
     explicitly asks for a different structured feature (quiz/PYQ/flashcards). */
  const explicit = PATTERNS.find((pattern) => pattern.test.test(text))
  const structuralModes: AIMode[] = ['hint', 'quiz', '3-mark', '5-mark', 'revise']
  if (explicit && (explicit.intent === 'quiz' || explicit.intent === 'flashcards' || explicit.intent === 'pyq' || explicit.intent === 'similar')) {
    return explicit.intent
  }
  if (structuralModes.includes(mode)) return MODE_INTENT[mode]

  return explicit?.intent ?? MODE_INTENT[mode]
}

/** Should this intent trigger StudyOS retrieval at all? */
export function needsRetrieval(intent: AIIntent): boolean {
  return intent !== 'chat'
}

/** Which response shape the answer should use (drives metadata.type). */
export function responseTypeFor(intent: AIIntent): string {
  switch (intent) {
    case 'hint':
      return 'hint'
    case 'pyq':
      return 'pyq_list'
    case 'formula':
      return 'formula_list'
    case 'revision':
      return 'revision_plan'
    case 'mistake_review':
      return 'mistake_analysis'
    case 'quiz':
      return 'quiz'
    case 'flashcards':
      return 'flashcards'
    case 'similar':
      return 'similar_question'
    case 'study_advice':
      return 'answer'
    default:
      return 'answer'
  }
}
