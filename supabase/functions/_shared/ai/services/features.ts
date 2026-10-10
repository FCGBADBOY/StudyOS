/**
 * Shared generation features used by ai-quiz, ai-flashcards and
 * ai-similar-question: retrieve → prompt → strict JSON → validate.
 *
 * Keeping them here means the three edge functions stay thin routers while
 * the hard parts (retrieval grounding, JSON discipline, honesty labels) live
 * in one place.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { AiEnv } from '../../env.ts'
import type { AiProvider } from '../providers/provider.interface.ts'
import { extractJson } from '../providers/provider.interface.ts'
import { assemble, quizJsonInstructions, type QuizSpec } from '../prompts/index.ts'
import { GROUNDING_RULES } from '../prompts/base.ts'
import { flashcardInstructions, similarInstructions } from '../prompts/structured.ts'
import { buildRetrievalFilters } from '../retrieval/filters.ts'
import { chunkToSource, dedupeSources, hybridSearch, searchPyqs, pyqToSource } from '../retrieval/search.ts'
import { buildStudentContext, type FocusIds } from './context.ts'
import type { FlashcardItem, QuizItem, Source, StudentContext } from '../types.ts'
import { log } from '../../logging.ts'

export interface FeatureDeps {
  userId: string
  db: SupabaseClient
  provider: AiProvider
  embeddingProvider: AiProvider | null
  env: AiEnv
}

export interface FocusRequest {
  subjectId?: string | null
  chapterId?: string | null
}

export interface FeatureContext {
  student: StudentContext
  sources: Source[]
  scopeLabel: string
}

/** Student context + grounded StudyOS sources for a generated artefact. */
export async function prepareFeatureContext(
  deps: FeatureDeps,
  focus: FocusRequest,
  query: string,
  options: { includePyqs?: boolean } = {},
): Promise<FeatureContext> {
  const student = await buildStudentContext(deps.db, deps.userId, {
    subjectId: focus.subjectId ?? null,
    chapterId: focus.chapterId ?? null,
  })

  const filters = buildRetrievalFilters({
    profile: { boardId: student.boardId, classId: student.classId, streamId: student.streamId },
    focus: { subjectId: focus.subjectId ?? null, chapterId: focus.chapterId ?? null },
    intent: 'concept',
    question: query,
  })

  const result = await hybridSearch({
    db: deps.db,
    query,
    filters,
    limit: Math.max(deps.env.topK, 8),
    embeddingProvider: deps.embeddingProvider,
  })

  let sources = result.chunks.map(chunkToSource)
  if (options.includePyqs) {
    const pyqs = await searchPyqs({ db: deps.db, query, filters, limit: 6 })
    sources = [...sources, ...pyqs.map(pyqToSource)]
  }

  return {
    student,
    sources: dedupeSources(sources).slice(0, 8),
    scopeLabel: student.chapter ?? student.subject ?? query.slice(0, 60),
  }
}

function contextBlock(context: FeatureContext): string {
  const lines: string[] = []
  if (context.student.board || context.student.className) {
    lines.push(
      `Student: ${context.student.className ?? 'class?'} · ${context.student.board ?? 'board?'}` +
        `${context.student.stream ? ` · ${context.student.stream}` : ''}`,
    )
  }
  if (context.sources.length) {
    lines.push('STUDYOS SOURCES (ground the material in these):')
    context.sources.forEach((source, index) => {
      lines.push(
        `[${index + 1}] ${source.title}${source.chapter ? ` — ${source.chapter}` : ''}` +
          `${source.year ? ` (${source.year})` : ''}`,
      )
      if (source.excerpt) lines.push(`    ${source.excerpt.slice(0, 400)}`)
    })
  } else {
    lines.push('No StudyOS source matched — mark anything you generate as AI-generated practice.')
  }
  return lines.join('\n')
}

async function jsonFrom(
  provider: AiProvider,
  context: string,
  instructions: string,
  env: AiEnv,
): Promise<unknown> {
  const result = await provider.generateText({
    messages: [
      { role: 'system', content: `${GROUNDING_RULES}\n\n${context}` },
      { role: 'user', content: instructions },
    ],
    json: true,
    maxTokens: Math.min(3000, env.maxOutputTokens * 2),
    temperature: 0.5,
  })
  return extractJson<unknown>(result.text)
}

/* ---------------------------------- quiz ---------------------------------- */

export interface QuizGeneration {
  title: string
  items: QuizItem[]
  subjectId: string | null
  chapterId: string | null
  difficulty: QuizSpec['difficulty']
}

