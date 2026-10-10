/**
 * StudyOS AI · ai-similar-question
 *
 * After a student solves a question, generate a NEW practice problem on the
 * same concept (clearly labelled AI-GENERATED PRACTICE — never a PYQ),
 * grounded in the chapter's StudyOS content.
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, readJson } from '../_shared/http.ts'
import { startAi } from '../_shared/boot.ts'
import { generateSimilarQuestion } from '../_shared/ai/services/features.ts'
import { enforceLimits, recordUsage } from '../_shared/ai/services/usage.ts'
import { recordEvent } from '../_shared/ai/services/analytics.ts'

interface SimilarBody {
  question?: string
  subjectId?: string | null
  chapterId?: string | null
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Use POST.' } }, 405, request)
  }

  const startedAt = Date.now()
  let bootstrap: Awaited<ReturnType<typeof startAi>> | null = null

  try {
    const body = await readJson<SimilarBody>(request)
    const question = (body.question ?? '').trim()
    if (question.length < 8) {
      return jsonResponse(
        { error: { code: 'invalid_request', message: 'Paste the question you want a similar one for.' } },
        400,
        request,
      )
    }

    bootstrap = await startAi(request)
    const { caller, env, provider, embeddingProvider } = bootstrap

    await enforceLimits(caller.admin, caller.userId, 'similar_question')

    const similar = await generateSimilarQuestion(
      { userId: caller.userId, db: caller.client, provider, embeddingProvider, env },
      { question, subjectId: body.subjectId ?? null, chapterId: body.chapterId ?? null },
    )

    await recordUsage(caller.admin, caller.userId, 'similar_question')
    await recordEvent(caller.admin, {
      userId: caller.userId,
      feature: 'similar_question',
      subjectId: similar.subjectId,
      chapterId: similar.chapterId,
      questionType: 'generated',
      latencyMs: Date.now() - startedAt,
      retrievalUsed: true,
      sourceCount: similar.sources.length,
      provider: provider.name,
      model: provider.model,
      status: 'ok',
    })

    return jsonResponse({ similar }, 200, request)
  } catch (error) {
    if (bootstrap) {
      await recordEvent(bootstrap.caller.admin, {
        userId: bootstrap.caller.userId,
        feature: 'similar_question',
        latencyMs: Date.now() - startedAt,
        status: 'error',
      })
    }
    return errorResponse(request, error)
  }
})
