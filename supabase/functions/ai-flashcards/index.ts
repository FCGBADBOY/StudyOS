/**
 * StudyOS AI · ai-flashcards
 *
 * Builds a revision deck from a chapter, resource, PYQs, the student's
 * mistakes or a free-text topic. Cards are grounded in retrieved StudyOS
 * content, labelled AI-generated and optionally saved to the student's
 * library (`generated_flashcards`).
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, readJson } from '../_shared/http.ts'
import { startAi } from '../_shared/boot.ts'
import { generateFlashcards } from '../_shared/ai/services/features.ts'
import { enforceLimits, recordUsage } from '../_shared/ai/services/usage.ts'
import { recordEvent } from '../_shared/ai/services/analytics.ts'

interface FlashcardBody {
  subjectId?: string | null
  chapterId?: string | null
  source?: 'chapter' | 'resource' | 'mistakes' | 'pyq' | 'chat'
  query?: string
  /** Extra context: mistake ids or a resource id the deck should cover. */
  resourceType?: 'chapter' | 'resource' | 'mistakes' | 'pyq'
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
    const body = await readJson<FlashcardBody>(request)
    bootstrap = await startAi(request)
    const { caller, env, provider, embeddingProvider } = bootstrap

    await enforceLimits(caller.admin, caller.userId, 'flashcards')

    const source = body.source ?? body.resourceType ?? 'chat'
    const query =
      (body.query ?? '').trim() ||
      (source === 'mistakes'
        ? 'revision cards from my recent mistakes'
        : source === 'pyq'
          ? 'flashcards from previous-year questions'
          : 'chapter revision flashcards')

    const deck = await generateFlashcards(
      { userId: caller.userId, db: caller.client, provider, embeddingProvider, env },
      {
        subjectId: body.subjectId ?? null,
        chapterId: body.chapterId ?? null,
        source,
        query,
      },
    )

    let deckId: string | null = null
    if (body.save !== false) {
      const { data } = await caller.admin
        .from('generated_flashcards')
        .insert({
          user_id: caller.userId,
          title: deck.title,
          subject_id: deck.subjectId,
          chapter_id: deck.chapterId,
          source_type: deck.sourceType,
          items: deck.cards,
          card_count: deck.cards.length,
        })
        .select('id')
        .single()
      deckId = (data as { id: string } | null)?.id ?? null
    }

    await recordUsage(caller.admin, caller.userId, 'flashcards')
    await recordEvent(caller.admin, {
      userId: caller.userId,
      feature: 'flashcards',
      subjectId: deck.subjectId,
      chapterId: deck.chapterId,
      questionType: source,
      latencyMs: Date.now() - startedAt,
      retrievalUsed: true,
      provider: provider.name,
      model: provider.model,
      status: 'ok',
    })

    return jsonResponse({ deck: { ...deck, id: deckId } }, 200, request)
  } catch (error) {
    if (bootstrap) {
      await recordEvent(bootstrap.caller.admin, {
        userId: bootstrap.caller.userId,
        feature: 'flashcards',
        latencyMs: Date.now() - startedAt,
        status: 'error',
      })
    }
    return errorResponse(request, error)
  }
})
