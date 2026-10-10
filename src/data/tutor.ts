import type { StudySession } from '@/types'

/** Control chips above the chat input. */
export const TUTOR_MODES = [
  { id: 'explain', label: 'Explain', hint: 'Concept walkthrough' },
  { id: 'solve', label: 'Solve', hint: 'Step-by-step solution' },
  { id: 'hint', label: 'Hint', hint: 'Without giving it away' },
  { id: '3-mark', label: '3-Mark Answer', hint: 'Exam-length answer' },
  { id: '5-mark', label: '5-Mark Answer', hint: 'Full derivation' },
  { id: 'simplify', label: 'Simplify', hint: 'Plain language' },
] as const

export type TutorMode = (typeof TUTOR_MODES)[number]['id']

export const SUGGESTED_PROMPTS = [
  'Explain this concept simply',
  'Give me a 3-mark answer',
  'Show the derivation',
  'Give me a similar question',
  'Why is the Nernst equation used?',
  'Summarise Reimer–Tiemann in 5 lines',
]

export interface TutorReply {
  text: string
  equation?: string
  steps?: string[]
  code?: { language: string; content: string }
  question?: { title: string; body: string; marks: number }
  followUps?: string[]
}

interface Template {
  match: RegExp
  reply: TutorReply
}

/** Keyword-matched mock responses — deterministic, realistic and offline. */
const TEMPLATES: Template[] = [
  {
    match: /nernst|emf|electrochem|cell potential/i,
    reply: {
      text: 'The Nernst equation tells you how the cell potential changes when concentrations are not 1 M. At 298 K it simplifies beautifully:',
      equation: 'E = E° – (0.059 / n) · log Q',
      steps: [
        'Write the balanced half-reactions and find n (electrons transferred).',
        'Build Q = [products] / [reactants], excluding solids and pure liquids.',
        'Substitute E° from the electrochemical series.',
        'Solve for E — if E > 0 the reaction is spontaneous under these conditions.',
      ],
      followUps: ['Give me a similar question', 'Show the derivation from ΔG', 'Explain with a numerical'],
    },
  },
  {
    match: /kirchhoff|wheatstone|loop rule|junction/i,
    reply: {
      text: "Kirchhoff's two laws are conservation statements for circuits — one for charge, one for energy.",
      steps: [
        'KCL (Junction rule): the algebraic sum of currents at any junction is zero.',
        'KVL (Loop rule): the algebraic sum of potential drops around any closed loop is zero.',
        'Sign conventions: current enters a resistor → drop (–IR); traverse a battery from – to + → rise (+E).',
        'For a balanced Wheatstone bridge no current flows through the galvanometer: P/Q = R/S.',
      ],
      equation: 'ΣI(in) = ΣI(out),   ΣV(loop) = 0',
      followUps: ['Show the derivation', 'Give me a similar question', 'Give me a 3-mark answer'],
    },
  },
  {
    match: /derivation|derive|prove/i,
    reply: {
      text: 'Here is the exam-style derivation — examiners award marks for each highlighted step, so write them in this order:',
      steps: [
        'State the starting relation and define every symbol.',
        'Apply the governing law (conservation / geometry / definition).',
        'Substitute the given relations and simplify step by step.',
        'Box the final expression and state the SI unit.',
        'Add a one-line physical interpretation — often worth half a mark.',
      ],
      equation: 'E = E° – (RT / nF) · ln Q  →  at 298 K:  E = E° – (0.059 / n) · log Q',
      followUps: ['Give me a 5-mark answer', 'Simplify this for me', 'Give me a similar question'],
    },
  },
  {
    match: /capacitor|energy stored|½cv|u =/i,
    reply: {
      text: 'Energy in a capacitor comes from the work done in moving charge against the growing potential difference.',
      equation: 'U = ½CV²   ⇄   U = Q² / 2C   ⇄   U = ½QV',
      steps: [
        'dW = V·dq = (q/C)·dq.',
        'Integrate from 0 to Q:  W = ∫ q/C dq = Q² / 2C.',
        'Using Q = CV gives U = ½CV².',
        'Half the energy (½CV²) also sits in the dielectric field — field energy density u = ½ε₀E².',
      ],
      followUps: ['Give me a similar question', 'Explain this concept simply', 'Give me a 3-mark answer'],
    },
  },
  {
    match: /python|code|program|function|sql|query/i,
    reply: {
      text: 'Here is a clean implementation with the edge case examiners look for:',
      code: {
        language: 'python',
        content: `def nth_term(n: int) -> int:
    """Return the nth term of: 1, 1, 2, 3, 5, 8 ..."""
    if n <= 0:
        raise ValueError("n must be a positive integer")
    a, b = 1, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return a

print(nth_term(7))   # 13`,
      },
      steps: [
        'Base case first — the recursion (or loop) needs a stopping condition.',
        'Keep the state in two variables instead of recomputing.',
        'Trace with a small input before submitting.',
      ],
      followUps: ['Give me a similar question', 'Explain the time complexity', 'Write the recursive version'],
    },
  },
  {
    match: /hint|stuck|don'?t know|clue/i,
    reply: {
      text: 'One nudge, no spoiler: look at what the question already gives you.',
      steps: [
        'List every quantity given with its SI unit.',
        'Ask which law connects exactly those quantities.',
        'If two quantities are missing, you need two equations — check the chapter summary.',
        'Try the question again for 4 minutes before asking for the full solution.',
      ],
      followUps: ['Okay, show me the solution', 'Give me a similar question', 'Explain this concept simply'],
    },
  },
  {
    match: /3[- ]?mark|3 marks|three marks/i,
    reply: {
      text: 'A 3-mark answer needs three distinct points — one idea, one relation, one result.',
      steps: [
        'Point 1: define the concept in one line (1 mark).',
        'Point 2: state the governing relation or law with symbols (1 mark).',
        'Point 3: apply it to the given data and quote the answer with units (1 mark).',
      ],
      equation: 'E = E° – (0.059 / n) · log Q',
      followUps: ['Give me a 5-mark answer', 'Give me a similar question', 'Show the derivation'],
    },
  },
  {
    match: /5[- ]?mark|5 marks|five marks|long answer/i,
    reply: {
      text: 'For 5 marks, structure = marks. Use this skeleton:',
      steps: [
        'Introduction: one sentence stating what you are about to prove (½ mark).',
        'Diagram: labelled, with the sign convention written beside it (1 mark).',
        'Derivation: every step on a new line, no skipping (2 marks).',
        'Result: boxed equation + SI unit + one-line physical meaning (1 mark).',
        'Never leave a step unlabelled — partial credit is awarded per step.',
      ],
      followUps: ['Give me a similar question', 'Show the derivation', 'Explain this concept simply'],
    },
  },
  {
    match: /simplif|simple|plain|easy/i,
    reply: {
      text: 'In plain words: a battery pushes charge, and the Nernst equation tells you how much push you actually get when the chemicals are not at standard strength.',
      steps: [
        'Standard potential (E°) = push under ideal conditions.',
        'Q = how far conditions are from ideal right now.',
        'The bigger Q, the smaller E — the reaction slows its push.',
      ],
      followUps: ['Give me a 3-mark answer', 'Show the derivation', 'Give me a similar question'],
    },
  },
  {
    match: /similar question|practice|more questions/i,
    reply: {
      text: 'Try this one — same concept, different numbers. Attempt it before you scroll.',
      question: {
        title: 'Practice — Electrochemistry (3 marks)',
        body: 'Calculate the emf of the cell Zn | Zn²⁺ (0.5 M) ‖ Ag⁺ (0.05 M) | Ag at 298 K, given E°(Zn²⁺/Zn) = –0.76 V and E°(Ag⁺/Ag) = +0.80 V.',
        marks: 3,
      },
      steps: [
        'Find n from the balanced cell reaction.',
        'Compute E°cell = E°cathode – E°anode.',
        'Apply the Nernst equation with Q = [Zn²⁺]/[Ag⁺]².',
      ],
      followUps: ['Show me the solution', 'Give me a hint', 'Explain this concept simply'],
    },
  },
]

