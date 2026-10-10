/**
 * Tool validation and planning — unit tests.
 *
 * Two hard guarantees are tested here:
 *   1. no tool can ever be pointed at another student (identity args rejected);
 *   2. every argument is bounded (no table-scan limits, no 10k-char queries).
 * Plus the planner bounds: at most MAX_TOOLS calls, invalid model plans dropped.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeToolCall,
  rejectIdentityArgs,
  textQuery,
  clampLimit,
  optionalId,
  requiredId,
  optionalEnum,
  ToolValidationError,
  TOOL_LIMITS,
} from '../supabase/functions/_shared/ai/tools/validate.ts'
import {
  planTools,
  parseModelPlan,
  toolPlanPrompt,
  TOOL_CATALOG,
  TOOL_NAMES,
  MAX_TOOLS,
} from '../supabase/functions/_shared/ai/tools/planner.ts'

const UUID = '4f1a2b3c-1111-4222-8333-444455556666'

/** Does the string contain any C0/C1 control character? */
function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 32 || code === 127) return true
  }
  return false
}

/* ---------------------------- identity safety ----------------------------- */

test('a tool can never target another user', () => {
  for (const key of ['user_id', 'userId', 'target_user', 'targetUserId', 'uid', 'owner_id']) {
    assert.throws(
      () => rejectIdentityArgs({ [key]: UUID }),
      ToolValidationError,
      `identity arg "${key}" was accepted`,
    )
  }
  /* Benign args still pass. */
  assert.doesNotThrow(() => rejectIdentityArgs({ query: 'gauss law', limit: 5 }))
})

test('sanitizeToolCall rejects unknown tools and identity args', () => {
  assert.throws(() => sanitizeToolCall({ name: 'run_sql' }, TOOL_NAMES), /Unknown tool/)
  assert.throws(
    () => sanitizeToolCall({ name: 42 as unknown as string }, TOOL_NAMES),
    /Malformed|Unknown tool/,
  )
  assert.throws(
    () => sanitizeToolCall({ name: 'get_user_mistakes', args: { user_id: UUID } }, TOOL_NAMES),
    /cannot target another user/,
  )
  assert.throws(() => sanitizeToolCall(null as never, TOOL_NAMES), /Malformed tool call/)

  const ok = sanitizeToolCall({ name: 'search_pyqs', args: { query: 'dipole', limit: 5 } }, TOOL_NAMES)
  assert.equal(ok.name, 'search_pyqs')
  assert.deepEqual(ok.args, { query: 'dipole', limit: 5 })
})

test('a non-object or array "args" is normalised to an empty object', () => {
  assert.deepEqual(sanitizeToolCall({ name: 'get_bookmarks', args: 'boom' as never }, TOOL_NAMES).args, {})
  assert.deepEqual(sanitizeToolCall({ name: 'get_bookmarks', args: [1, 2] as never }, TOOL_NAMES).args, {})
  assert.deepEqual(sanitizeToolCall({ name: 'get_bookmarks' }, TOOL_NAMES).args, {})
})

/* ----------------------------- argument bounds ---------------------------- */

test('queries are trimmed, whitespace-collapsed and capped', () => {
  assert.equal(textQuery('  Gauss   law \n '), 'Gauss law')
  assert.equal(textQuery('x'.repeat(500)).length, TOOL_LIMITS.query)
  assert.equal(textQuery(null), '')
  assert.equal(textQuery(undefined), '')
  assert.throws(() => textQuery(123), ToolValidationError)
})

test('control characters never survive into a tool argument', () => {
  const control = String.fromCharCode(0)
  const nasty = `gauss${control}law${String.fromCharCode(10)}flux${String.fromCharCode(13)}`
  const clean = textQuery(nasty)
  assert.ok(!hasControlChars(clean), `control chars survived: ${JSON.stringify(clean)}`)
  assert.equal(clean, 'gauss law flux')
})

test('limits are clamped into a sane range', () => {
  assert.equal(clampLimit(5), 5)
  assert.equal(clampLimit(0), 1)
  assert.equal(clampLimit(-10), 1)
  assert.equal(clampLimit(9999), TOOL_LIMITS.limit)
  assert.equal(clampLimit('7'), 7)
  assert.equal(clampLimit('not a number'), TOOL_LIMITS.defaultLimit)
  assert.equal(clampLimit(undefined), TOOL_LIMITS.defaultLimit)
  assert.equal(clampLimit(3.9), 3)
})

test('ids must be uuids or be absent — never arbitrary strings', () => {
  assert.equal(optionalId(null, 'chapterId'), null)
  assert.equal(optionalId('', 'chapterId'), null)
  assert.equal(optionalId(UUID, 'chapterId'), UUID)
  assert.throws(() => optionalId('1 OR 1=1', 'chapterId'), ToolValidationError)
  assert.throws(() => optionalId("'; DROP TABLE resources; --", 'chapterId'), ToolValidationError)
  assert.throws(() => requiredId(null, 'chapterId'), /Missing value/)
  assert.throws(() => requiredId(UUID.slice(0, 30), 'chapterId'), ToolValidationError)
})

