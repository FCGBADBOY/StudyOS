/**
 * Chat orchestrator — the full StudyOS AI pipeline for one request:
 *
 *   validate → conversation → student context → rate limit →
 *   intent → retrieval (vector + keyword + academic filters) → tools →
 *   prompt assembly → generate (stream) → sources/meta → persist →
 *   usage + analytics
 *
 * Emits the typed event protocol consumed by `sse.ts` (and, in JSON mode,
 * folded into one document). Every step degrades gracefully: a failed
 * retrieval or summarisation never fails the request.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { AiEnv } from '../env.ts'
import type { AiEvent } from '../../sse.ts'
import { AppError, toAppError } from '../../http.ts'
import { log, logRequestStarted } from '../../logging.ts'
import {
  assemble,
  detectIntent,
  instructionsFor,
  needsRetrieval,
  responseTypeFor,
} from '../prompts/index.ts'
import { buildRetrievalFilters } from '../retrieval/filters.ts'
import type {
  AIAction,
  AIMode,
  ChatRequest,
  ResponseMeta,
  Source,
  StudentContext,
  ToolOutcome,
} from '../types.ts'
import { isAiMode } from '../types.ts'
import type { AiProvider } from '../providers/provider.interface.ts'
import { extractJson } from '../providers/provider.interface.ts'
import { buildStudentContext, type FocusIds } from './context.ts'
import { chunkToSource, dedupeSources, hybridSearch, pyqToSource, searchPyqs } from '../retrieval/search.ts'
import { planTools, parseModelPlan, toolPlanPrompt } from '../tools/planner.ts'
import { runTools, type ToolExecution } from '../tools/registry.ts'
import { enforceLimits, recordUsage } from './usage.ts'
import { recordEvent } from './analytics.ts'
import {
  appendMessage,
  dropLastAssistant,
  ensureConversation,
  loadHistory,
  MAX_MESSAGE_CHARS,
  RECENT_WINDOW,
  splitHistory,
  summarizeOlder,
} from './conversation.ts'
import type { QuizItem, FlashcardItem } from '../types.ts'

export interface ChatDeps {
  userId: string
  /** Caller session — RLS applies (profile, progress, mistakes, archives). */
  db: SupabaseClient
  /** Service role — usage/analytics writes, always user-scoped in SQL. */
  admin: SupabaseClient
  provider: AiProvider
  embeddingProvider: AiProvider | null
  env: AiEnv
}

export interface ChatMeta extends ResponseMeta {
  quiz?: QuizItem[]
  flashcards?: FlashcardItem[]
  similar?: { question: string; answer: string; approach: string[]; difficulty: string; marks: number }
}

export interface ChatDonePayload {
  conversationId: string
  messageId: string | null
  latencyMs: number
  text: string
  meta: ChatMeta
  usage: { inputTokens: number | null; outputTokens: number | null }
}

const JSON_INTENTS = new Set(['quiz', 'flashcards', 'similar'])
const PYQ_INTENTS = new Set(['pyq', 'exam_answer', 'solve', 'revision'])

function validateRequest(request: ChatRequest): { message: string; mode: AIMode } {
  const message = (request.message ?? '').trim()
  if (!message) throw new AppError('invalid_request', 'Ask a question first.')
  if (message.length > MAX_MESSAGE_CHARS) {
    throw new AppError('invalid_request', 'That message is too long — try a shorter version.')
  }
  const mode = isAiMode(request.mode) ? request.mode : 'explain'
  return { message, mode }
}

/** Related follow-ups the UI can offer — from real archive rows when possible. */
function relatedQuestions(
  intent: string,
  pyqs: Array<{ questionText: string }>,
  student: StudentContext,
): string[] {
  if (intent === 'pyq' || intent === 'exam_answer') {
    return pyqs.slice(0, 3).map((entry) => entry.questionText.slice(0, 120))
  }
  const fromMistakes = student.recentMistakes.slice(0, 2).map((entry) => entry.question.slice(0, 100))
  const fromWeak = student.weakChapters.slice(0, 2).map((entry) => `Revise ${entry.chapter}`)
  return [...fromMistakes, ...fromWeak].slice(0, 3)
}

