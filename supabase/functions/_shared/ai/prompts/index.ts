/**
 * Prompt registry — maps (mode, intent) onto the response-shape instructions.
 * Every feature imports from here so no prompt text is duplicated.
 */
import type { AIIntent, AIMode } from '../types.ts'
import type { PromptInput } from './base.ts'
import {
  chatInstructions,
  explainInstructions,
  reviseInstructions,
  simplifyInstructions,
} from './tutor.ts'
import { solveInstructions } from './solve.ts'
import { hintInstructions } from './hint.ts'
import { examAnswerInstructions } from './exam-answer.ts'
import { quizInstructions } from './quiz.ts'
import { mistakeAnalysisInstructions } from './mistake-analysis.ts'
import {
  flashcardInstructions,
  formulaInstructions,
  pyqInstructions,
  reactionInstructions,
  similarInstructions,
  studyAdviceInstructions,
} from './structured.ts'

export * from './base.ts'
export { detectIntent, needsRetrieval, responseTypeFor } from './intent.ts'
export { GROUNDING_RULES } from './base.ts'
export { QUIZ_JSON_RULES, quizJsonInstructions, type QuizSpec } from './quiz.ts'
export { patternInstructions, type MistakeInputRecord, type MistakePattern } from './mistake-analysis.ts'

/** Response-shape instructions for the current request. */
export function instructionsFor(input: PromptInput): string {
  const { intent, mode } = input

  switch (intent) {
    case 'chat':
      return chatInstructions()
    case 'hint':
      return hintInstructions(input)
    case 'solve':
      return solveInstructions(input)
    case 'exam_answer':
      return examAnswerInstructions(input)
    case 'revision':
      return reviseInstructions(input)
    case 'pyq':
      return pyqInstructions(input)
    case 'formula':
      return formulaInstructions()
    case 'reaction':
      return reactionInstructions()
    case 'quiz':
      return quizInstructions(input)
    case 'flashcards':
      return flashcardInstructions(input)
    case 'similar':
      return similarInstructions(input)
    case 'mistake_review':
      return mistakeAnalysisInstructions(input, input.mistake ?? undefined)
    case 'study_advice':
      return studyAdviceInstructions()
    default:
      /* concept */
      return mode === 'simplify' || input.action === 'explain_simpler'
        ? simplifyInstructions(input)
        : explainInstructions(input)
  }
}
