/**
 * Structured intents — PYQ lookup, formula sheet, reaction lookup, flashcards,
 * similar-question generation and personalised study advice.
 *
 * Each one has a fixed response contract so the UI can render a dedicated
 * card instead of a wall of text.
 */
import type { PromptInput } from './base.ts'

export function pyqInstructions(input: PromptInput): string {
  const found = input.pyqs.length
  if (found === 0) {
    return `RESPONSE SHAPE — PYQ lookup (no archive matches)
There are NO previous-year questions in the StudyOS archive for this request.
Say exactly that, then: (a) name the topic/chapter you searched, (b) offer 2 AI-GENERATED PRACTICE questions clearly labelled as such.
Never invent a year, board or paper and never call generated questions PYQs.`
  }

  return `RESPONSE SHAPE — PYQ lookup
Present ONLY the questions from the PYQ ARCHIVE block above, in a numbered list. For each show:
Year · Board/exam type · Marks · Difficulty · Chapter — then the question text verbatim.
Rules:
- Do not paraphrase the question text and do not add questions that are not in the block.
- If the student asked for N questions and fewer exist, say how many actually exist.
- End with: "Want hints or a full solution for any of these?" and list 2 related concepts from the archive.
- Never invent a PYQ; a generated practice question must be labelled "AI-GENERATED PRACTICE".`
}

export function formulaInstructions(): string {
  return `RESPONSE SHAPE — Formula lookup
For each formula from the sources:
1. Formula — on its own line.
2. Meaning — what each symbol stands for.
3. Units — SI units of every symbol and of the result.
4. When to use — the trigger situation in an exam question.
5. Related formulas — the 1-2 connected relations.
6. Common mistakes — one line.
If StudyOS has no formula sheet for this topic, say so and clearly mark the list as "from the model — verify against your textbook".`
}

export function reactionInstructions(): string {
  return `RESPONSE SHAPE — Reaction lookup (Chemistry)
Render the reaction in this exact ladder:
Reactant → Reagent → Condition → Product → Reaction name
Then: one line on what is happening (mechanism gist) and one common exam trap.
Use only reactions found in the provided StudyOS sources (formula/reaction resources). If none match, say the reaction is not in StudyOS's stored content and label the answer as model knowledge to be verified.`
}

export function flashcardInstructions(input: PromptInput): string {
  return `RESPONSE SHAPE — Flashcards
Return ONE JSON object only, no prose:
{"title": string, "cards": [{"question": string, "answer": string, "difficulty": "easy"|"medium"|"hard", "source": string}]}
Rules:
- 8-12 cards covering the chapter's definitions, formulas, reactions and common confusions.
- "question" is short (a line or two); "answer" is 1-3 lines; "source" names the StudyOS source or chapter used (never a fabricated page).
- Cards are AI-GENERATED material derived from StudyOS content — do not claim they are official notes.
Scope: ${input.chapter ?? input.subject ?? 'the current chapter'}.`
}

export function similarInstructions(input: PromptInput): string {
  return `RESPONSE SHAPE — Similar practice question
Return ONE JSON object only, no prose:
{"question": string, "answer": string, "approach": [string, string, string], "difficulty": "easy"|"medium"|"hard", "marks": number}
Rules:
- Write a NEW problem that tests the same concept as the student's question with different values/context.
- Label it AI-GENERATED PRACTICE in the "question" field's first line.
- The "answer" must be correct — double-check any arithmetic before answering.
- Never present it as a previous-year question.`
}

export function studyAdviceInstructions(): string {
  return `RESPONSE SHAPE — Personalised study advice
Give a decision the student can act on in the next hour, structured as:
1. Do this first — one chapter/topic with the reason drawn from their data (exam date, accuracy, mistake counts, last studied).
2. Because — bullet reasons with numbers from the context ("exam in 6 days", "accuracy 42%", "3 related mistakes").
3. Then — a second, lighter task.
4. Skip for now — one thing to deliberately defer, with a reason.
Never claim anything about the student that is not in the context. If the context is thin, say what data is missing.`
}
