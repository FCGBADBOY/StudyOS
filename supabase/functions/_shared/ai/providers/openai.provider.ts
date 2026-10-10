/**
 * OpenAI (and OpenAI-compatible) provider.
 *
 * Works with api.openai.com out of the box and with any compatible server
 * (Groq, Together, LM Studio, Ollama, vLLM…) by setting AI_BASE_URL.
 */
import { aiEnv, type AiEnv } from '../../env.ts'
import {
  extractJson,
  withTimeout,
  type AiProvider,
  type GenerateOptions,
  type GenerateResult,
  type EmbeddingResult,
  type VisionResult,
} from './provider.interface.ts'
import { bearerHeaders, raiseForStatus, sseData } from './stream.ts'

interface ChatBody {
  model: string
  messages: unknown[]
  max_tokens: number
  temperature?: number
  stream?: boolean
  response_format?: { type: 'json_object' }
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai'
  readonly model: string
  readonly capabilities = { streaming: true, embeddings: true, vision: true }

  private readonly env: AiEnv
  private readonly base: string

  constructor(env: AiEnv = aiEnv()) {
    this.env = env
    this.model = env.model
    this.base = (env.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  }

  private headers(): Record<string, string> {
    return bearerHeaders(this.env.apiKey)
  }

  private toMessages(options: GenerateOptions): unknown[] {
    return options.messages.map((message) => {
      if (!message.image) return { role: message.role, content: message.content }
      return {
        role: message.role,
        content: [
          { type: 'text', text: message.content },
          {
            type: 'image_url',
            image_url: { url: `data:${message.image.mimeType};base64,${message.image.base64}` },
          },
        ],
      }
    })
  }

  private body(options: GenerateOptions, stream: boolean): ChatBody {
    const payload: ChatBody = {
      model: this.model,
      messages: this.toMessages(options),
      max_tokens: options.maxTokens ?? this.env.maxOutputTokens,
      stream,
    }
    if (options.temperature !== undefined) payload.temperature = options.temperature
    if (options.json && !stream) payload.response_format = { type: 'json_object' }
    return payload
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult> {
    const request = () =>
      fetch(`${this.base}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.body(options, false)),
        signal: options.signal ?? null,
      })

    let response = await withTimeout(request(), this.env.requestTimeoutMs, 'provider')

    /* Some compatible servers reject response_format — retry once without it. */
    if (response.status === 400 && options.json) {
      const payload = { ...this.body(options, false) }
      delete payload.response_format
      response = await fetch(`${this.base}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      })
    }

    await raiseForStatus(response, 'AI provider')
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    }
  }

  async *streamText(options: GenerateOptions): AsyncGenerator<string, void, void> {
    const response = await withTimeout(
      fetch(`${this.base}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.body(options, true)),
        signal: options.signal ?? null,
      }),
      this.env.requestTimeoutMs,
      'provider',
    )
    await raiseForStatus(response, 'AI provider')

    for await (const payload of sseData(response)) {
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>
        }
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        /* ignore keep-alives / malformed frames */
      }
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const response = await withTimeout(
      fetch(`${this.base}/embeddings`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ model: this.env.embeddingModel, input: text }),
      }),
      this.env.requestTimeoutMs,
      'embedding',
    )
    await raiseForStatus(response, 'Embedding provider')
    const data = (await response.json()) as {
      data?: Array<{ embedding: number[] }>
      usage?: { prompt_tokens?: number }
    }
    const embedding = data.data?.[0]?.embedding
    if (!Array.isArray(embedding)) throw new Error('Embedding provider returned no vector')
    if (embedding.length !== this.env.embeddingDim) {
      throw new Error(
        `Embedding dimension mismatch: model returned ${embedding.length}, expected ${this.env.embeddingDim}`,
      )
    }
    return { embedding, tokens: data.usage?.prompt_tokens }
  }

  async analyzeImage(options: {
    base64: string
    mimeType: string
    prompt: string
    maxTokens?: number
    signal?: AbortSignal
  }): Promise<VisionResult> {
    const result = await this.generateText({
      messages: [
        {
          role: 'user',
          content: options.prompt,
          image: { base64: options.base64, mimeType: options.mimeType },
        },
      ],
      maxTokens: options.maxTokens ?? 900,
      json: false,
      signal: options.signal,
    })

    try {
      const parsed = extractJson<{ text?: string; readable?: boolean; confidence?: number }>(result.text)
      return {
        text: parsed.text ?? '',
        readable: parsed.readable !== false,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
      }
    } catch {
      return { text: result.text.trim(), readable: Boolean(result.text.trim()) }
    }
  }
}
