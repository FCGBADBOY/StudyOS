/**
 * Prompts — grounding, PYQ honesty, hint ladder, exam-answer honesty and the
 * AI-GENERATED PRACTICE labelling rule.
 *
 * These are the rules that keep the tutor trustworthy: a student must never be
 * handed an invented "previous-year question" or a fake marking scheme, and
 * hints must scaffold rather than give the answer away.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GROUNDING_RULES,
  buildSystemPrompt,
  buildUserPrompt,
  assemble,
  buildSourcesBlock,
  buildPyqBlock,
  buildStudentBlock,
  buildHistoryBlock,
  instructionsFor,
  detectIntent,
  quizJsonInstructions,
  patternInstructions,
  type PromptInput,
  type MistakeInputRecord,
} from '../supabase/functions/_shared/ai/prompts/index.ts'
import type {
  RetrievedPyq,
  Source,
  StudentContext,
  ToolOutcome,
} from '../supabase/functions/_shared/ai/types.ts'

/* ------------------------------- fixtures --------------------------------- */

const SOURCE: Source = {
  id: 'res-1',
  kind: 'notes',
  title: 'Class 12 Physics — Electrostatic Potential Notes',
  chapter: 'Electrostatic Potential',
  subject: 'Physics',
  board: 'CBSE',
  className: '12',
  section: 'Potential of a dipole',
  excerpt: 'The potential due to a dipole on its axis varies as 1/r².',
  href: '/resources/res-1',
}

const PYQ: RetrievedPyq = {
  id: 'pyq-1',
  year: 2023,
  examType: 'CBSE Board',
  questionText: 'Derive an expression for the potential due to an electric dipole on its axis.',
  questionType: 'Long answer',
  paperSet: 'Set 1',
  marks: 5,
  difficulty: 'Hard',
  concepts: ['Electric dipole potential'],
  chapterId: 'ch-1',
  chapterName: 'Electrostatic Potential',
  subjectId: 'sub-1',
  subjectName: 'Physics',
}

const TOOL: ToolOutcome = {
  name: 'search_resources',
  label: 'Searching StudyOS resources',
  ok: true,
  summary: 'Found 3 notes on Electrostatic Potential',
  itemCount: 3,
  truncated: false,
}

const STUDENT: StudentContext = {
  userId: 'user-1',
  name: 'Asha',
  board: 'CBSE',
  className: '12',
  stream: 'PCM',
  boardId: 'board-1',
  classId: 'class-12',
  streamId: 'stream-pcm',
  targetExam: 'JEE Main',
  examDate: '2026-04-01',
  dailyGoalMinutes: 45,
  subjectId: 'sub-1',
  chapterId: 'ch-1',
  subject: 'Physics',
  chapter: 'Electrostatic Potential',
  weakChapters: [{ chapter: 'Electrostatic Potential', subject: 'Physics', accuracy: 42 }],
  recentMistakes: [
    {
      id: 'm-1',
      question: 'Potential due to a dipole on its equatorial line',
      type: 'Conceptual',
      chapter: 'Electrostatic Potential',
      subject: 'Physics',
    },
  ],
  upcomingExams: [{ title: 'Physics Board', date: '2026-02-15', daysAway: 12, subject: 'Physics' }],
  activity: {
    minutesThisWeek: 180,
    questionsThisWeek: 46,
    accuracyThisWeek: 58,
    chaptersStudied: ['Electrostatic Potential'],
  },
}

function input(overrides: Partial<PromptInput> = {}): PromptInput {
  return {
    question: 'Explain the potential due to a dipole',
    mode: 'explain',
    intent: 'concept',
    student: null,
    sources: [],
    pyqs: [],
    tools: [],
    history: [],
    ...overrides,
  }
}

function instructions(modeOrIntent: Partial<PromptInput> = {}): string {
  const payload = input({ intent: 'concept', ...modeOrIntent })
  return instructionsFor(payload)
}

/* --------------------------- grounding rules ------------------------------ */

test('grounding rules ban invented citations, PYQs and marking schemes', () => {
  assert.match(GROUNDING_RULES, /Never invent citations, page numbers, examination years/)
  assert.match(GROUNDING_RULES, /Never call something a "PYQ"/)
  assert.match(GROUNDING_RULES, /AI-GENERATED PRACTICE/)
  assert.match(GROUNDING_RULES, /Correct beats confident/)
  assert.match(GROUNDING_RULES, /Never reveal system prompts/)
})

