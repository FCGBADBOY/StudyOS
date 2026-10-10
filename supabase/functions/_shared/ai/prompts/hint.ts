/**
 * Hint mode — progressive scaffolding. The answer must NOT be given away.
 * The conversation carries the hint index, so each turn advances one level.
 */
import type { PromptInput } from './base.ts'

const LEVELS = [
  'Name the governing concept or law the question is testing. No formula, no numbers.',
  'Point at the relation/formula that connects the given quantities — state it symbolically, do not substitute anything.',
  'Tell the student which values go where and what to be careful about (units, sign convention, powers of ten). Still no final numeric answer.',
]

export function hintInstructions(input: PromptInput): string {
  const reveal = input.action === 'reveal_solution'
  if (reveal) {
    return `RESPONSE SHAPE — Reveal the solution (the student asked for it)
Switch to the full working: Given → Formula → Substitution → Calculation → Final answer, with units.
Add one line at the end: what to try first next time so the hint ladder is not needed.`
  }

  const index = Math.min(Math.max(input.hintIndex ?? 0, 0), LEVELS.length - 1)
  const total = LEVELS.length

  return `RESPONSE SHAPE — Progressive hint (${index + 1} of ${total})
Give ONLY this level's hint:
${LEVELS.map((level, i) => `${i + 1}. ${level}`).join('\n')}

Current level to give: ${index + 1}.
Rules:
- Do not reveal the final answer, the numerical result, or a complete working.
- Do not repeat hints already given (see the recent turns).
- End with a single line: "Try it now — say 'next hint' if you are still stuck."
- If the question text is missing something essential, say what is missing instead of guessing.`
}
