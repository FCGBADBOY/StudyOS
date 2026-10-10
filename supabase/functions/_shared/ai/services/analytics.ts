/**
 * Product analytics for the Admin → AI dashboard.
 *
 * Records only low-cardinality dimensions (feature, subject/chapter ids,
 * latency, retrieval outcome, status) — never prompts, answers or any other
 * free text from a private conversation.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { log } from '../logging.ts'

export interface AiEventInput {
  userId: string | null
  conversationId?: string | null
  feature: string
  subjectId?: string | null
  chapterId?: string | null
  questionType?: string | null
  latencyMs?: number
  retrievalUsed?: boolean
  sourceCount?: number
  provider?: string | null
  model?: string | null
  status?: 'ok' | 'error' | 'rate_limited' | 'blocked' | 'no_provider'
  errorCode?: string | null
}

/** Fire-and-forget telemetry (never fails the request). */
export async function recordEvent(db: SupabaseClient, input: AiEventInput): Promise<void> {
  const sourceCount = input.sourceCount ?? 0
  try {
    const { error } = await db.from('ai_events').insert({
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      feature: input.feature,
      subject_id: input.subjectId ?? null,
      chapter_id: input.chapterId ?? null,
      question_type: input.questionType ?? null,
      response_latency_ms: input.latencyMs ?? null,
      retrieval_used: Boolean(input.retrievalUsed),
      source_count: sourceCount,
      no_source: sourceCount === 0 && (input.retrievalUsed ?? false) === false,
      provider: input.provider ?? null,
      model: input.model ?? null,
      status: input.status ?? 'ok',
      error_code: input.errorCode ?? null,
    })
    if (error) log('warn', 'ai.event_write_failed', { error: error.message })
  } catch (error) {
    log('warn', 'ai.event_write_failed', { error: error instanceof Error ? error.message : String(error) })
  }
}
