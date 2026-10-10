/**
 * Google Gemini provider (generativelanguage.googleapis.com).
 *
 * Selected with AI_PROVIDER=google (or by setting GEMINI_API_KEY).
 * REST only — no SDK, so the edge function bundle stays tiny.
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
import { raiseForStatus, sseData } from './stream.ts'

interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

interface GeminiContent {
  role?: 'user' | 'model'
  parts: GeminiPart[]
}

export class GoogleProvider implements AiProvider {
  readonly name = 'google'
  readonly model: string
  readonly capabilities = { streaming: true, embeddings: true, vision: true }

  private readonly env: AiEnv
  private readonly base = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(env: AiEnv = aiEnv()) {
    this.env = env
    this.model = env.model
  }

  private headers(): Record<string, string> {
    return { 'content-type': 'application/json', 'x-goog-api-key': this.env.apiKey }
  }

  private split(options: GenerateOptions): { system?: string; contents: GeminiContent[] } {
    const systemParts: string[] = []
    const contents: GeminiContent[] = []

    for (const message of options.messages) {
      if (message.role === 'system') {
        systemParts.push(message.content)
        continue
      }
      const parts: GeminiPart[] = [{ text: message.content }]
      if (message.image) {
        parts.push({ inline_data: { mime_type: message.image.mimeType, data: message.image.base64 } })
      }
      contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts })
    }

    return { system: systemParts.join('\n\n') || undefined, contents }
  }

  private body(options: GenerateOptions, json: boolean): Record<string, unknown> {
    const { system, contents } = this.split(options)
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: options.maxTokens ?? this.env.maxOutputTokens,
    }
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature
    if (json) generationConfig.responseMimeType = 'application/json'

    return {
      ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig,
    }
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult> {
    const url = `${this.base}/models/${this.model}:generateContent`
    const response = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.body(options, Boolean(options.json))),
        signal: options.signal ?? null,
      }),
      this.env.requestTimeoutMs,
      'provider',
    )
    await raiseForStatus(response, 'AI provider')

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
    }
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')

    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    }
  }

  async *streamText(options: GenerateOptions): AsyncGenerator<string, void, void> {
    const url = `${this.base}/models/${this.model}:streamGenerateContent?alt=sse`
    const response = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.body(options, false)),
        signal: options.signal ?? null,
      }),
      this.env.requestTimeoutMs,
      'provider',
    )
    await raiseForStatus(response, 'AI provider')

    for await (const payload of sseData(response)) {
      try {
        const chunk = JSON.parse(payload) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = (chunk.candidates?.[0]?.content?.parts ?? [])
          .map((part) => part.text ?? '')
          .join('')
        if (text) yield text
      } catch {
        /* ignore malformed frames */
      }
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const model = this.env.embeddingModel.replace(/^models\//, '')
    const url = `${this.base}/models/${model}:embedContent`
    const body: Record<string, unknown> = {
      model: `models/${model}`,
      content: { parts: [{ text: text.slice(0, 30_000) }] },
    }
    /* gemini-embedding-001 defaults to 3072 dims — pin it to the configured size. */
    if (model.includes('gemini-embedding')) {
      ;(body as { outputDimensionality?: number }).outputDimensionality = this.env.embeddingDim
    }

    const response = await withTimeout(
      fetch(url, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) }),
      this.env.requestTimeoutMs,
      'embedding',
    )
    await raiseForStatus(response, 'Embedding provider')

    const data = (await response.json()) as { embedding?: { values?: number[] } }
    const embedding = data.embedding?.values
    if (!Array.isArray(embedding)) throw new Error('Embedding provider returned no vector')
    if (embedding.length !== this.env.embeddingDim) {
      throw new Error(
        `Embedding dimension mismatch: model returned ${embedding.length}, expected ${this.env.embeddingDim}`,
      )
    }
    return { embedding }
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
