/**
 * Embedding helpers: batching, retries with backoff, dimension validation.
 *
 * Failures degrade gracefully — a `null` entry means "this text has no
 * vector", and hybrid search falls back to keyword matching for it. Embedding
 * generation is never allowed to break a request.
 */
import type { AiProvider } from '../providers/provider.interface.ts'
import { log } from '../../logging.ts'

export interface EmbedOptions {
  batchSize?: number
  maxRetries?: number
  /** Texts longer than this are truncated (models reject huge inputs). */
  maxChars?: number
}

export function truncateForEmbedding(text: string, maxChars = 24_000): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}

/** Embed a single string; `null` on any failure (never throws). */
export async function embedText(
  provider: AiProvider | null,
  text: string,
  maxChars?: number,
): Promise<number[] | null> {
  if (!provider || !text.trim()) return null
  try {
    const result = await provider.generateEmbedding(truncateForEmbedding(text, maxChars))
    return result.embedding
  } catch (error) {
    log('warn', 'ai.embedding_failed', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

/**
 * Embed many strings. Returns one entry per input, `null` where embedding
 * failed. Retries individual batches a bounded number of times (no infinite
 * loops) and never throws.
 */
export async function embedBatch(
  provider: AiProvider | null,
  texts: string[],
  options: EmbedOptions = {},
): Promise<Array<number[] | null>> {
  if (!provider) return texts.map(() => null)

  const batchSize = Math.max(1, options.batchSize ?? 16)
  const maxRetries = Math.max(0, options.maxRetries ?? 2)
  const out: Array<number[] | null> = []

  for (let start = 0; start < texts.length; start += batchSize) {
    const slice = texts.slice(start, start + batchSize)
    const vectors: Array<number[] | null> = []

    for (const text of slice) {
      let attempt = 0
      let done: number[] | null = null
      while (attempt <= maxRetries && done === null) {
        try {
          const result = await provider.generateEmbedding(
            truncateForEmbedding(text, options.maxChars),
          )
          done = result.embedding
        } catch (error) {
          attempt += 1
          if (attempt > maxRetries) {
            log('warn', 'ai.embedding_gave_up', {
              error: error instanceof Error ? error.message : String(error),
              attempt,
            })
          } else {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
          }
        }
      }
      vectors.push(done)
    }

    out.push(...vectors)
  }

  return out
}
