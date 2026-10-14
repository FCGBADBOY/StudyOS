/**
 * Client for the `content-engine` edge function.
 *
 * WHY AN EDGE FUNCTION AT ALL — crawling, AI generation and publication are
 * privileged operations. They need the service-role key, a robots.txt check,
 * a rate limiter and an AI key, none of which may ever exist in browser code
 * (spec §81). The browser asks; the worker decides.
 *
 * This file is the ONLY module in `src/content-engine/**` that touches the
 * network, so the worker simply never imports it.
 */
import { supabase, readableError } from '../lib/supabase'
import type { EngineAction, EngineRequest, EngineResponse } from './types'

/** Edge function name (`supabase/functions/content-engine`). */
export const ENGINE_FUNCTION = 'content-engine'

/** Actions the browser is allowed to ask for. The worker re-checks each one. */
export const CLIENT_ACTIONS: readonly EngineAction[] = [
  'discoverSyllabus',
  'buildChapterMap',
  'generateNotes',
  'generateRevisionNotes',
  'extractFormulas',
  'extractReactions',
  'discoverPYQs',
  'discoverSamplePapers',
  'verifySource',
  'importDocument',
  'classifyPaper',
  'validateContent',
  'publishContent',
  'rebuildContent',
  'findMissingContent',
  'dailyMaintenance',
  'processJobs',
]

export class EngineUnavailableError extends Error {
  constructor(message = 'The content engine is not configured for this deployment.') {
    super(message)
    this.name = 'EngineUnavailableError'
  }
}

/**
 * Invoke the worker.
 *
 * The caller's JWT travels in `Authorization`, so the function can verify who
 * is asking before it does anything expensive. Failures surface as a readable
 * message — never a raw provider or database error.
 */
export async function invokeEngine(request: EngineRequest): Promise<EngineResponse> {
  if (!supabase) throw new EngineUnavailableError()
  if (!CLIENT_ACTIONS.includes(request.action)) {
    throw new Error('That content engine action cannot be run from the browser.')
  }

  const { data, error } = await supabase.functions.invoke(ENGINE_FUNCTION, {
    body: request as Record<string, unknown>,
  })

  if (error) {
    const message = (error as { message?: string }).message ?? ''
    throw new Error(
      message
        ? readableError({ message })
        : 'The content engine did not respond. Please try again.',
    )
  }

  const response = data as EngineResponse | null
  if (!response || typeof response !== 'object') {
    throw new Error('The content engine returned an unexpected response.')
  }
  return response
}

/** Convenience wrappers for the actions the admin screens trigger by name. */
export const engine = {
  discoverSyllabus: (input: { sourceId?: string; boardId: string; classId?: string }) =>
    invokeEngine({ action: 'discoverSyllabus', ...input }),
  buildChapterMap: (input: { chapterId?: string; subjectId?: string; classId?: string }) =>
    invokeEngine({ action: 'buildChapterMap', ...input }),
  generateNotes: (input: {
    chapterId: string
    noteType?: string
    depth?: string
    subjectId?: string
    classId?: string
    boardId?: string
  }) => invokeEngine({ action: 'generateNotes', ...input }),
  generateRevisionNotes: (input: { chapterId: string; depth?: string }) =>
    invokeEngine({ action: 'generateRevisionNotes', ...input }),
  extractFormulas: (input: { chapterId: string }) => invokeEngine({ action: 'extractFormulas', ...input }),
  extractReactions: (input: { chapterId: string }) => invokeEngine({ action: 'extractReactions', ...input }),
  discoverPYQs: (input: { boardId?: string; classId?: string; subjectId?: string; year?: number }) =>
    invokeEngine({ action: 'discoverPYQs', ...input }),
  discoverSamplePapers: (input: { boardId?: string; classId?: string; subjectId?: string }) =>
    invokeEngine({ action: 'discoverSamplePapers', ...input }),
  verifySource: (input: { sourceId: string }) => invokeEngine({ action: 'verifySource', ...input }),
  importDocument: (input: { documentId: string }) => invokeEngine({ action: 'importDocument', ...input }),
  classifyPaper: (input: { documentId?: string; paperId?: string }) =>
    invokeEngine({ action: 'classifyPaper', ...input }),
  validateContent: (input: { noteId?: string; entityType?: string; entityId?: string }) =>
    invokeEngine({ action: 'validateContent', ...input }),
  publishContent: (input: { noteId?: string; documentId?: string; noteIds?: string[] }) =>
    invokeEngine({ action: 'publishContent', ...input }),
  rebuildContent: (input: { resourceId?: string; chapterId?: string; all?: boolean }) =>
    invokeEngine({ action: 'rebuildContent', ...input }),
  findMissingContent: (input: { boardId?: string; classId?: string } = {}) =>
    invokeEngine({ action: 'findMissingContent', ...input }),
  dailyMaintenance: () => invokeEngine({ action: 'dailyMaintenance' }),
  processJobs: (input: { limit?: number } = {}) => invokeEngine({ action: 'processJobs', ...input }),
}
