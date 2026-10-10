/**
 * Service-role client for the few server-only jobs that must not be shaped by
 * row level security (embedding pipeline, aggregate analytics).
 *
 * Rules:
 *  - never returned to the browser — only edge functions use it;
 *  - every query it runs is explicitly scoped (by resource/chapter id) or is
 *    an aggregate over tables whose RLS would hide it from admins;
 *  - it exists only when SUPABASE_SERVICE_ROLE_KEY is set (hosted secrets).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AppError } from './http.ts'

let cached: SupabaseClient | null = null

/** Memoised service-role client (throws a client-safe error when unconfigured). */
export function serviceAdmin(): SupabaseClient {
  if (cached) return cached

  const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!url || !serviceRole) {
    throw new AppError(
      'internal',
      'This server action needs SUPABASE_SERVICE_ROLE_KEY, which is not configured.',
    )
  }

  cached = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
  return cached
}
