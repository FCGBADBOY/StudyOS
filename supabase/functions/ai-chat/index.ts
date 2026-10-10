/**
 * StudyOS AI · ai-chat
 *
 * The AI Tutor endpoint: modes (explain / solve / hint / 3-mark / 5-mark /
 * revise / quiz / simplify), conversation persistence, RAG over StudyOS
 * content, permission-aware tools and structured response metadata.
 *
 * Streaming: SSE (`status` / `meta` / `delta` / `done` / `error`).
 * JSON:      send `Accept: application/json` or `"stream": false`.
 *
 * Auth: requires the user's JWT. All student data is read with the caller's
 * own session (RLS) or explicitly scoped to the caller's id.
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, readJson, AppError } from '../_shared/http.ts'
import { startAi } from '../_shared/boot.ts'
import { collectEvents, sseResponse, wantsStream } from '../_shared/sse.ts'
import { runChat, type ChatDonePayload } from '../_shared/ai/services/chat.ts'
import type { ChatFocus, ChatRequest } from '../_shared/ai/types.ts'

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Use POST.' } }, 405, request)
  }

  try {
    const body = await readJson<ChatRequest & { action?: string; hintIndex?: number }>(request)
    const { caller, env, provider, embeddingProvider } = await startAi(request)

    const chatRequest: ChatRequest = {
      conversationId: body.conversationId ?? null,
      message: body.message ?? '',
      mode: body.mode ?? 'explain',
      regenerate: Boolean(body.regenerate),
      stream: body.stream,
      focus: {
        subjectId: body.focus?.subjectId ?? null,
        chapterId: body.focus?.chapterId ?? null,
        subjectSlug: body.focus?.subjectSlug ?? null,
        chapterSlug: body.focus?.chapterSlug ?? null,
        difficulty: body.focus?.difficulty ?? null,
        action: body.focus?.action ?? (body.action as ChatFocus['action'] | undefined),
        hintIndex: body.focus?.hintIndex ?? body.hintIndex ?? 0,
        mistakeId: body.focus?.mistakeId ?? null,
      },
    }

    const events = runChat(chatRequest, {
      userId: caller.userId,
      db: caller.client,
      admin: caller.admin,
      provider,
      embeddingProvider,
      env,
    })

    if (wantsStream(request, body.stream)) return sseResponse(request, events)

    const collected = await collectEvents<ChatDonePayload>(events)
    return jsonResponse(
      {
        text: collected.text,
        meta: collected.meta ?? null,
        status: collected.status,
        ...(collected.payload ?? {}),
      },
      200,
      request,
    )
  } catch (error) {
    return errorResponse(request, error)
  }
})
