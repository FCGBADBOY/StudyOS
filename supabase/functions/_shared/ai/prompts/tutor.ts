/**
 * Concept prompts — Explain, Simplify, Revise (and plain chat).
 */
import type { PromptInput } from './base.ts'

function depthNote(input: PromptInput): string {
  const level = input.difficulty ?? 'Moderate'
  return `Depth: ${level === 'Hard' ? 'exam-level detail with derivations' : level === 'Easy' ? 'gentle, first-principles' : 'board-level with the key steps'}.`
}

export function explainInstructions(input: PromptInput): string {
  return `RESPONSE SHAPE — Concept explanation (${depthNote(input)})
Structure the answer in this order, keeping each part short:
1. Concept — one line stating what the idea is.
2. Simple explanation — in the student's own class level's language.
3. Important equations / statements — on their own line, with symbols defined.
4. How to apply — the steps a student follows in an exam.
5. Example — one worked micro-example (use StudyOS numbers when a source provides them).
6. Common mistakes — 2-3 bullets, tied to the student's recent mistakes when relevant.
If a StudyOS source covers this, ground the explanation in it and mention which source (by title, never a fabricated page).`
}

export function simplifyInstructions(input: PromptInput): string {
  const flavour =
    input.action === 'explain_simpler' || input.action === 'give_example'
      ? 'Simpler than the previous answer: shorter sentences, everyday analogy, one tiny example.'
      : 'Explain like to a beginner: no jargon without a one-line definition, use one concrete analogy.'
  return `RESPONSE SHAPE — Simplify
${flavour}
Then finish with:
- "In exam language" — how the same answer should read in a paper (2-3 lines).
- "Remember" — the single sentence worth memorising.
Avoid childish wording unless the student explicitly asked for it.`
}

export function reviseInstructions(input: PromptInput): string {
  return `RESPONSE SHAPE — Personalised revision session (30 minutes unless the student asks otherwise)
Build the plan from the student's context (weak chapters, recent mistakes, upcoming exam, PYQ archive):
- 10 min — revise the weakest concept (name it and say what to re-read).
- 10 min — solve 2-3 PYQs (use the PYQ archive block; if none are listed, say so and set practice instead).
- 5 min — review the listed recent mistakes (name them).
- 5 min — quick self-quiz: 3 questions the student answers mentally.
Present as a table-like list with minutes, activity and why. End with "Start with…" as the single next action.
Never invent exam dates: use only exams given in the context.`
}

export function chatInstructions(): string {
  return `RESPONSE SHAPE — Short greeting / meta question
2-4 sentences. Introduce what you can do in StudyOS (explain, solve, hints, 3/5-mark answers, PYQs, quizzes, flashcards, revision) and suggest one concrete next question. Do not lecture.`
}
