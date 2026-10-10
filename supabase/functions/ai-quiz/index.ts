/**
 * StudyOS AI · ai-quiz
 *
 * Generates a grounded quiz (MCQ / short answer / numerical) for a subject or
 * chapter, grounded in retrieved StudyOS content, and stores it in
 * `generated_quizzes` so results can feed Progress / MistakeBook.
 *
 * Every question is AI-GENERATED PRACTICE — never presented as a PYQ.
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, readJson } from '../_shared/http.ts'
import { startAi } from '../_shared/boot.ts'
import { generateQuiz } from '../_shared/ai/services/features.ts'
import { enforceLimits, recordUsage } from '../_shared/ai/services/usage.ts'
import { recordEvent } from '../_shared/ai/services/analytics.ts'
import type { QuizSpec } from '../_shared/ai/prompts/index.ts'

interface QuizBody {
  subjectId?: string | null
  chapterId?: string | null
  difficulty?: 'easy' | 'medium' | 'hard'
  count?: number
  questionType?: 'mcq' | 'short_answer' | 'numerical' | 'mixed'
  save?: boolean
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Use POST.' } }, 405, request)
  }

  const startedAt = Date.now()
  let bootstrap: Awaited<ReturnType<typeof startAi>> | null = null

  try {
    const body = await readJson<QuizBody>(request)
    bootstrap = await startAi(request)
    const { caller, env, provider, embeddingProvider } = bootstrap

    await enforceLimits(caller.admin, caller.userId, 'quiz')

    const spec: QuizSpec = {
      subjectId: body.subjectId ?? null,
      chapterId: body.chapterId ?? null,
      difficulty: body.difficulty ?? 'medium',
      count: Math.min(Math.max(body.count ?? 10, 1), 20),
      questionType: body.questionType ?? 'mixed',
    }

    const quiz = await generateQuiz(
      { userId: caller.userId, db: caller.client, provider, embeddingProvider, env },
      spec,
    )

    let quizId: string | null = null
    if (body.save !== false) {
      const { data } = await caller.admin
        .from('generated_quizzes')
        .insert({
          user_id: caller.userId,
          title: quiz.title,
          subject_id: quiz.subjectId,
          chapter_id: quiz.chapterId,
          difficulty: quiz.difficulty,
          question_type: spec.questionType,
          items: quiz.items,
          question_count: quiz.items.length,
        })
        .select('id')
        .single()
      quizId = (data as { id: string } | null)?.id ?? null
    }

    await recordUsage(caller.admin, caller.userId, 'quiz')
    await recordEvent(caller.admin, {
      userId: caller.userId,
      feature: 'quiz',
      subjectId: quiz.subjectId,
      chapterId: quiz.chapterId,
      questionType: spec.questionType,
      latencyMs: Date.now() - startedAt,
      retrievalUsed: true,
      provider: provider.name,
      model: provider.model,
      status: 'ok',
    })

    return jsonResponse({ quiz: { ...quiz, id: quizId } }, 200, request)
  } catch (error) {
    if (bootstrap) {
      await recordEvent(bootstrap.caller.admin, {
        userId: bootstrap.caller.userId,
        feature: 'quiz',
        latencyMs: Date.now() - startedAt,
        status: 'error',
      })
    }
    return errorResponse(request, error)
  }
})
