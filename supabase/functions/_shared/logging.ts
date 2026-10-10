/**
 * Structured logging for the AI layer.
 *
 * Every line is a single JSON object so Supabase's log explorer can filter on
 * `event`. NEVER log: API keys, JWTs, passwords, full prompts or full private
 * conversations — `redact()` strips common secret shapes and we only ever log
 * lengths/ids for user content.
 */

type Level = 'info' | 'warn' | 'error'

export interface LogFields {
  [key: string]: unknown
}

const SECRET_KEY = /(api[_-]?key|authorization|token|secret|password|service_role)/i

/** Deep-copy a payload with secret-looking values removed and strings capped. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    if (/^(Bearer|sk-|AIza|eyJ)/i.test(value)) return '[redacted]'
    return value.length > 400 ? `${value.slice(0, 400)}…[${value.length} chars]` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => redact(entry, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(entry, depth + 1)
    }
    return out
  }
  return String(value)
}

export function log(level: Level, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, t: new Date().toISOString(), ...(redact(fields) as object) })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

/** AI request started (no content, ids only). */
export function logRequestStarted(event: string, fields: LogFields): void {
  log('info', event, fields)
}

export function logToolCall(fields: LogFields): void {
  log('info', 'ai.tool_call', fields)
}

export function logEmbeddingJob(fields: LogFields): void {
  log('info', 'ai.embedding_job', fields)
}

export function logFailure(event: string, error: unknown, fields: LogFields = {}): void {
  const message = error instanceof Error ? error.message : String(error)
  log('error', event, { ...fields, error: message })
}
