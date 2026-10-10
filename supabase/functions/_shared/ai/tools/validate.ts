/**
 * Tool input validation (pure — unit-tested).
 *
 * Every tool call — whether it comes from the deterministic planner or from
 * the model — goes through here before any SQL runs. Two hard rules:
 *   1. a tool can never be pointed at another student's data (no user_id
 *      arguments at all: the authenticated user comes from the session);
 *   2. every string/number is bounded, so a hostile prompt cannot turn a tool
 *      into a table scan or an injection vector.
 */

export interface ToolCallRaw {
  name: string
  args?: Record<string, unknown> | null
}

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolValidationError'
  }
}

export const TOOL_LIMITS = {
  query: 200,
  id: 64,
  slug: 80,
  limit: 20,
  defaultLimit: 8,
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Replace control characters (never allowed inside tool arguments). */
function stripControl(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    out += code < 32 || code === 127 ? ' ' : char
  }
  return out
}

/** Validate an optional uuid argument. */
export function optionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ToolValidationError(`Invalid value for "${field}".`)
  }
  return value
}

/** Validate a required uuid argument. */
export function requiredId(value: unknown, field: string): string {
  const id = optionalId(value, field)
  if (!id) throw new ToolValidationError(`Missing value for "${field}".`)
  return id
}

/** Free-text query: trimmed, control characters stripped, length-capped. */
export function textQuery(value: unknown, field = 'query', max = TOOL_LIMITS.query): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ToolValidationError(`Invalid value for "${field}".`)
  const clean = stripControl(value).replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max) : clean
}

/** Clamp a limit to a sane range. */
export function clampLimit(value: unknown, fallback = TOOL_LIMITS.defaultLimit): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(Math.floor(numeric), 1), TOOL_LIMITS.limit)
}

export function optionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !allowed.includes(value as T)) return null
  return value as T
}

/**
 * Reject any attempt to pass identity into a tool. Identity always comes from
 * the authenticated session (ToolContext.userId), never from arguments.
 */
export function rejectIdentityArgs(args: Record<string, unknown>): void {
  const forbidden = ['user_id', 'userId', 'target_user', 'targetUserId', 'uid', 'owner_id']
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      throw new ToolValidationError('Tools cannot target another user.')
    }
  }
}

/** Normalise a raw (possibly model-produced) call. */
export function sanitizeToolCall(
  raw: ToolCallRaw,
  allowedNames: readonly string[],
): { name: string; args: Record<string, unknown> } {
  if (!raw || typeof raw !== 'object') throw new ToolValidationError('Malformed tool call.')
  if (typeof raw.name !== 'string' || !allowedNames.includes(raw.name)) {
    throw new ToolValidationError(`Unknown tool: ${String(raw?.name)}`)
  }
  const args =
    raw.args && typeof raw.args === 'object' && !Array.isArray(raw.args)
      ? (raw.args as Record<string, unknown>)
      : {}
  rejectIdentityArgs(args)
  return { name: raw.name, args }
}
