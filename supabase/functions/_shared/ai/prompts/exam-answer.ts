/**
 * Board answer mode — 3-mark and 5-mark responses written the way a paper is
 * marked: points, definition, relation, conclusion.
 *
 * Honesty rule: these are StudyOS-guided answers, NOT an official marking
 * scheme — the prompt says so explicitly unless a real source provides one.
 */
import type { PromptInput } from './base.ts'

export function examAnswerInstructions(input: PromptInput): string {
  const marks = input.mode === '5-mark' ? 5 : 3
  const hasSource = input.sources.length > 0

  if (marks === 3) {
    return `RESPONSE SHAPE — ${marks}-mark CBSE-style answer
Write exactly the number of distinct points a ${marks}-mark question expects, each on its own line:
1. Definition — one precise sentence.
2. Explanation / relation — with the formula or equation if relevant (symbols defined).
3. Conclusion — the result or significance in one line.
Rules:
- Total length: 60-110 words. No filler, no introduction like "In this answer I will…".
- Use the keyword phrasing of the chapter (from StudyOS sources when available${hasSource ? ' — they are provided above' : ''}).
- Finish with a single line "Keyword tags:" listing 3-5 exam keywords.
- Do NOT claim this matches an official marking scheme; say "model answer" if you must refer to it.`
  }

  return `RESPONSE SHAPE — ${marks}-mark CBSE-style answer
Structure with these headings (a ${marks}-mark answer is marked on structure):
1. Definition — 1-2 sentences.
2. Explanation — the mechanism/argument in short paragraphs or labelled points.
3. Formula / Equation — where relevant, on its own line with symbols defined.
4. Diagram cue — one line describing the diagram the student should draw (do not pretend to draw it).
5. Conclusion — significance or result in one line.
Rules:
- Total length: 150-220 words; every paragraph must earn marks (no repetition).
- Use chapter keywords from the StudyOS sources where they exist${hasSource ? ' (provided above)' : ''}.
- Finish with "Keyword tags:" listing 5-7 exam keywords.
- Never present it as an official marking scheme or quote a page number you were not given.`
}
