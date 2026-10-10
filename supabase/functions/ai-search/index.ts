/**
 * StudyOS AI · ai-search
 *
 * Hybrid academic retrieval without generation: pgvector similarity + keyword
 * rank + academic filters (+ optional PYQ archive). Used by the tutor's
 * "related PYQs" / "find sources" actions and by the Library's semantic
 * search. Works even when no chat provider is configured (keyword-only).
 *
 * Reads run with the caller's own session, so RLS keeps unpublished resources
 * out of the results.
 */
import { isPreflight, preflight } from '../_shared/cors.ts'
import { authenticate, errorResponse, jsonResponse, readJson } from '../_shared/http.ts'
import { aiEnv } from '../_shared/env.ts'
import { createEmbeddingProvider } from '../_shared/ai/providers/index.ts'
import { hybridSearch, searchPyqs, chunkToSource, dedupeSources, pyqToSource } from '../_shared/ai/retrieval/search.ts'
import type { RetrievalFilters, Source } from '../_shared/ai/types.ts'

interface SearchBody {
  query?: string
  boardId?: string | null
  classId?: string | null
  subjectId?: string | null
  chapterId?: string | null
  resourceType?: string | null
  includePyqs?: boolean
  limit?: number
}

Deno.serve(async (request) => {
  if (isPreflight(request)) return preflight(request)
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Use POST.' } }, 405, request)
  }

  try {
    const body = await readJson<SearchBody>(request)
    const caller = await authenticate(request)

    const query = (body.query ?? '').trim()
    if (!query) {
      return jsonResponse({ error: { code: 'invalid_request', message: 'A search query is required.' } }, 400, request)
    }

    const env = aiEnv()
    const filters: RetrievalFilters = {
      boardId: body.boardId ?? null,
      classId: body.classId ?? null,
      subjectId: body.subjectId ?? null,
      chapterId: body.chapterId ?? null,
      resourceType: body.resourceType ?? null,
    }

    const result = await hybridSearch({
      db: caller.client,
      query,
      filters,
      limit: Math.min(Math.max(body.limit ?? 8, 1), 20),
      embeddingProvider: createEmbeddingProvider(env),
    })

    let sources: Source[] = result.chunks.map(chunkToSource)
    let pyqs: Awaited<ReturnType<typeof searchPyqs>> = []

    if (body.includePyqs) {
      pyqs = await searchPyqs({
        db: caller.client,
        query,
        filters: { ...filters, resourceType: null },
        limit: 8,
      })
      sources = [...sources, ...pyqs.map(pyqToSource)]
    }

    sources = dedupeSources(sources)

    return jsonResponse(
      {
        query,
        usedVector: result.usedVector,
        filteredBy: result.filteredBy,
        sources,
        chunks: result.chunks.map((chunk) => ({
          id: chunk.id,
          text: chunk.content,
          section: chunk.sectionTitle,
          kind: chunk.contentKind,
          chapter: chunk.chapterName,
          subject: chunk.subjectName,
          resource: chunk.resourceTitle,
          score: Number(chunk.score.toFixed(4)),
        })),
        pyqs,
      },
      200,
      request,
    )
  } catch (error) {
    return errorResponse(request, error)
  }
})