const DEFAULT_REPLY: TutorReply = {
  text: 'Here is how I would approach it — break the question into what is given, what is asked, and the law that connects them.',
  steps: [
    'Write the given quantities with SI units.',
    'Identify the relation that links them.',
    'Substitute, solve, and check the units of your answer.',
    'Sanity check: does the magnitude make physical sense?',
  ],
  followUps: ['Give me a 3-mark answer', 'Show the derivation', 'Give me a similar question'],
}

/** Pick the best mock response for a prompt + mode. */
export function buildTutorReply(prompt: string, mode: TutorMode = 'explain'): TutorReply {
  const modeHint = `${mode} ${prompt}`
  const template = TEMPLATES.find((entry) => entry.match.test(modeHint))
  return template ? template.reply : DEFAULT_REPLY
}

/** Initial conversation shown when the tutor opens. */
export const INITIAL_TUTOR_MESSAGES: ChatMessageData[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    text: 'Hi Sumit — I am the StudyOS AI Tutor. Ask me anything from your Class 12 syllabus, or pick a mode above: Explain, Solve, Hint, or an exam-length answer.',
    time: '18:02',
  },
]

export interface ChatMessageData {
  id: string
  role: 'user' | 'assistant'
  text: string
  time: string
  reply?: TutorReply
  attachment?: { kind: 'image' | 'question'; label: string }
  pending?: boolean
}

/** Mock study session used by the "Start Session" flow. */
export function buildSessionFromFocus(focus: {
  id: string
  title: string
  subjectId: StudySession['subjectId']
  minutes: number
}): StudySession {
  return {
    id: `session-${focus.id}-${Date.now()}`,
    subjectId: focus.subjectId,
    subjectName: '',
    topic: focus.title,
    duration: focus.minutes,
    priority: 'High',
    completed: false,
  }
}
