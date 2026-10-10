/**
 * MistakeBook prompts — "explain my mistake" and mistake-pattern analysis.
 *
 * The input is always the student's OWN rows (fetched with their session), and
 * the output describes observable study patterns only — never psychology.
 */
import type { PromptInput } from './base.ts'

export interface MistakeInputRecord {
  question: string
  studentAnswer: string | null
  correctAnswer: string | null
  mistakeType: string
  chapter: string | null
  subject: string | null
}

export function mistakeAnalysisInstructions(input: PromptInput, mistake?: MistakeInputRecord): string {
  const shape = `RESPONSE SHAPE — Mistake explanation
1. What you did — restate the student's approach in one or two lines (be neutral, no shaming).
2. Why it is wrong — the specific step/concept that failed.
3. Correct concept — the rule/formula that applies, grounded in StudyOS sources when available.
4. Show the fix — apply it to the same question in 2-4 lines.
5. How to avoid it next time — one concrete check to run before submitting (e.g. "check the sign when moving terms").`

  if (!mistake) {
    return `${shape}
The specific MistakeBook row was not found in the context — ask the student to open the entry, and meanwhile analyse the mistake described in their message.`
  }

  return `STUDENT'S MISTAKE (their own MistakeBook row)
- Question: ${mistake.question}
- Their answer: ${mistake.studentAnswer ?? '(not recorded)'}
- Correct answer: ${mistake.correctAnswer ?? '(not recorded)'}
- Mistake type: ${mistake.mistakeType}
- Chapter: ${mistake.chapter ?? 'unknown'} (${mistake.subject ?? 'unknown subject'})

${shape}`
}

export interface MistakePattern {
  label: string
  count: number
  examples: string[]
}

export function patternInstructions(patterns: MistakePattern[], input: PromptInput): string {
  return `RESPONSE SHAPE — Mistake pattern review
These patterns were counted from the student's own MistakeBook rows (rule-based, not guessed):
${patterns.map((pattern) => `- ${pattern.label}: ${pattern.count} mistakes (${pattern.examples.slice(0, 3).join(' | ')})`).join('\n')}

Write a short review: which pattern to fix first and why, one concrete fix per pattern, and a 10-minute drill.
Rules: describe only what the counts show — no claims about personality, intelligence or habits beyond the data.`
}
