/**
 * Tool registry — the controlled internal functions the AI may invoke.
 *
 * Security properties (spec §36/§37):
 *   - fixed catalog, no dynamic SQL, no arbitrary queries;
 *   - every argument validated (uuid/enum/limit/text) by `validate.ts`;
 *   - identity always comes from `ToolContext.userId` — tools read the
 *     caller's own rows, and the queries repeat `user_id = …` on top of RLS;
 *   - academic reads use the caller's session client, so RLS still hides
 *     unpublished/draft content from retrieval;
 *   - results are bounded (`limit`) and return only the fields the prompt and
 *     the UI actually need.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { RetrievedChunk, RetrievedPyq, RetrievalFilters, ToolCall, ToolName, ToolOutcome } from '../types.ts'
import type { AiProvider } from '../providers/provider.interface.ts'
import { hybridSearch, searchPyqs, chunkToSource } from '../retrieval/search.ts'
import { TOOL_CATALOG } from './planner.ts'
import {
  clampLimit,
  optionalId,
  textQuery,
  ToolValidationError,
} from './validate.ts'
import { log, logToolCall } from '../../logging.ts'

export interface ToolContext {
  db: SupabaseClient
  userId: string
  filters: RetrievalFilters
  embeddingProvider?: AiProvider | null
}

export interface ToolExecution extends ToolOutcome {
  /** Structured payload the orchestrator may fold into its own context. */
  data: {
    chunks?: RetrievedChunk[]
    pyqs?: RetrievedPyq[]
    mistakes?: Array<{ id: string; question: string; type: string; chapter: string | null; answer: string | null }>
    exams?: Array<{ title: string; date: string; subject: string | null }>
    progress?: Array<{ chapter: string; subject: string; percent: number; lastStudied: string | null }>
    chapter?: { name: string; description: string | null; topics: string[]; resources: string[] }
    bookmarks?: number
  }
}

const LABELS: Record<ToolName, string> = Object.fromEntries(
  TOOL_CATALOG.map((entry) => [entry.name, entry.label]),
) as Record<ToolName, string>

function failure(name: ToolName, reason: string): ToolExecution {
  log('warn', 'ai.tool_failed', { tool: name, reason })
  return {
    name,
    label: LABELS[name] ?? name,
    ok: false,
    summary: `${name} could not be used for this question.`,
    itemCount: 0,
    truncated: false,
    data: {},
  }
}

/* --------------------------------- tools ---------------------------------- */

async function searchResources(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const query = textQuery(args.query, 'query')
  const limit = clampLimit(args.limit, 6)
  if (!query) throw new ToolValidationError('search_resources requires a query.')

  const result = await hybridSearch({
    db: ctx.db,
    query,
    filters: { ...ctx.filters, resourceType: null },
    limit,
    embeddingProvider: ctx.embeddingProvider ?? null,
  })

  return {
    name: 'search_resources',
    label: LABELS.search_resources,
    ok: true,
    summary: result.chunks.length
      ? `${result.chunks.length} StudyOS excerpts matched "${query.slice(0, 60)}" (${result.filteredBy})`
      : `No StudyOS excerpt matched "${query.slice(0, 60)}"`,
    itemCount: result.chunks.length,
    truncated: result.chunks.length >= limit,
    data: { chunks: result.chunks },
  }
}

async function searchPyqTool(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const query = textQuery(args.query, 'query')
  const limit = clampLimit(args.limit, 8)
  const year = typeof args.year === 'number' && args.year > 1989 ? Math.floor(args.year) : null

  const pyqs = await searchPyqs({
    db: ctx.db,
    query,
    filters: { ...ctx.filters, resourceType: null },
    limit,
    year,
  })

  return {
    name: 'search_pyqs',
    label: LABELS.search_pyqs,
    ok: true,
    summary: pyqs.length
      ? `${pyqs.length} real PYQ${pyqs.length === 1 ? '' : 's'}: ${pyqs
          .map((entry) => `${entry.year} (${entry.marks}m)`)
          .join(', ')}`
      : 'No previous-year questions matched that topic in the StudyOS archive.',
    itemCount: pyqs.length,
    truncated: pyqs.length >= limit,
    data: { pyqs },
  }
}

async function getChapter(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const chapterId = optionalId(args.chapterId, 'chapterId') ?? ctx.filters.chapterId ?? null
  if (!chapterId) throw new ToolValidationError('get_chapter requires a chapter.')

  const { data, error } = await ctx.db
    .from('chapters')
    .select('id, name, description, topics, subjects(name, slug), resources!inner(title, resource_type, is_published)')
    .eq('id', chapterId)
    .eq('resources.is_published', true)
    .limit(1)

  if (error) throw new Error(error.message)
  const row = (data as unknown as Array<{
    name: string
    description: string | null
    topics: string[] | null
    subjects: { name: string; slug: string } | null
    resources: Array<{ title: string; resource_type: string }> | { title: string; resource_type: string }
  }>)[0]

  if (!row) throw new ToolValidationError('Chapter not found.')

  const resources = Array.isArray(row.resources) ? row.resources : [row.resources]
  return {
    name: 'get_chapter',
    label: LABELS.get_chapter,
    ok: true,
    summary: `Chapter "${row.name}" (${row.subjects?.name ?? 'subject'}), ${row.topics?.length ?? 0} topics, ${resources.length} published resources`,
    itemCount: resources.length,
    truncated: false,
    data: {
      chapter: {
        name: row.name,
        description: row.description,
        topics: row.topics ?? [],
        resources: resources.map((entry) => `${entry.title} [${entry.resource_type}]`),
      },
    },
  }
}

