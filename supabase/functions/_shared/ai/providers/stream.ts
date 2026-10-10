/**
 * Minimal Server-Sent Events reader used by every provider that streams.
 * Tolerant of partial chunks: lines are buffered until a full event arrives.
 */
export async function* sseData(response: Response): AsyncGenerator<string, void, void> {
  if (!response.body) throw new Error('Provider returned an empty stream body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim()
          if (payload && payload !== '[DONE]') yield payload
        }
        newline = buffer.indexOf('\n')
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* stream already closed */
    }
  }
}

/** Headers every provider request needs (key auth). */
export function bearerHeaders(apiKey: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  }
}

/** Throw a readable error for a non-2xx provider response. */
export async function raiseForStatus(response: Response, label: string): Promise<void> {
  if (response.ok) return
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string } | string }
    detail =
      typeof body.error === 'string'
        ? body.error
        : body.error?.message ?? JSON.stringify(body).slice(0, 300)
  } catch {
    detail = `HTTP ${response.status}`
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`${label} rejected the server credentials (HTTP ${response.status})`)
  }
  if (response.status === 429) throw new Error(`${label} rate limited: ${detail}`)
  if (response.status >= 500) throw new Error(`${label} unavailable (HTTP ${response.status}): ${detail}`)
  throw new Error(`${label} error: ${detail}`)
}
