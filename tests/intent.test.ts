/**
 * Intent detection — unit tests.
 *
 * Intent drives retrieval, tools and response shape, so a wrong detection is a
 * wrong answer. These tests pin the behaviours that matter: mode chips are
 * honoured, structured features (quiz/PYQ/flashcards) can override them, and
 * anything unknown falls back to a concept explanation instead of guessing.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectIntent,
  needsRetrieval,
  responseTypeFor,
} from '../supabase/functions/_shared/ai/prompts/intent.ts'
import { AI_MODES, type AIMode } from '../supabase/functions/_shared/ai/types.ts'

test('an empty message resolves to whatever the selected mode means', () => {
  assert.equal(detectIntent('', 'explain'), 'concept')
  assert.equal(detectIntent('', 'hint'), 'hint')
  assert.equal(detectIntent('', 'quiz'), 'quiz')
  assert.equal(detectIntent('', 'revise'), 'revision')
  assert.equal(detectIntent('', '5-mark'), 'exam_answer')
  assert.equal(detectIntent('', 'simplify'), 'concept')
})

test('greetings and meta questions are plain chat (no retrieval)', () => {
  assert.equal(detectIntent('hi', 'explain'), 'chat')
  assert.equal(detectIntent('Hello, who are you?', 'explain'), 'chat')
  assert.equal(detectIntent('good morning', 'solve'), 'chat')
  assert.equal(needsRetrieval('chat'), false)
})

test('every mode has an intent and a response type', () => {
  for (const mode of AI_MODES) {
    const intent = detectIntent('', mode)
    assert.ok(typeof intent === 'string' && intent.length > 0, `no intent for mode ${mode}`)
    assert.ok(responseTypeFor(intent).length > 0, `no response type for intent ${intent}`)
  }
})

test('explicit structured features beat the selected mode', () => {
  assert.equal(detectIntent('Give me 5 MCQs on thermodynamics', 'explain'), 'quiz')
  assert.equal(detectIntent('make me flashcards for this chapter', 'explain'), 'flashcards')
  assert.equal(detectIntent('any previous year questions on this topic?', 'explain'), 'pyq')
  assert.equal(detectIntent('show me a similar question', 'explain'), 'similar')
})

test('a structural mode is honoured unless the text asks for a structured feature', () => {
  /* hint is structural: "solve this" while in hint mode stays a hint request. */
  assert.equal(detectIntent('solve 2x + 5 = 15', 'hint'), 'hint')
  /* …but "quiz me" in hint mode flips to quiz. */
  assert.equal(detectIntent('ok quiz me on this', 'hint'), 'quiz')
  assert.equal(detectIntent('solve this numerical', '3-mark'), 'exam_answer')
  assert.equal(detectIntent('any previous year questions here?', '5-mark'), 'pyq')
})

test('solve vocabulary is detected in explain mode', () => {
  assert.equal(detectIntent('calculate the electric field due to a dipole', 'explain'), 'solve')
  assert.equal(detectIntent('determine the value of g on the moon', 'explain'), 'solve')
})

test('hint vocabulary ("stuck", "nudge") is detected', () => {
  assert.equal(detectIntent("I'm stuck on step 2", 'explain'), 'hint')
  assert.equal(detectIntent('give me a clue', 'explain'), 'hint')
})

test('mistake review and study advice have their own intents', () => {
  assert.equal(detectIntent('explain my mistake in question 4', 'explain'), 'mistake_review')
  assert.equal(detectIntent('why was my answer wrong?', 'explain'), 'mistake_review')
  assert.equal(detectIntent('what should I study today?', 'explain'), 'study_advice')
  assert.equal(detectIntent('revise me for tomorrow', 'explain'), 'revision')
})

test('formula and reaction lookups are separated', () => {
  assert.equal(detectIntent('list the formulas in this chapter', 'explain'), 'formula')
  assert.equal(detectIntent('what is the reaction of phenol with NaOH?', 'explain'), 'reaction')
})

test('an explicit action chip wins over everything else', () => {
  assert.equal(detectIntent('anything at all', 'explain', 'show_pyqs'), 'pyq')
  assert.equal(detectIntent('anything at all', 'explain', 'quiz_me'), 'quiz')
  assert.equal(detectIntent('anything at all', 'explain', 'next_hint'), 'hint')
  assert.equal(detectIntent('anything at all', 'explain', 'reveal_solution'), 'solve')
})

test('non-chat intents always trigger retrieval', () => {
  assert.equal(needsRetrieval('concept'), true)
  assert.equal(needsRetrieval('pyq'), true)
  assert.equal(needsRetrieval('formula'), true)
  assert.equal(needsRetrieval('hint'), true)
})

test('response types map to the cards the UI can render', () => {
  const cases: Array<[Parameters<typeof responseTypeFor>[0], string]> = [
    ['hint', 'hint'],
    ['pyq', 'pyq_list'],
    ['formula', 'formula_list'],
    ['revision', 'revision_plan'],
    ['mistake_review', 'mistake_analysis'],
    ['quiz', 'quiz'],
    ['flashcards', 'flashcards'],
    ['similar', 'similar_question'],
    ['concept', 'answer'],
    ['solve', 'answer'],
    ['exam_answer', 'answer'],
    ['chat', 'answer'],
  ]
  for (const [intent, type] of cases) {
    assert.equal(responseTypeFor(intent), type)
  }
})

test('every mode constant stays in the published list (mode/intent tables stay in sync)', () => {
  const modes: AIMode[] = ['explain', 'solve', 'hint', '3-mark', '5-mark', 'revise', 'quiz', 'simplify']
  assert.deepEqual([...AI_MODES], modes)
})