export async function generateQuiz(
  deps: FeatureDeps,
  spec: QuizSpec & FocusRequest,
): Promise<QuizGeneration> {
  const context = await prepareFeatureContext(
    deps,
    spec,
    `${spec.chapter ?? spec.subject ?? ''} ${spec.difficulty} practice questions`,
    { includePyqs: spec.questionType !== 'mcq' },
  )

  const parsed = (await jsonFrom(
    deps.provider,
    contextBlock(context),
    quizJsonInstructions(spec),
    deps.env,
  )) as { title?: string; questions?: Array<Record<string, unknown>> }

  const items: QuizItem[] = (parsed.questions ?? []).slice(0, Math.max(1, spec.count)).map((question, index) => {
    const options = Array.isArray(question.options) ? (question.options as string[]) : undefined
    return {
      id: `q${index + 1}`,
      question: String(question.question ?? '').slice(0, 1200),
      ...(options && options.length ? { options: options.slice(0, 5).map(String) } : {}),
      answer: String(question.answer ?? '').slice(0, 600),
      ...(question.explanation ? { explanation: String(question.explanation).slice(0, 800) } : {}),
      marks: Number(question.marks ?? 1) || 1,
      difficulty: (['easy', 'medium', 'hard'].includes(String(question.difficulty))
        ? String(question.difficulty)
        : 'medium') as QuizItem['difficulty'],
      source: context.scopeLabel,
      generated: true,
    }
  })

  if (!items.length) throw new Error('The model returned an empty quiz.')

  log('info', 'ai.quiz_generated', { items: items.length, sources: context.sources.length })
  return {
    title: parsed.title?.slice(0, 120) || `Quiz — ${context.scopeLabel}`,
    items,
    subjectId: spec.subjectId ?? context.student.subjectId ?? null,
    chapterId: spec.chapterId ?? context.student.chapterId ?? null,
    difficulty: spec.difficulty,
  }
}

/* ------------------------------- flashcards ------------------------------- */

export interface FlashcardGeneration {
  title: string
  cards: FlashcardItem[]
  subjectId: string | null
  chapterId: string | null
  sourceType: 'chapter' | 'resource' | 'mistakes' | 'pyq' | 'chat'
}

export async function generateFlashcards(
  deps: FeatureDeps,
  input: {
    subjectId?: string | null
    chapterId?: string | null
    source?: FlashcardGeneration['sourceType']
    query: string
  },
): Promise<FlashcardGeneration> {
  const context = await prepareFeatureContext(deps, input, input.query, { includePyqs: input.source === 'pyq' })
  const promptInput = {
    question: input.query,
    mode: 'explain' as const,
    intent: 'flashcards' as const,
    student: context.student,
    subject: context.student.subject,
    chapter: context.student.chapter,
    difficulty: null,
    sources: context.sources,
    pyqs: [],
    tools: [],
    summary: null,
    history: [],
  }

  const parsed = (await jsonFrom(
    deps.provider,
    contextBlock(context),
    assemble(promptInput, { instructions: flashcardInstructions(promptInput) }).user,
    deps.env,
  )) as { title?: string; cards?: Array<Record<string, unknown>> }

  const cards: FlashcardItem[] = (parsed.cards ?? []).slice(0, 30).map((card, index) => ({
    id: `c${index + 1}`,
    question: String(card.question ?? '').slice(0, 800),
    answer: String(card.answer ?? '').slice(0, 1200),
    difficulty: (['easy', 'medium', 'hard'].includes(String(card.difficulty))
      ? String(card.difficulty)
      : 'medium') as FlashcardItem['difficulty'],
    source: String(card.source ?? context.scopeLabel).slice(0, 160),
    generated: true,
  }))

  if (!cards.length) throw new Error('The model returned an empty deck.')

  log('info', 'ai.flashcards_generated', { cards: cards.length, sources: context.sources.length })
  return {
    title: parsed.title?.slice(0, 120) || `Flashcards — ${context.scopeLabel}`,
    cards,
    subjectId: input.subjectId ?? context.student.subjectId ?? null,
    chapterId: input.chapterId ?? context.student.chapterId ?? null,
    sourceType: input.source ?? 'chat',
  }
}

/* ---------------------------- similar question ---------------------------- */

export interface SimilarGeneration {
  question: string
  answer: string
  approach: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  marks: number
  subjectId: string | null
  chapterId: string | null
  sources: Source[]
}

export async function generateSimilarQuestion(
  deps: FeatureDeps,
  input: { question: string; subjectId?: string | null; chapterId?: string | null },
): Promise<SimilarGeneration> {
  const context = await prepareFeatureContext(deps, input, input.question, { includePyqs: true })
  const promptInput = {
    question: input.question,
    mode: 'solve' as const,
    intent: 'similar' as const,
    student: context.student,
    subject: context.student.subject,
    chapter: context.student.chapter,
    difficulty: null,
    sources: context.sources,
    pyqs: [],
    tools: [],
    summary: null,
    history: [],
  }

  const parsed = (await jsonFrom(
    deps.provider,
    contextBlock(context),
    assemble(promptInput, { instructions: similarInstructions(promptInput) }).user,
    deps.env,
  )) as { question?: string; answer?: string; approach?: string[]; difficulty?: string; marks?: number }

  if (!parsed.question) throw new Error('The model returned no question.')

  return {
    question: parsed.question.slice(0, 2000),
    answer: (parsed.answer ?? '').slice(0, 2000),
    approach: (parsed.approach ?? []).slice(0, 6).map((step) => String(step).slice(0, 400)),
    difficulty: (['easy', 'medium', 'hard'].includes(String(parsed.difficulty))
      ? String(parsed.difficulty)
      : 'medium') as SimilarGeneration['difficulty'],
    marks: Number(parsed.marks ?? 3) || 3,
    subjectId: input.subjectId ?? context.student.subjectId ?? null,
    chapterId: input.chapterId ?? context.student.chapterId ?? null,
    sources: context.sources,
  }
}
