/**
 * Retrieval filters — unit tests.
 *
 * The filters decide which StudyOS material a question may be answered from.
 * The student's own curriculum is the default; naming another class explicitly
 * relaxes the constraint; formula lookups prefer formula sheets.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRetrievalFilters,
  resourceTypeForIntent,
  asksOutsideCurriculum,
  describeFilters,
  hasAcademicFilter,
} from '../supabase/functions/_shared/ai/retrieval/filters.ts'
import type { AIIntent } from '../supabase/functions/_shared/ai/types.ts'

const PROFILE = { boardId: 'board-cbse', classId: 'class-12', streamId: 'stream-pcm' }
const FOCUS = { subjectId: 'sub-physics', chapterId: 'ch- electrostatics' }

test('the student\'s own curriculum constrains the search by default', () => {
  const filters = buildRetrievalFilters({ profile: PROFILE, intent: 'concept', question: 'what is flux?' })
  assert.equal(filters.boardId, 'board-cbse')
  assert.equal(filters.classId, 'class-12')
  assert.equal(filters.streamId, 'stream-pcm')
  assert.ok(hasAcademicFilter(filters))
})

test('a focused chapter narrows retrieval further', () => {
  const filters = buildRetrievalFilters({
    profile: PROFILE,
    focus: FOCUS,
    intent: 'concept',
    question: 'explain this',
  })
  assert.equal(filters.chapterId, 'ch- electrostatics')
  assert.equal(filters.subjectId, 'sub-physics')
  assert.equal(describeFilters(filters), 'chapter/board/class')
})

test('naming another class explicitly drops the class/board constraint', () => {
  const filters = buildRetrievalFilters({
    profile: PROFILE,
    intent: 'concept',
    question: 'give me class 10 notes on photosynthesis',
  })
  assert.equal(filters.classId, null, 'explicit request should relax the class constraint')
  assert.equal(filters.boardId, null)
  /* Chapter/subject focus is untouched — only curriculum scope relaxes. */
})

test('a question without a named class keeps the curriculum constraint', () => {
  const filters = buildRetrievalFilters({
    profile: PROFILE,
    intent: 'concept',
    question: 'explain photosynthesis',
  })
  assert.equal(filters.classId, 'class-12')
})

test('asksOutsideCurriculum only fires for a real class number', () => {
  assert.equal(asksOutsideCurriculum('class 10 notes please'), true)
  assert.equal(asksOutsideCurriculum('class 8 board paper'), true)
  assert.equal(asksOutsideCurriculum('explain the class of a wave'), false)
  assert.equal(asksOutsideCurriculum('no class mentioned'), false)
})

test('formula and reaction intents prefer formula sheets', () => {
  assert.equal(resourceTypeForIntent('formula'), 'formula_sheet')
  assert.equal(resourceTypeForIntent('reaction'), 'formula_sheet')
})

test('revision and exam answers search everything the student may read', () => {
  const intents: AIIntent[] = ['revision', 'exam_answer', 'study_advice', 'concept', 'pyq', 'solve']
  for (const intent of intents) {
    assert.equal(resourceTypeForIntent(intent), null, `${intent} should not filter by type`)
  }
})

test('anonymous students get unfiltered (but still safe) retrieval', () => {
  const filters = buildRetrievalFilters({ intent: 'concept', question: 'what is flux?' })
  assert.equal(filters.boardId, undefined)
  assert.equal(filters.classId, undefined)
  assert.ok(!hasAcademicFilter(filters))
  assert.equal(describeFilters(filters), 'unfiltered')
})

test('describeFilters summarises what actually constrains the search', () => {
  assert.equal(describeFilters({}), 'unfiltered')
  assert.equal(describeFilters({ subjectId: 's' }), 'subject')
  assert.equal(describeFilters({ subjectId: 's', chapterId: 'c' }), 'chapter')
  assert.equal(describeFilters({ resourceType: 'formula_sheet' }), 'type:formula_sheet')
  assert.equal(describeFilters({ boardId: 'b', classId: 'c' }), 'board/class')
})

test('hasAcademicFilter ignores a resource-type-only filter', () => {
  assert.ok(!hasAcademicFilter({ resourceType: 'formula_sheet' }))
  assert.ok(hasAcademicFilter({ subjectId: 's' }))
})