async function getFormula(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const query = textQuery(args.query, 'query')
  const result = await hybridSearch({
    db: ctx.db,
    query,
    filters: { ...ctx.filters, resourceType: 'formula_sheet' },
    limit: 5,
    embeddingProvider: ctx.embeddingProvider ?? null,
  })

  return {
    name: 'get_formula',
    label: LABELS.get_formula,
    ok: true,
    summary: result.chunks.length
      ? `${result.chunks.length} formula-sheet entries matched`
      : 'No formula sheet matched in StudyOS.',
    itemCount: result.chunks.length,
    truncated: false,
    data: { chunks: result.chunks },
  }
}

async function getUserProgress(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const limit = clampLimit(args.limit, 6)
  const { data, error } = await ctx.db
    .from('user_chapter_progress')
    .select('completion_percent, last_studied_at, chapters(name, subjects(name))')
    .eq('user_id', ctx.userId)
    .order('last_studied_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{
    completion_percent: number
    last_studied_at: string | null
    chapters: { name: string; subjects: { name: string } | null } | null
  }>

  const progress = rows.map((row) => ({
    chapter: row.chapters?.name ?? 'Chapter',
    subject: row.chapters?.subjects?.name ?? 'Subject',
    percent: row.completion_percent,
    lastStudied: row.last_studied_at,
  }))

  return {
    name: 'get_user_progress',
    label: LABELS.get_user_progress,
    ok: true,
    summary: progress.length
      ? progress.map((entry) => `${entry.chapter} ${entry.percent}%`).join('; ')
      : 'No progress recorded yet.',
    itemCount: progress.length,
    truncated: progress.length >= limit,
    data: { progress },
  }
}

async function getUserMistakes(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const limit = clampLimit(args.limit, 6)
  const chapterId = optionalId(args.chapterId, 'chapterId')

  let query = ctx.db
    .from('mistakes')
    .select('id, question_text, mistake_type, correct_answer, resolved, chapters(name)')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (chapterId) query = query.eq('chapter_id', chapterId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    id: string
    question_text: string
    mistake_type: string
    correct_answer: string | null
    chapters: { name: string } | null
  }>

  const mistakes = rows.map((row) => ({
    id: row.id,
    question: row.question_text,
    type: row.mistake_type,
    chapter: row.chapters?.name ?? null,
    answer: row.correct_answer,
  }))

  return {
    name: 'get_user_mistakes',
    label: LABELS.get_user_mistakes,
    ok: true,
    summary: mistakes.length
      ? `${mistakes.length} recent mistake${mistakes.length === 1 ? '' : 's'}: ${mistakes
          .map((entry) => `${entry.type}`)
          .join(', ')}`
      : 'MistakeBook is empty for this period.',
    itemCount: mistakes.length,
    truncated: mistakes.length >= limit,
    data: { mistakes },
  }
}

async function getUpcomingExams(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const limit = clampLimit(args.limit, 5)
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await ctx.db
    .from('exams')
    .select('title, exam_date, subjects(name)')
    .eq('user_id', ctx.userId)
    .gte('exam_date', today)
    .order('exam_date', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ title: string; exam_date: string; subjects: { name: string } | null }>

  const exams = rows.map((row) => ({ title: row.title, date: row.exam_date, subject: row.subjects?.name ?? null }))

  return {
    name: 'get_upcoming_exams',
    label: LABELS.get_upcoming_exams,
    ok: true,
    summary: exams.length
      ? exams.map((entry) => `${entry.title} on ${entry.date}`).join('; ')
      : 'No upcoming exams on the calendar.',
    itemCount: exams.length,
    truncated: exams.length >= limit,
    data: { exams },
  }
}

async function getBookmarks(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecution> {
  const limit = clampLimit(args.limit, 8)
  const { data, error } = await ctx.db
    .from('bookmarks')
    .select('target_type, target_key')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ target_type: string; target_key: string }>

  return {
    name: 'get_bookmarks',
    label: LABELS.get_bookmarks,
    ok: true,
    summary: rows.length ? `${rows.length} saved item(s): ${rows.map((row) => row.target_type).join(', ')}` : 'No saved items yet.',
    itemCount: rows.length,
    truncated: rows.length >= limit,
    data: { bookmarks: rows.length },
  }
}

/* -------------------------------- execution -------------------------------- */

const HANDLERS: Record<ToolName, (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolExecution>> = {
  search_resources: searchResources,
  search_pyqs: searchPyqTool,
  get_chapter: getChapter,
  get_formula: getFormula,
  get_user_progress: getUserProgress,
  get_user_mistakes: getUserMistakes,
  get_upcoming_exams: getUpcomingExams,
  get_bookmarks: getBookmarks,
}

/** Execute one tool with full validation; failures never throw upwards. */
export async function runTool(call: ToolCall, ctx: ToolContext): Promise<ToolExecution> {
  const started = Date.now()
  const handler = HANDLERS[call.name]
  if (!handler) return failure(call.name, 'unknown tool')

  try {
    const execution = await handler(call.args ?? {}, ctx)
    logToolCall({
      tool: call.name,
      ok: execution.ok,
      items: execution.itemCount,
      ms: Date.now() - started,
    })
    return execution
  } catch (error) {
    const reason = error instanceof ToolValidationError ? error.message : 'execution failed'
    return failure(call.name, reason)
  }
}

/** Execute a plan (bounded, ordered, isolated failures). */
export async function runTools(calls: ToolCall[], ctx: ToolContext): Promise<ToolExecution[]> {
  const out: ToolExecution[] = []
  for (const call of calls.slice(0, 3)) {
    out.push(await runTool(call, ctx))
  }
  return out.filter((entry) => entry.ok)
}

/** Sources contributed by tool output (for citations). */
export function toolSources(executions: ToolExecution[]) {
  return executions.flatMap((execution) => (execution.data.chunks ?? []).map(chunkToSource))
}
