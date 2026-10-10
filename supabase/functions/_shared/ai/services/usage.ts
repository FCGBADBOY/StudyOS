/**
 * Server-side rate limiting + usage metering.
 *
 * Limits are enforced HERE (edge functions), not in the browser, so they
 * cannot be bypassed by a modified client. Counters live in `ai_usage`
 * (one row per user/day/feature) and are also surfaced to the student.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AppError } from '../http.ts'
import { aiEnv } from '../env.ts'
import { log } from '../logging.ts'

export interface UsageRow {
  requests: number
  input_tokens: number
  output_tokens: number
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Read today's counters for one feature (own rows only). */
export async function featureUsage(
  db: SupabaseClient,
  userId: string,
  feature: string,
): Promise<UsageRow> {
  const { data, error } = await db
    .from('ai_usage')
    .select('requests, input_tokens, output_tokens')
    .eq('user_id', userId)
    .eq('day', today())
    .eq('feature', feature)
    .maybeSingle()

  if (error) {
    log('warn', 'ai.usage_read_failed', { error: error.message })
    return { requests: 0, input_tokens: 0, output_tokens: 0 }
  }
  return (data as UsageRow | null) ?? { requests: 0, input_tokens: 0, output_tokens: 0 }
}

/**
 * Throw `rate_limited` when the user is over the daily global or per-feature
 * budget. Cheap: two indexed reads, no locks.
 */
export async function enforceLimits(
  db: SupabaseClient,
  userId: string,
  feature: string,
): Promise<void> {
  const env = aiEnv()

  const { data, error } = await db
    .from('ai_usage')
    .select('feature, requests')
    .eq('user_id', userId)
    .eq('day', today())

  if (error) {
    /* Metering must not block the product — log and continue. */
    log('warn', 'ai.usage_read_failed', { error: error.message })
    return
  }

  const rows = (data ?? []) as Array<{ feature: string; requests: number }>
  const total = rows.reduce((sum, row) => sum + (row.requests ?? 0), 0)
  const perFeature = rows.find((row) => row.feature === feature)?.requests ?? 0

  if (total >= env.dailyLimit) {
    throw new AppError(
      'rate_limited',
      `You have used your ${env.dailyLimit} AI requests for today. Try again tomorrow — your notes, PYQs and MistakeBook keep working.`,
      { limit: env.dailyLimit, scope: 'day' },
    )
  }
  if (perFeature >= env.featureDailyLimit) {
    throw new AppError(
      'rate_limited',
      `You have reached today's limit for this AI feature (${env.featureDailyLimit}). Try a different mode or come back tomorrow.`,
      { limit: env.featureDailyLimit, scope: 'feature' },
    )
  }
}

/** Count one request (+ token usage) for the day/feature. Never throws. */
export async function recordUsage(
  db: SupabaseClient,
  userId: string,
  feature: string,
  tokens: { input?: number; output?: number } = {},
): Promise<void> {
  try {
    const current = await featureUsage(db, userId, feature)
    const { error } = await db.from('ai_usage').upsert(
      {
        user_id: userId,
        day: today(),
        feature,
        requests: current.requests + 1,
        input_tokens: current.input_tokens + (tokens.input ?? 0),
        output_tokens: current.output_tokens + (tokens.output ?? 0),
      },
      { onConflict: 'user_id,day,feature' },
    )
    if (error) log('warn', 'ai.usage_write_failed', { error: error.message })
  } catch (error) {
    log('warn', 'ai.usage_write_failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

/** Today's usage for the signed-in student (UI quota display). */
export async function usageSummary(db: SupabaseClient, userId: string): Promise<{
  requests: number
  inputTokens: number
  outputTokens: number
  limit: number
}> {
  const { data, error } = await db
    .from('ai_usage')
    .select('requests, input_tokens, output_tokens')
    .eq('user_id', userId)
    .eq('day', today())

  const rows = (data ?? []) as Array<{ requests: number; input_tokens: number; output_tokens: number }>
  if (error) return { requests: 0, inputTokens: 0, outputTokens: 0, limit: aiEnv().dailyLimit }

  return {
    requests: rows.reduce((sum, row) => sum + (row.requests ?? 0), 0),
    inputTokens: rows.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0),
    outputTokens: rows.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0),
    limit: aiEnv().dailyLimit,
  }
}