test('optional enums only accept whitelisted values', () => {
  const allowed = ['easy', 'medium', 'hard'] as const
  assert.equal(optionalEnum('hard', allowed), 'hard')
  assert.equal(optionalEnum('HARD', allowed), null)
  assert.equal(optionalEnum('nightmare', allowed), null)
  assert.equal(optionalEnum('', allowed), null)
  assert.equal(optionalEnum(null, allowed), null)
})

/* -------------------------------- planner --------------------------------- */

test('the deterministic plan maps intents onto the tools they need', () => {
  const pyq = planTools({ intent: 'pyq', question: 'past year questions on dipoles', hasFocus: false })
  assert.deepEqual(pyq.map((call) => call.name), ['search_pyqs'])

  const formula = planTools({ intent: 'formula', question: 'list the formulas', hasFocus: false })
  assert.deepEqual(formula.map((call) => call.name), ['get_formula'])

  const revision = planTools({ intent: 'revision', question: 'revise me', hasFocus: false })
  assert.deepEqual(
    revision.map((call) => call.name),
    ['get_user_mistakes', 'get_upcoming_exams', 'get_user_progress'],
  )
})

test('personal-data tools only appear where they make sense', () => {
  /* Plain concept chat with no focus runs no tools at all. */
  assert.deepEqual(planTools({ intent: 'concept', question: 'what is flux?', hasFocus: false }), [])
  /* Concept with a focused chapter opens that chapter for grounding. */
  const focused = planTools({ intent: 'concept', question: 'what is flux?', hasFocus: true, chapterId: UUID })
  assert.deepEqual(focused.map((call) => call.name), ['get_chapter'])
  assert.equal(focused[0].args.chapterId, UUID)
})

test('the plan never exceeds MAX_TOOLS and never repeats a tool', () => {
  const revision = planTools({ intent: 'revision', question: 'my saved bookmarks please', hasFocus: false })
  assert.ok(revision.length <= MAX_TOOLS)
  const names = revision.map((call) => call.name)
  assert.equal(new Set(names).size, names.length, `duplicate tools: ${names.join(', ')}`)
  /* 3 revision tools + bookmark keyword would be 4 → capped at MAX_TOOLS. */
  assert.equal(revision.length, MAX_TOOLS)
})

test('a "bookmark/saved" keyword adds the bookmarks tool to any intent', () => {
  const plan = planTools({ intent: 'pyq', question: 'pyqs I saved', hasFocus: false })
  assert.ok(plan.some((call) => call.name === 'get_bookmarks'))
})

test('model plans are parsed from JSON, markdown fences and arrays', () => {
  const object = parseModelPlan('{"tools":[{"name":"search_pyqs","args":{"query":"dipole"}}]}')
  assert.deepEqual(object, [{ name: 'search_pyqs', args: { query: 'dipole' } }])

  const fenced = parseModelPlan('```json\n{"tools":[{"name":"get_formula","args":{}}]}\n```')
  assert.deepEqual(fenced.map((call) => call.name), ['get_formula'])

  const bare = parseModelPlan('[{"name":"get_bookmarks","args":{"limit":3}}]')
  assert.deepEqual(bare, [{ name: 'get_bookmarks', args: { limit: 3 } }])
})

test('invalid model plans are dropped, never executed', () => {
  assert.deepEqual(parseModelPlan('no json here at all'), [])
  assert.deepEqual(parseModelPlan('{"tools": "not an array"}'), [])

  /* Mixed valid/invalid: only the valid, safe calls survive. */
  const mixed = parseModelPlan(
    JSON.stringify({
      tools: [
        { name: 'run_sql', args: { query: 'select * from profiles' } },
        { name: 'get_user_mistakes', args: { user_id: UUID } },
        { name: 'search_resources', args: { query: 'gauss law' } },
        'garbage',
      ],
    }),
  )
  assert.deepEqual(mixed.map((call) => call.name), ['search_resources'])
})

test('a model plan is bounded to MAX_TOOLS even if it asks for more', () => {
  const many = JSON.stringify({
    tools: TOOL_NAMES.map((name) => ({ name, args: {} })),
  })
  assert.equal(parseModelPlan(many).length, MAX_TOOLS)
})

test('the plan prompt shows only catalog tools and forbids inventing names', () => {
  const prompt = toolPlanPrompt('what is gauss law?', 'concept')
  assert.match(prompt, /Detected intent: concept/)
  assert.match(prompt, /Choose at most 3 internal tools/)
  assert.match(prompt, /Never invent tool names/)
  for (const tool of TOOL_CATALOG) {
    assert.ok(prompt.includes(tool.name), `catalog tool ${tool.name} missing from the prompt`)
  }
  assert.ok(!prompt.includes('run_sql'))
  assert.ok(!prompt.includes('user_id'), 'the prompt must not suggest identity args')
})

test('every catalog entry declares its args and marks personal tools', () => {
  const personal = TOOL_CATALOG.filter((tool) => tool.personal).map((tool) => tool.name)
  assert.deepEqual(
    personal.sort(),
    ['get_bookmarks', 'get_upcoming_exams', 'get_user_mistakes', 'get_user_progress'],
  )
  for (const tool of TOOL_CATALOG) {
    assert.ok(tool.label.length > 0)
    assert.ok(tool.description.length > 0)
    assert.ok(!tool.args.includes('user_id'))
  }
})
