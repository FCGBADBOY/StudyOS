/**
 * HTTP plumbing for AI edge functions: request parsing, authentication and
 * user-friendly error responses.
 *
 * Rules:
 *  - every function requires a valid user JWT (except where noted);
 *  - raw provider/database errors NEVER reach the browser — they are mapped to
 *    a stable code + human message;
 *  - request bodies are size-capped before we touch them.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'
import { log } from './logging.ts'

export const MAX_BODY_BYTES = 6 * 1024 * 1024 // images are downscaled client-side

/** Stable, client-safe error codes. */
export type ErrorCode =
  | 'unauthorized'
  | 'invalid_request'
  | 'not_found'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_blocked'
  | 'no_provider'
  | 'image_unreadable'
  | 'no_sources'
  | 'internal'

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  invalid_request: 400,
  not_found: 404,
  rate_limited: 429,
  provider_unavailable: 502,
  provider_timeout: 504,
  provider_blocked: 422,
  no_provider: 503,
  image_unreadable: 422,
  no_sources: 200,
  internal: 500,
}

/** An error whose message is safe to show a student. */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly detail?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.detail = detail
  }

  get status(): number {
    return STATUS[this.code] ?? 500
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/** Map whatever went wrong onto a code + message we are willing to show. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error

  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && code in STATUS) {
    const message = error instanceof Error ? error.message : 'Request failed.'
    return new AppError(code as ErrorCode, message)
  }
  if (error instanceof Error && error.name === 'ProviderNotConfiguredError') {
    return new AppError('no_provider', error.message)
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/timed? ?out|aborterror|deadline/i.test(message)) {
    return new AppError('provider_timeout', 'The tutor took too long to reply. Please try again.')
  }
  if (/rate limit|429|quota/i.test(message)) {
    return new AppError('rate_limited', 'The tutor is busy right now. Try again in a minute.')
  }
  if (/moderation|content policy|safety|blocked/i.test(message)) {
    return new AppError('provider_blocked', 'That request could not be processed as written. Please rephrase it.')
  }
  if (/fetch|network|econnrefused|enotfound|502|503/i.test(message)) {
    return new AppError('provider_unavailable', 'The AI service is unavailable right now. Please try again later.')
  }
  return new AppError('internal', 'Something went wrong while composing a reply. Please try again.')
}

export function jsonResponse(body: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(request ? corsHeaders(request) : {}),
    },
  })
}

export function errorResponse(request: Request, error: unknown): Response {
  const appError = toAppError(error)
  if (appError.status >= 500) {
    log('error', 'ai.request_failed', { code: appError.code, message: appError.message })
  }
  return jsonResponse(
    { error: { code: appError.code, message: appError.message, ...(appError.detail ?? {}) } },
    appError.status,
    request,
  )
}

/** Read + validate a JSON body (size-capped, must be an object). */
export async function readJson<T extends object>(request: Request): Promise<T> {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (length && length > MAX_BODY_BYTES) {
    throw new AppError('invalid_request', 'That request is too large.')
  }
  let text: string
  try {
    text = await request.text()
  } catch {
    throw new AppError('invalid_request', 'We could not read that request.')
  }
  if (text.length > MAX_BODY_BYTES) {
    throw new AppError('invalid_request', 'That request is too large.')
  }
  try {
    const parsed = JSON.parse(text || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as T
  } catch {
    throw new AppError('invalid_request', 'That request body was not valid JSON.')
  }
}

export interface Caller {
  userId: string
  /** Supabase client bound to the caller's JWT — RLS applies to every query. */
  client: SupabaseClient
  /** Service-role client for server-only work (always scoped by user id in SQL). */
  admin: SupabaseClient
  role: string | null
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

/**
 * Resolve the calling user. Uses the caller's JWT for `client` so row-level
 * security keeps protecting student data, and the service role only for
 * privileged, explicitly user-scoped reads.
 */
export async function authenticate(request: Request): Promise<Caller> {
  const token = bearer(request)
  if (!token) throw new AppError('unauthorized', 'Please sign in to use the AI Tutor.')

  const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_ANON_KEY') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!url || !anonKey) {
    throw new AppError('internal', 'The backend is not configured for AI requests.')
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) {
    throw new AppError('unauthorized', 'Your session has expired. Please sign in again.')
  }

  const admin =
    serviceRole.length > 0
      ? createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
      : client

  return {
    userId: data.user.id,
    client,
    admin,
    role: (data.user.app_metadata?.role as string | undefined) ?? null,
  }
}

/** Require a staff role for admin endpoints (defence in depth on top of RLS). */
export async function requireStaff(caller: Caller): Promise<void> {
  const { data } = await caller.client.rpc('is_admin_user')
  if (data !== true) {
    throw new AppError('unauthorized', 'This area is for StudyOS administrators.')
  }
}
