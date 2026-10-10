/**
 * CORS + preflight helpers shared by every StudyOS AI edge function.
 *
 * The frontend calls these functions with the user's anon-key JWT, so the
 * allowed origin is the deployed app (configurable via ALLOWED_ORIGINS) and
 * credentials are never echoed back.
 */

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
]

function allowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? ''
  const extra = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return [...DEFAULT_ORIGINS, ...extra]
}

/** Resolve the origin header we should echo (same-origin calls send none). */
function resolveOrigin(request: Request): string {
  const origin = request.headers.get('origin')
  if (!origin) return DEFAULT_ORIGINS[0]
  return allowedOrigins().includes(origin) ? origin : allowedOrigins()[0]
}

export function corsHeaders(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(request),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-requested-with, accept',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

/** `true` for a preflight OPTIONS request. */
export function isPreflight(request: Request): boolean {
  return request.method.toUpperCase() === 'OPTIONS'
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}