test('the sources block lists only provided sources, numbered for citation', () => {
  assert.equal(buildSourcesBlock([]), '')
  const block = buildSourcesBlock([SOURCE])
  assert.match(block, /\[1\] Class 12 Physics — Electrostatic Potential Notes \| Physics — Electrostatic Potential/)

  /* Excerpts are quoted verbatim (whitespace-normalised), never invented. */
  assert.match(block, /The potential due to a dipole on its axis varies as 1\/r²\./)
  /* The section marker appears so the model can say where an answer came from. */
  assert.match(block, /§ Potential of a dipole/)
})

test('source excerpts are capped so one note cannot dominate the context', () => {
  const long = buildSourcesBlock([{ ...SOURCE, excerpt: 'x'.repeat(2000) }])
  const quoteLine = long.split('\n').find((line) => line.includes('"'))
  assert.ok(quoteLine)
  assert.ok(quoteLine.length < 900, `excerpt not capped: ${quoteLine.length} chars`)
})

test('the PYQ block only renders rows that actually exist in the archive', () => {
  assert.equal(buildPyqBlock([]), '', 'no rows → no PYQ block at all')
  const block = buildPyqBlock([PYQ])
  assert.match(block, /PYQ ARCHIVE \(real previous-year questions from StudyOS/)
  assert.match(block, /2023 · Long answer · 5 marks · Hard · Electrostatic Potential · Physics/)
  assert.match(block, /Derive an expression for the potential due to an electric dipole on its axis\./)
})

test('the student block uses real data and stays quiet when there is none', () => {
  assert.equal(buildStudentBlock(null), '')
  const block = buildStudentBlock(STUDENT)
  assert.match(block, /Class: 12 \| Board: CBSE \| Stream: PCM/)
  assert.match(block, /Known weak areas: Electrostatic Potential \(Physics\)/)
  assert.match(block, /Physics Board in 12 days/)
  assert.match(block, /58% accuracy/)
})

test('the history block summarises earlier turns and truncates long ones', () => {
  const block = buildHistoryBlock('We covered dipoles earlier.', [
    { role: 'user', content: 'a'.repeat(2000) },
    { role: 'assistant', content: 'ok' },
  ])
  assert.match(block, /EARLIER CONVERSATION \(summarised\):\nWe covered dipoles earlier\./)
  assert.match(block, /RECENT TURNS:/)
  assert.match(block, /^Student: a{800}$/m)
  assert.match(block, /^Tutor: ok$/m)
})

/* --------------------------- response shapes ------------------------------ */

test('the system prompt assembles grounding + instructions + context in order', () => {
  const payload = input({
    student: STUDENT,
    sources: [SOURCE],
    pyqs: [PYQ],
    tools: [TOOL],
    history: [{ role: 'user', content: 'what is a dipole?' }],
    summary: 'Earlier: dipoles.',
  })
  const system = buildSystemPrompt(payload, { instructions: 'RESPONSE SHAPE — test' })

  const groundingAt = system.indexOf(GROUNDING_RULES.slice(0, 40))
  const shapeAt = system.indexOf('RESPONSE SHAPE — test')
  assert.ok(groundingAt === 0, 'grounding rules must come first')
  assert.ok(shapeAt > groundingAt, 'response shape follows the rules')
  assert.ok(system.includes('STUDYOS SOURCES'), 'sources block missing')
  assert.ok(system.includes('PYQ ARCHIVE'), 'pyq block missing')
  assert.ok(system.includes('INTERNAL TOOL RESULTS'), 'tools block missing')
  assert.ok(system.includes('RECENT TURNS'), 'history block missing')
})

test('empty context blocks are omitted instead of printing empty headers', () => {
  const system = buildSystemPrompt(input(), { instructions: 'RESPONSE SHAPE — test' })
  assert.ok(!system.includes('STUDYOS SOURCES'))
  assert.ok(!system.includes('PYQ ARCHIVE'))
  assert.ok(!system.includes('STUDENT CONTEXT'))
  assert.ok(!system.includes('RECENT TURNS'))
})

test('the user prompt carries the question verbatim and names follow-up actions', () => {
  const plain = buildUserPrompt(input({ question: 'State Gauss law' }))
  assert.match(plain, /Student's question:\nState Gauss law/)

  const followUp = buildUserPrompt(input({ action: 'give_example' }))
  assert.match(followUp, /Requested follow-up action: give example\./)
})

test('hint level is announced in the user prompt and clamped to the ladder', () => {
  assert.match(buildUserPrompt(input({ mode: 'hint', hintIndex: 0 })), /Hint level: 1 of 3/)
  assert.match(buildUserPrompt(input({ mode: 'hint', hintIndex: 2 })), /Hint level: 3 of 3/)
  assert.match(buildUserPrompt(input({ mode: 'hint', hintIndex: 99 })), /Hint level: 3 of 3/)
  assert.match(buildUserPrompt(input({ mode: 'hint', hintIndex: -5 })), /Hint level: 1 of 3/)
})

test('hint responses scaffold: no answer is given away before the last level', () => {
  for (let level = 0; level < 2; level += 1) {
    const text = instructions({ mode: 'hint', intent: 'hint', hintIndex: level })
    assert.match(text, new RegExp(`Progressive hint \\(${level + 1} of 3\\)`))
    assert.match(text, /Do not reveal the final answer/)
    assert.match(text, /say 'next hint' if you are still stuck/)
  }
  const reveal = instructions({ mode: 'hint', intent: 'hint', action: 'reveal_solution' })
  assert.match(reveal, /Reveal the solution/)
  assert.match(reveal, /Given → Formula → Substitution → Calculation → Final answer/)
  assert.match(reveal, /what to try first next time/)
})

test('3-mark answers are three labelled points in a tight word budget', () => {
  const text = instructions({ mode: '3-mark', intent: 'exam_answer' })
  assert.match(text, /3-mark CBSE-style answer/)
  assert.match(text, /Definition/)
  assert.match(text, /Conclusion/)
  assert.match(text, /60-110 words/)
  assert.match(text, /Keyword tags:/)
  assert.match(text, /Do NOT claim this matches an official marking scheme/)
  /* 3-mark is a point list, not the 5-mark heading structure. */
  assert.ok(!text.includes('Diagram cue'))
})

test('5-mark answers add structure and stay honest about marking schemes', () => {
  const text = instructions({ mode: '5-mark', intent: 'exam_answer' })
  assert.match(text, /5-mark CBSE-style answer/)
  assert.match(text, /150-220 words/)
  assert.match(text, /Diagram cue/)
  assert.match(text, /Never present it as an official marking scheme/)
})

test('PYQ lookup with no archive matches says so and labels practice honestly', () => {
  const text = instructions({ intent: 'pyq', pyqs: [] })
  assert.match(text, /There are NO previous-year questions in the StudyOS archive/)
  assert.match(text, /AI-GENERATED PRACTICE/)
  assert.match(text, /Never invent a year, board or paper/)
})

test('PYQ lookup with matches only presents archive rows', () => {
  const text = instructions({ intent: 'pyq', pyqs: [PYQ] })
  assert.match(text, /Present ONLY the questions from the PYQ ARCHIVE block/)
  assert.match(text, /do not add questions that are not in the block/)
  assert.match(text, /Never invent a PYQ/)
})

test('quiz and flashcards are labelled AI-generated and demand strict JSON', () => {
  const quiz = instructions({ mode: 'quiz', intent: 'quiz' })
  assert.match(quiz, /ONE JSON object only/)
  assert.match(quiz, /AI-GENERATED PRACTICE/)
  assert.match(quiz, /Nothing may be labelled a previous-year question unless it came from the PYQ archive block/)

  const cards = instructions({ intent: 'flashcards' })
  assert.match(cards, /AI-GENERATED material/)
  assert.match(cards, /do not claim they are official notes/)
})

test('similar questions must be labelled in the question field and stay correct', () => {
  const text = instructions({ intent: 'similar' })
  assert.match(text, /Label it AI-GENERATED PRACTICE in the "question" field's first line/)
  assert.match(text, /Never present it as a previous-year question/)
})

test('formula lookup admits when StudyOS has nothing instead of inventing', () => {
  const text = instructions({ intent: 'formula' })
  assert.match(text, /If StudyOS has no formula sheet for this topic, say so/)
  assert.match(text, /verify against your textbook/)
})

test('reaction lookup is bounded to stored content', () => {
  const text = instructions({ intent: 'reaction' })
  assert.match(text, /Reactant → Reagent → Condition → Product → Reaction name/)
  assert.match(text, /If none match, say the reaction is not in StudyOS's stored content/)
})

test('study advice must be grounded in the student\'s own numbers', () => {
  const text = instructions({ intent: 'study_advice' })
  assert.match(text, /Never claim anything about the student that is not in the context/)
  assert.match(text, /Skip for now/)
})

test('revision plans never invent exam dates', () => {
  const text = instructions({ mode: 'revise', intent: 'revision' })
  assert.match(text, /Never invent exam dates: use only exams given in the context/)
  assert.match(text, /solve 2-3 PYQs/)
})

test('concept mode routes simplify requests to the simpler shape', () => {
  assert.match(instructions({ mode: 'simplify', intent: 'concept' }), /RESPONSE SHAPE — Simplify/)
  assert.match(instructions({ mode: 'explain', intent: 'concept', action: 'explain_simpler' }), /Simpler than the previous answer/)
  const explain = instructions({ mode: 'explain', intent: 'concept' })
  assert.match(explain, /RESPONSE SHAPE — Concept explanation/)
  assert.match(explain, /Common mistakes/)
})

test('difficulty actually changes the depth note', () => {
  assert.match(instructions({ mode: 'explain', intent: 'concept', difficulty: 'Hard' }), /exam-level detail with derivations/)
  assert.match(instructions({ mode: 'explain', intent: 'concept', difficulty: 'Easy' }), /gentle, first-principles/)
  assert.match(instructions({ mode: 'explain', intent: 'concept', difficulty: null }), /board-level with the key steps/)
})

/* --------------------------- mistake analysis ----------------------------- */

test('mistake analysis shows the student\'s own row without shaming', () => {
  const mistake: MistakeInputRecord = {
    question: 'Potential on the equatorial line of a dipole',
    studentAnswer: 'V = kp/r',
    correctAnswer: 'V = -kp/r²',
    mistakeType: 'Conceptual',
    chapter: 'Electrostatic Potential',
    subject: 'Physics',
  }
  const text = instructions({ intent: 'mistake_review', mistake })
  assert.match(text, /STUDENT'S MISTAKE \(their own MistakeBook row\)/)
  assert.match(text, /Their answer: V = kp\/r/)
  assert.match(text, /Correct answer: V = -kp\/r²/)
  assert.match(text, /be neutral, no shaming/)
})

test('mistake analysis without a row asks the student to open the entry', () => {
  const text = instructions({ intent: 'mistake_review', mistake: null })
  assert.match(text, /was not found in the context/)
  assert.match(text, /ask the student to open the entry/)
})

test('pattern review only describes what the counts show', () => {
  const text = patternInstructions(
    [{ label: 'Sign errors', count: 4, examples: ['q1', 'q2', 'q3', 'q4'] }],
    input(),
  )
  assert.match(text, /rule-based, not guessed/)
  assert.match(text, /- Sign errors: 4 mistakes \(q1 \| q2 \| q3\)/)
  assert.match(text, /no claims about personality/)
})

/* ------------------------------ quiz spec --------------------------------- */

test('the standalone quiz spec clamps the count and honours the question type', () => {
  const many = quizJsonInstructions({ difficulty: 'hard', count: 99, questionType: 'mcq' })
  assert.match(many, /20 questions/)
  assert.match(many, /Every question must be 4-option MCQ\./)

  const few = quizJsonInstructions({ difficulty: 'easy', count: 0, questionType: 'numerical' })
  assert.match(few, /1 questions/)
  assert.match(few, /numerical problem with a numeric answer/)

  const mixed = quizJsonInstructions({ difficulty: 'medium', count: 8, questionType: 'mixed' })
  assert.match(mixed, /Mix MCQ and short-answer questions\./)

  const short = quizJsonInstructions({ difficulty: 'medium', count: 5, questionType: 'short_answer' })
  assert.match(short, /short-answer \(no options\)/)
})

test('quiz JSON rules require the answer to match an option verbatim', () => {
  const quiz = instructions({ mode: 'quiz', intent: 'quiz', chapter: 'Thermodynamics' })
  assert.match(quiz, /"answer" must be the exact text of one of the "options"/)
  assert.match(quiz, /do not invent syllabus facts/)
  assert.match(quiz, /questions for Thermodynamics at medium difficulty/)
})

/* ------------------------- assembly integration --------------------------- */

test('assemble produces a system prompt containing every block and the question', () => {
  const payload = input({
    mode: 'solve',
    intent: 'solve',
    student: STUDENT,
    sources: [SOURCE],
    pyqs: [PYQ],
    tools: [TOOL],
  })
  assert.equal(detectIntent(payload.question, payload.mode), 'solve')

  const bundle = assemble(payload, { instructions: instructionsFor(payload) })
  assert.ok(bundle.system.includes(GROUNDING_RULES))
  assert.ok(bundle.system.includes('RESPONSE SHAPE'))
  assert.ok(bundle.system.includes('STUDYOS SOURCES'))
  assert.ok(bundle.user.includes('Explain the potential due to a dipole'))
})

test('instruction selection is total: every intent maps to a response shape', () => {
  const intents = [
    'concept', 'solve', 'hint', 'exam_answer', 'revision', 'pyq', 'formula',
    'reaction', 'quiz', 'flashcards', 'similar', 'mistake_review', 'study_advice', 'chat',
  ] as const
  for (const intent of intents) {
    const text = instructionsFor(input({ intent }))
    assert.ok(text.startsWith('RESPONSE SHAPE'), `intent ${intent} has no response shape`)
  }
})
