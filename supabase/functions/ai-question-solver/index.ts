/**
 * StudyOS AI · ai-question-solver
 *
 * Camera/upload → server-side vision → question extraction → intent →
 * retrieval → solution (the chat pipeline, reused so sources/permissions are
 * identical to typing the question).
 *
 * IMAGE PRIVACY (spec §35)
 *   - images are held in memory for the duration of this request only;
 *   - nothing is written to storage, logs or the database;
 *   - the extracted TEXT is what gets persisted (as a normal chat message);
 *   - unreadable images fail loudly instead of pretending to be understood.
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import { AppError, errorResponse, jsonResponse, readJson } from '../_shared/http.ts'
import { startAi } from '../_shared/boot.ts'
import { collectEvents, sseResponse, wantsStream } from '../_shared/sse.ts'
import { runChat, type ChatDonePayload } from '../_shared/ai/services/chat.ts'
import { enforceLimits, recordUsage } from '../_shared/ai/services/usage.ts'
import { recordEvent } from '../_shared/ai/services/analytics.ts'
import {
  IMAGE_EXTRACT_PROMPT,
  MAX_IMAGE_CHARS,
  evaluateExtraction,
  isAllowedImageType,
} from '../_shared/ai/prompts/image.ts'
import type { AIMode } from '../_shared/ai/types.ts'

interface SolverBody {
  imageBase64?: string
  mimeType?: string
  /** Optional typed question (solves directly without vision). */
  question?: string
  mode?: AIMode
  conversationId?: string | null
  subjectId?: string | null
  chapterId?: string | null
  stream?: boolean
}

function decodeImage(body: SolverBody): { base64: string; mimeType: string } {
  const raw = (body.imageBase64 ?? '').trim()
  if (!raw) throw new AppError('invalid_request', 'Attach a photo or screenshot of the question.')
  if (raw.length > MAX_IMAGE_CHARS) {
    throw new AppError('invalid_request', 'That image is too large — try a smaller crop of the question.')
  }

  let mimeType = (body.mimeType ?? '').toLowerCase().trim()
  if (!mimeType && raw.startsWith('data:')) {
    const match = raw.slice(0, 40).match(/^data:([\w/+.-]+);/)
    mimeType = match?.[1]?.toLowerCase() ?? ''
  }
  if (!isAllowedImageType(mimeType)) {
    throw new AppError('invalid_request', 'Use a PNG, JPEG or WEBP photo of the question.')
  }

  const payload = raw.startsWith('data:') ? raw.slice(raw.indexOf(',') + 1) : raw
  /* Sanity-check base64 so we never hand garbage to the vision model. */
  if (!/^[A-Za-z0-9+/=\s]+$/.test(payload.slice(0, 2000))) {
    throw new AppError('invalid_request', 'That image could not be read. Please try another photo.')
  }

  return { base64: payload, mimeType }
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Use POST.' } }, 405, request)
  }

  const startedAt = Date.now()
  let bootstrap: Awaited<ReturnType<typeof startAi>> | null = null

  try {
    const body = await readJson<SolverBody>(request)
    bootstrap = await startAi(request)
    const { caller, env, provider, embeddingProvider } = bootstrap

    await enforceLimits(caller.admin, caller.userId, 'question_solver')

    let question = (body.question ?? '').trim()

    if (!question) {
      const image = decodeImage(body)
      if (!provider.capabilities.vision) {
        throw new AppError('provider_unavailable', 'Image solving is not available for the configured AI provider.')
      }

      const extraction = await provider.analyzeImage({
        base64: image.base64,
        mimeType: image.mimeType,
        prompt: IMAGE_EXTRACT_PROMPT,
        maxTokens: 900,
      })

      /* Fail loudly on an unreadable photo — never solve a guess (image
         privacy: nothing is stored, only the text we could actually read). */
      const decision = evaluateExtraction(extraction)
      if (!decision.ok) {
        await recordEvent(caller.admin, {
          userId: caller.userId,
          feature: 'question_solver',
          latencyMs: Date.now() - startedAt,
          status: 'error',
          errorCode: 'image_unreadable',
          provider: provider.name,
          model: provider.model,
        })
        throw new AppError('image_unreadable', decision.message ?? 'That image could not be read.', {
          confidence: Number(decision.confidence.toFixed(2)),
          reason: decision.reason ?? 'unreadable',
        })
      }

      question = (extraction.text ?? '').trim()
    }

    if (question.length > 4000) {
      throw new AppError('invalid_request', 'That question is too long — try one question at a time.')
    }

    const events = runChat(
      {
        conversationId: body.conversationId ?? null,
        message: question,
        mode: body.mode ?? 'solve',
        focus: {
          subjectId: body.subjectId ?? null,
          chapterId: body.chapterId ?? null,
        },
        stream: body.stream,
      },
      {
        userId: caller.userId,
        db: caller.client,
        admin: caller.admin,
        provider,
        embeddingProvider,
        env,
      },
    )

    await recordUsage(caller.admin, caller.userId, 'question_solver')
    await recordEvent(caller.admin, {
      userId: caller.userId,
      feature: 'question_solver',
      questionType: 'image_or_text',
      latencyMs: Date.now() - startedAt,
      retrievalUsed: true,
      provider: provider.name,
      model: provider.model,
      status: 'ok',
    })

    if (wantsStream(request, body.stream)) return sseResponse(request, events)

    const collected = await collectEvents<ChatDonePayload>(events)
    return jsonResponse(
      { text: collected.text, meta: collected.meta ?? null, ...(collected.payload ?? {}) },
      200,
      request,
    )
  } catch (error) {
    if (bootstrap) {
      await recordEvent(bootstrap.caller.admin, {
        userId: bootstrap.caller.userId,
        feature: 'question_solver',
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorCode: error instanceof AppError ? error.code : null,
      })
    }
    return errorResponse(request, error)
  }
})
