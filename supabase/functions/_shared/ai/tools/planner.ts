/**
 * Tool planner (pure — unit-tested).
 *
 * Two strategies, both bounded to `MAX_TOOLS` calls:
 *   - `planTools()`  deterministic mapping from the detected intent → the tools
 *     that intent needs (default: cheap, predictable, no extra model call);
 *   - `parseModelPlan()` parses an optional model-chosen plan
 *     (AI_TOOL_PLANNING=llm) — still validated by `sanitizeToolCall()`.
 *
 * There is never arbitrary SQL: the model only ever picks from this catalog.
 */
import type { AIIntent, ToolCall, ToolName } from '../types.ts'
import { sanitizeToolCall, type ToolCallRaw } from './validate.ts'

export const MAX_TOOLS = 3

export const TOOL_NAMES = [
  'search_resources',
  'search_pyqs',
  'get_chapter',
  'get_formula',
  'get_user_progress',
  'get_user_mistakes',
  'get_upcoming_exams',
  'get_bookmarks',
] as const

export interface ToolCatalogEntry {
  name: ToolName
  label: string
  description: string
  /** Arguments the tool accepts (besides the implicit authenticated user). */
  args: string[]
  /** Only for personal data — never available to anonymous/public flows. */
  personal: boolean
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  { name: 'search_resources', label: 'Searching StudyOS resources', description: 'Semantic search across notes, revision notes and approved content.', args: ['query', 'limit'], personal: false },
  { name: 'search_pyqs', label: 'Searching the PYQ archive', description: 'Real previous-year questions with year, marks and difficulty.', args: ['query', 'limit', 'year', 'marks'], personal: false },
  { name: 'get_chapter', label: 'Opening the chapter', description: 'Chapter description, topics and resource list.', args: ['chapterId', 'slug'], personal: false },
  { name: 'get_formula', label: 'Looking up formulas', description: 'Formula sheets for the chapter/subject.', args: ['query'], personal: false },
  { name: 'get_user_progress', label: 'Checking your progress', description: 'The student’s own chapter progress and accuracy.', args: ['limit'], personal: true },
  { name: 'get_user_mistakes', label: 'Reading your MistakeBook', description: 'The student’s own recent mistakes.', args: ['limit', 'chapterId'], personal: true },
  { name: 'get_upcoming_exams', label: 'Checking your exams', description: 'The student’s upcoming exams.', args: ['limit'], personal: true },
  { name: 'get_bookmarks', label: 'Checking your saved items', description: 'The student’s bookmarks/favourites.', args: ['limit'], personal: true },
]

export interface PlanInput {
  intent: AIIntent
  question: string
  /** Focus subject/chapter is known for this conversation. */
  hasFocus: boolean
  chapterId?: string | null
  subjectId?: string | null
}

function call(name: ToolName, args: Record<string, unknown> = {}): ToolCall {
  return { name, args }
}

/** Deterministic intent → tools mapping (default strategy). */
export function planTools(input: PlanInput): ToolCall[] {
  const question = input.question
  const calls: ToolCall[] = []

  switch (input.intent) {
    case 'pyq':
      calls.push(call('search_pyqs', { query: question, limit: 8 }))
      break

    case 'formula':
    case 'reaction':
      calls.push(call('get_formula', { query: question }))
      break

    case 'mistake_review':
      calls.push(call('get_user_mistakes', { limit: 5, ...(input.chapterId ? { chapterId: input.chapterId } : {}) }))
      if (input.hasFocus) calls.push(call('get_chapter', { chapterId: input.chapterId ?? undefined }))
      break

    case 'revision':
    case 'study_advice':
      calls.push(call('get_user_mistakes', { limit: 5 }))
      calls.push(call('get_upcoming_exams', { limit: 3 }))
      calls.push(call('get_user_progress', { limit: 5 }))
      break

    case 'quiz':
    case 'flashcards':
    case 'similar':
      if (input.hasFocus) calls.push(call('get_chapter', { chapterId: input.chapterId ?? undefined }))
      break

    case 'exam_answer':
    case 'solve':
      calls.push(call('search_pyqs', { query: question, limit: 4 }))
      break

    case 'concept':
    case 'hint':
      if (input.hasFocus) calls.push(call('get_chapter', { chapterId: input.chapterId ?? undefined }))
      break

    default:
      /* chat / unknown — no tools needed. */
      break
  }

  if (/\b(bookmark|saved|favourite|favorite)\b/i.test(question)) {
    calls.push(call('get_bookmarks', { limit: 8 }))
  }

  return dedupe(calls).slice(0, MAX_TOOLS)
}

function dedupe(calls: ToolCall[]): ToolCall[] {
  const seen = new Set<string>()
  return calls.filter((entry) => {
    if (seen.has(entry.name)) return false
    seen.add(entry.name)
    return true
  })
}

/**
 * Parse a model-produced plan:
 *   {"tools":[{"name":"search_pyqs","args":{"query":"…"}}]}
 * Anything invalid is dropped (and logged by the caller) — never executed.
 */
export function parseModelPlan(raw: string): ToolCall[] {
  const start = raw.search(/[[{]/)
  if (start === -1) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start)) as unknown
  } catch {
    /* Try trimming a trailing markdown fence. */
    const cleaned = raw.replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim()
    try {
      parsed = JSON.parse(cleaned.slice(cleaned.search(/[[{]/))) as unknown
    } catch {
      return []
    }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { tools?: unknown }).tools)
      ? ((parsed as { tools: unknown[] }).tools)
      : []

  const calls: ToolCall[] = []
  for (const entry of list) {
    try {
      const { name, args } = sanitizeToolCall(entry as ToolCallRaw, TOOL_NAMES)
      calls.push({ name: name as ToolName, args })
    } catch {
      /* drop invalid calls silently — the deterministic plan still stands */
    }
    if (calls.length >= MAX_TOOLS) break
  }
  return calls
}

/** Prompt body asking the model which tools it wants (AI_TOOL_PLANNING=llm). */
export function toolPlanPrompt(question: string, intent: AIIntent): string {
  const catalog = TOOL_CATALOG.map(
    (tool) => `- ${tool.name}: ${tool.description} (args: ${tool.args.join(', ') || 'none'})`,
  ).join('\n')

  return `Detected intent: ${intent}
Question: ${question}

Choose at most ${MAX_TOOLS} internal tools whose output would make the answer more accurate.
${catalog}

Reply with JSON only:
{"tools":[{"name":"<tool>","args":{}}]}
Reply {"tools":[]} if no tool is needed. Never invent tool names.`
}