export async function* runChat(request: ChatRequest, deps: ChatDeps): AsyncGenerator<AiEvent, void, void> {
  const startedAt = Date.now()
  const { message, mode } = validateRequest(request)
  const focus: FocusIds = {
    subjectId: request.focus?.subjectId ?? null,
    chapterId: request.focus?.chapterId ?? null,
  }
  const action = request.action ?? request.focus?.action
  const hintIndex = request.focus?.hintIndex ?? 0

  logRequestStarted('ai.chat_started', {
    userId: deps.userId,
    mode,
    hasConversation: Boolean(request.conversationId),
    messageChars: message.length,
  })

  /* 1 — conversation thread (created on first message). */
  const conversation = await ensureConversation(deps.admin, deps.userId, {
    conversationId: request.conversationId ?? null,
    message,
    mode,
    subjectId: focus.subjectId,
    chapterId: focus.chapterId,
  })

  if (request.regenerate) await dropLastAssistant(deps.admin, deps.userId, conversation.id)

  const history = await loadHistory(deps.db, deps.userId, conversation.id)
  const { older, recent } = splitHistory(history.turns)

  /* 2 — student context (own rows only). */
  yield { type: 'status', label: 'Reading your study context' }
  const student = await buildStudentContext(deps.db, deps.userId, focus)

  /* 3 — server-side rate limits. */
  await enforceLimits(deps.admin, deps.userId, 'chat')

  /* 4 — intent + academic filters. */
  const intent = detectIntent(message, mode, action)
  const filters = buildRetrievalFilters({
    profile: { boardId: student.boardId, classId: student.classId, streamId: student.streamId },
    focus,
    intent,
    question: message,
  })

  /* 5 — retrieval: hybrid vector + keyword, then the PYQ archive when useful. */
  let sources: Source[] = []
  let pyqs: Awaited<ReturnType<typeof searchPyqs>> = []
  let retrievalUsed = false
  let usedVector = false

  if (needsRetrieval(intent)) {
    yield { type: 'status', label: 'Searching StudyOS library' }
    const result = await hybridSearch({
      db: deps.db,
      query: message,
      filters,
      limit: deps.env.topK,
      embeddingProvider: deps.embeddingProvider,
    })
    retrievalUsed = true
    usedVector = result.usedVector
    sources = result.chunks.map(chunkToSource)

    if (PYQ_INTENTS.has(intent)) {
      yield { type: 'status', label: 'Checking the PYQ archive' }
      pyqs = await searchPyqs({ db: deps.db, query: message, filters, limit: 8 })
      sources = [...sources, ...pyqs.map(pyqToSource)]
    }
  }

  /* 6 — permission-aware internal tools. */
  let executions: ToolExecution[] = []
  if (intent !== 'chat') {
    const plan =
      deps.env.toolPlanning === 'llm'
        ? await planWithModel(deps.provider, message, intent).catch(() => planTools({ intent, question: message, hasFocus: Boolean(focus.chapterId), chapterId: focus.chapterId, subjectId: focus.subjectId }))
        : planTools({
            intent,
            question: message,
            hasFocus: Boolean(focus.chapterId),
            chapterId: focus.chapterId,
            subjectId: focus.subjectId,
          })

    for (const call of plan) {
      const outcome = await runTools([call], {
        db: deps.db,
        userId: deps.userId,
        filters,
        embeddingProvider: deps.embeddingProvider,
      })
      if (outcome[0]) {
        executions.push(outcome[0])
        yield { type: 'status', label: outcome[0].label }
      }
    }
    sources = [...sources, ...executions.flatMap((entry) => (entry.data.chunks ?? []).map(chunkToSource))]
    if (executions.some((entry) => entry.name === 'search_pyqs' && entry.data.pyqs?.length)) {
      pyqs = executions.flatMap((entry) => entry.data.pyqs ?? [])
      sources = [...sources, ...pyqs.map(pyqToSource)]
    }
  }

  sources = dedupeSources(sources).slice(0, 8)

  /* 7 — conversation context (rolling summary for older turns). */
  let summary = conversation.summary
  if (older.length) summary = await summarizeOlder(deps.provider, deps.admin, deps.userId, conversation, older)
  const recentTurns = recent.slice(-RECENT_WINDOW)

  /* 8 — response metadata (known before generation → shown immediately). */
  const bestScore = sources.reduce((best, entry) => Math.max(best, entry.score ?? 0), 0)
  const confidence = sources.length === 0 ? 0.35 : bestScore >= 0.5 ? 0.85 : bestScore >= 0.3 ? 0.7 : 0.55

  const meta: ChatMeta = {
    type: responseTypeFor(intent) as ResponseMeta['type'],
    intent,
    mode,
    confidence,
    sources,
    relatedQuestions: relatedQuestions(intent, pyqs, student),
    subject: student.subject,
    chapter: student.chapter,
    tools: executions.map((entry) => entry.name),
    retrievalUsed,
    grounded: sources.length > 0,
    ...(intent === 'hint'
      ? { hint: { index: hintIndex, total: 3, hasMore: hintIndex < 2 && action !== 'reveal_solution' } }
      : {}),
  }

  yield { type: 'meta', meta }

  const mistake =
    intent === 'mistake_review' ? await loadMistake(deps, request.focus?.mistakeId ?? null) : null

  const promptInput = {
    question: message,
    mode,
    intent,
    action: action as AIAction | undefined,
    hintIndex,
    student,
    subject: student.subject,
    chapter: student.chapter,
    difficulty: request.focus?.difficulty ?? null,
    sources,
    pyqs,
    tools: executions.map(
      (entry): ToolOutcome => ({
        name: entry.name,
        label: entry.label,
        ok: entry.ok,
        summary: entry.summary,
        itemCount: entry.itemCount,
        truncated: entry.truncated,
      }),
    ),
    summary,
    history: recentTurns,
    mistake,
  }

  const bundle = assemble(promptInput, { instructions: instructionsFor(promptInput) })

  await appendMessage(deps.admin, deps.userId, conversation.id, {
    role: 'user',
    content: message,
    mode,
    meta: { intent, action: action ?? null },
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.env.requestTimeoutMs)

  let text = ''
  let inputTokens: number | null = null
  let outputTokens: number | null = null

  try {
    const messages = [
      { role: 'system' as const, content: bundle.system },
      { role: 'user' as const, content: bundle.user },
    ]

    if (JSON_INTENTS.has(intent)) {
      /* Structured features return JSON (quiz / flashcards / similar). */
      yield { type: 'status', label: 'Building your practice set' }
      const result = await deps.provider.generateText({
        messages,
        json: true,
        maxTokens: Math.min(2400, deps.env.maxOutputTokens * 2),
        temperature: 0.6,
        signal: controller.signal,
      })
      inputTokens = result.inputTokens ?? null
      outputTokens = result.outputTokens ?? null
      const parsed = parseStructured(intent, result.text, promptInput)
      text = parsed.text
      Object.assign(meta, parsed.extra)
      meta.grounded = sources.length > 0
      yield { type: 'delta', text }
    } else {
      yield { type: 'status', label: 'Writing the answer' }
      try {
        for await (const delta of deps.provider.streamText({
          messages,
          maxTokens: deps.env.maxOutputTokens,
          temperature: 0.4,
          signal: controller.signal,
        })) {
          text += delta
          yield { type: 'delta', text: delta }
        }
      } catch (error) {
        if (!text) throw error
        /* Partial stream: keep what we got and report honestly. */
        const appError = toAppError(error)
        log('warn', 'ai.stream_interrupted', { code: appError.code })
        yield { type: 'error', code: appError.code, message: appError.message }
      }
    }
  } finally {
    clearTimeout(timer)
  }

  /* 9 — persist the answer (metadata only; no secrets, no provider state). */
  const messageId = await persistAssistant(deps, conversation.id, mode, text, meta)

  /* 10 — metering + analytics (never blocking the response). */
  await recordUsage(deps.admin, deps.userId, 'chat', { input: inputTokens ?? undefined, output: outputTokens ?? undefined })
  await recordEvent(deps.admin, {
    userId: deps.userId,
    conversationId: conversation.id,
    feature: 'chat',
    subjectId: focus.subjectId ?? null,
    chapterId: focus.chapterId ?? null,
    questionType: intent,
    latencyMs: Date.now() - startedAt,
    retrievalUsed,
    sourceCount: sources.length,
    provider: deps.provider.name,
    model: deps.provider.model,
    status: 'ok',
  })

  log('info', 'ai.chat_completed', {
    conversationId: conversation.id,
    intent,
    mode,
    sources: sources.length,
    usedVector,
    ms: Date.now() - startedAt,
    chars: text.length,
  })

  const payload: ChatDonePayload = {
    conversationId: conversation.id,
    messageId,
    latencyMs: Date.now() - startedAt,
    text,
    meta,
    usage: { inputTokens, outputTokens },
  }

  yield { type: 'done', payload }
}

/* --------------------------------- helpers -------------------------------- */

/** Own MistakeBook row for "explain my mistake" (explicit id or latest open). */
async function loadMistake(
  deps: ChatDeps,
  mistakeId: string | null,
): Promise<import('../prompts/mistake-analysis.ts').MistakeInputRecord | null> {
  try {
    let query = deps.db
      .from('mistakes')
      .select('question_text, student_answer, correct_answer, mistake_type, chapters(name, subjects(name))')
      .eq('user_id', deps.userId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (mistakeId) query = query.eq('id', mistakeId)

    const { data } = await query.maybeSingle()
    if (!data) return null
    const row = data as unknown as {
      question_text: string
      student_answer: string | null
      correct_answer: string | null
      mistake_type: string
      chapters: { name: string; subjects: { name: string } | null } | null
    }
    return {
      question: row.question_text,
      studentAnswer: row.student_answer,
      correctAnswer: row.correct_answer,
      mistakeType: row.mistake_type,
      chapter: row.chapters?.name ?? null,
      subject: row.chapters?.subjects?.name ?? null,
    }
  } catch (error) {
    log('warn', 'ai.mistake_load_failed', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

async function persistAssistant(
  deps: ChatDeps,
  conversationId: string,
  mode: AIMode,
  text: string,
  meta: ChatMeta,
): Promise<string | null> {
  try {
    const { data } = await deps.admin
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        user_id: deps.userId,
        role: 'assistant',
        content: text.slice(0, 24_000),
        mode,
        metadata: meta as unknown as Record<string, unknown>,
      })
      .select('id')
      .single()
    await deps.admin
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
    return (data as { id: string } | null)?.id ?? null
  } catch (error) {
    log('warn', 'ai.message_persist_failed', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

async function planWithModel(provider: AiProvider, question: string, intent: string): Promise<Awaited<ReturnType<typeof planTools>>> {
  const result = await provider.generateText({
    messages: [
      { role: 'system', content: 'You choose internal tools for a study assistant. JSON only.' },
      { role: 'user', content: toolPlanPrompt(question, intent as never) },
    ],
    json: true,
    maxTokens: 200,
    temperature: 0,
  })
  return parseModelPlan(result.text)
}

/** Parse the JSON features and shape a friendly intro line for each. */
function parseStructured(
  intent: string,
  raw: string,
  input: { chapter?: string | null; subject?: string | null; question: string },
): { text: string; extra: Partial<ChatMeta> } {
  const scope = input.chapter ?? input.subject ?? 'this topic'
  try {
    if (intent === 'quiz') {
      const parsed = extractJson<{ title?: string; questions?: Array<Partial<QuizItem>> }>(raw)
      const items: QuizItem[] = (parsed.questions ?? []).slice(0, 20).map((question, index) => ({
        id: `q${index + 1}`,
        question: question.question ?? '',
        options: Array.isArray(question.options) ? (question.options as string[]) : undefined,
        answer: question.answer ?? '',
        explanation: question.explanation,
        marks: question.marks ?? 1,
        difficulty: (question.difficulty as QuizItem['difficulty']) ?? 'medium',
        source: scope,
        generated: true,
      }))
      if (!items.length) throw new Error('empty quiz')
      return {
        text: `**${parsed.title ?? `Quiz — ${scope}`}**\n\n${items.length} questions, AI-generated practice — answers and explanations are in the card below.`,
        extra: { quiz: items, type: 'quiz' },
      }
    }

    if (intent === 'flashcards') {
      const parsed = extractJson<{ title?: string; cards?: Array<Partial<FlashcardItem>> }>(raw)
      const cards: FlashcardItem[] = (parsed.cards ?? []).slice(0, 30).map((card, index) => ({
        id: `c${index + 1}`,
        question: card.question ?? '',
        answer: card.answer ?? '',
        difficulty: (card.difficulty as FlashcardItem['difficulty']) ?? 'medium',
        source: card.source ?? scope,
        generated: true,
      }))
      if (!cards.length) throw new Error('empty deck')
      return {
        text: `**${parsed.title ?? `Flashcards — ${scope}`}**\n\n${cards.length} AI-generated cards derived from StudyOS content — tap to flip.`,
        extra: { flashcards: cards, type: 'flashcards' },
      }
    }

    const parsed = extractJson<{ question?: string; answer?: string; approach?: string[]; difficulty?: string; marks?: number }>(raw)
    if (!parsed.question) throw new Error('no question')
    return {
      text: '**AI-GENERATED PRACTICE** — same concept, new problem. Try it before opening the answer.',
      extra: {
        similar: {
          question: parsed.question,
          answer: parsed.answer ?? '',
          approach: (parsed.approach ?? []).slice(0, 5),
          difficulty: parsed.difficulty ?? 'medium',
          marks: parsed.marks ?? 3,
        },
        type: 'similar_question',
      },
    }
  } catch (error) {
    log('warn', 'ai.structured_parse_failed', { intent, error: error instanceof Error ? error.message : String(error) })
    return {
      text: 'I could not build that practice set cleanly — please try again, or ask for it in a different way.',
      extra: { type: 'answer' },
    }
  }
}
