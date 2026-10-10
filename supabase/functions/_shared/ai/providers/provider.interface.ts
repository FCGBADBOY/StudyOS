/**
 * Provider abstraction — the ONLY contract the rest of the AI layer talks to.
 *
 * Everything above this file (prompts, retrieval, tools, chat orchestration,
 * every edge function) is provider-agnostic. Adding a provider means adding
 * one file in `providers/` and registering it in `providers/index.ts` — no
 * feature code changes, no frontend changes.
 *
 * Providers are constructed server-side from `env.ts`. The browser never sees
 * a provider: it only talks to these edge functions (see `src/ai/`).
 */

export type ChatRole = 'system' | 'user' | 'assistant'

export interface PromptMessage {
  role: ChatRole
  content: string
  /** Optional image attached to a user message (vision models only). */
  image?: { base64: string; mimeType: string }
}

export interface GenerateOptions {
  messages: PromptMessage[]
  maxTokens?: number
  temperature?: number
  /** Ask for a JSON document back (used by quiz/flashcard/image features). */
  json?: boolean
  signal?: AbortSignal
}

export interface GenerateResult {
  text: string
  inputTokens?: number
  outputTokens?: number
}

export interface EmbeddingResult {
  embedding: number[]
  tokens?: number
}

export interface VisionResult {
  text: string
  /** `false` when the model reports it could not read the image. */
  readable: boolean
  confidence?: number
}

export interface ProviderCapabilities {
  streaming: boolean
  embeddings: boolean
  vision: boolean
}

export interface AiProvider {
  readonly name: string
  readonly model: string
  readonly capabilities: ProviderCapabilities

  /** One-shot completion. */
  generateText(options: GenerateOptions): Promise<GenerateResult>

  /** Token-by-token completion. Yields text deltas; end of iteration = done. */
  streamText(options: GenerateOptions): AsyncGenerator<string, void, void>

  /** Embedding for retrieval. Throws `not_supported` when unavailable. */
  generateEmbedding(text: string): Promise<EmbeddingResult>

  /** Read a question image (printed, handwritten, diagram, equation). */
  analyzeImage(options: {
    base64: string
    mimeType: string
    prompt: string
    maxTokens?: number
    signal?: AbortSignal
  }): Promise<VisionResult>
}

/** Thrown when the deployment has no usable provider/key configured. */
export class ProviderNotConfiguredError extends Error {
  constructor(message = 'No AI provider is configured on this server.') {
    super(message)
    this.name = 'ProviderNotConfiguredError'
  }
}

/** Thrown by providers that do not implement an optional capability. */
export class CapabilityNotSupportedError extends Error {
  constructor(capability: string, provider: string) {
    super(`Provider "${provider}" does not support ${capability}.`)
    this.name = 'CapabilityNotSupportedError'
  }
}

/** Enforce a deadline around a fetch so a hung provider cannot hang the UI. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'request',
): Promise<T> {
  let timer: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Extract the first JSON object/array found in a model reply (tolerant). */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [fenced?.[1] ?? '', text]
  for (const candidate of candidates) {
    const start = candidate.search(/[[{]/)
    if (start === -1) continue
    const opener = candidate[start]
    const closer = opener === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < candidate.length; i += 1) {
      const char = candidate[i]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === opener || (opener === '{' && char === '{') || (opener === '[' && char === '[')) depth += 1
      else if (char === closer) {
        depth -= 1
        if (depth === 0) {
          const raw = candidate.slice(start, i + 1)
          return JSON.parse(raw) as T
        }
      }
    }
  }
  throw new Error('No JSON object found in model reply')
}
