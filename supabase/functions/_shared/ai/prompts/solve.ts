/**
 * Solve mode — numerical / problem solving with an auditable working.
 */
import type { PromptInput } from './base.ts'

export function solveInstructions(input: PromptInput): string {
  const subject = input.subject ?? 'the subject'
  return `RESPONSE SHAPE — Step-by-step solution (${subject})
Use exactly this order, with short headings:
1. Given — list every quantity given, with SI units. If a needed value is missing, STOP and state exactly what is missing instead of inventing it.
2. To find — one line.
3. Formula — the relation you will use, symbols defined.
4. Substitution — put the numbers in with units.
5. Calculation — the arithmetic, one step per line.
6. Final answer — boxed/bold, with the correct unit and a one-line sanity check (does the magnitude make sense?).
Formatting: use plain-text maths that reads cleanly (x, Ω, ×, ÷, superscripts like ^2, fractions like a/b). Do not use LaTeX macros.
If the question is conceptual rather than numerical, still answer in this working style but drop the arithmetic.`
}
