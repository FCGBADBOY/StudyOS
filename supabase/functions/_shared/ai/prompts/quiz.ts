/**
 * Quiz prompts — the chat "Quiz Me" flow and the dedicated ai-quiz function.
 * Both demand strict JSON so the UI can render a real quiz card.
 */
import type { PromptInput } from './base.ts'

export const QUIZ_JSON_RULES = `JSON RULES:
- Reply with ONE JSON object only. No prose, no markdown, no code fences.
- Shape: {"title": string, "questions": [{"question": string, "options": [string, string, string, string], "answer": string, "explanation": string, "marks": number, "difficulty": "easy"|"medium"|"hard"}]}
- "answer" must be the exact text of one of the "options".
- Every question must be answerable from the provided StudyOS sources or the student's chapter; do not invent syllabus facts.
- Nothing may be labelled a previous-year question unless it came from the PYQ archive block.
- Questions are AI-GENERATED PRACTICE (the UI labels them); keep them exam-shaped.`

export function quizInstructions(input: PromptInput): string {
  const count = 5
  return `RESPONSE SHAPE — Quiz
Generate ${count} questions for ${input.chapter ?? input.subject ?? 'the current topic'} at ${
    input.difficulty === 'Hard' ? 'hard' : input.difficulty === 'Easy' ? 'easy' : 'medium'
  } difficulty, mixing 1-mark objective and short-answer style.
${QUIZ_JSON_RULES}`
}

export interface QuizSpec {
  subject?: string | null
  chapter?: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  count: number
  questionType: 'mcq' | 'short_answer' | 'numerical' | 'mixed'
}

/** Prompt body for the standalone ai-quiz edge function. */
export function quizJsonInstructions(spec: QuizSpec): string {
  const typeNote =
    spec.questionType === 'mcq'
      ? 'Every question must be 4-option MCQ.'
      : spec.questionType === 'mixed'
        ? 'Mix MCQ and short-answer questions.'
        : spec.questionType === 'numerical'
          ? 'Every question must be a numerical problem with a numeric answer.'
          : 'Every question must be short-answer (no options).'

  return `Create a ${spec.difficulty}-difficulty quiz of ${Math.min(Math.max(spec.count, 1), 20)} questions
on ${spec.chapter ?? spec.subject ?? "the student's current topic"}.
${typeNote}
${QUIZ_JSON_RULES}`
}
