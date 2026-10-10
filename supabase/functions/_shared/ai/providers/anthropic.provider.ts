/**
 * Anthropic Claude provider (api.anthropic.com).
 *
 * Selected with AI_PROVIDER=anthropic (or by setting ANTHROPIC_API_KEY).
 * Note: Anthropic has no embeddings endpoint — retrieval degrades to
 * keyword search when this provider is active (see retrieval/embed.ts).
 */
import { aiEnv, type AiEnv } from '../../env.ts'
import {
  CapabilityNotSupportedError,
  extractJson,
  withTimeout,
  type AiProvider,
  type GenerateOptions,
  type GenerateResult,
  type EmbeddingResult,
  type VisionResult,
} from './provider.interface.ts'
import { raiseForStatus, sseData } from './stream.ts'

interface AnthropicContent {
  type: 'text' | 'image'
  text?: string
  source?: { type: 'base64'; media_type: string; data: string }
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: AnthropicContent[]
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic'
  readonly model: string
  readonly capabilities = { streaming: true, embeddings: false, vision: true }

  private readonly env: AiEnv
  private readonly base: string

  constructor(env: AiEnv = aiEnv()) {
    this.env = env
    this.model = env.model
    this.base = (env.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '')
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-api-key': this.env.apiKey,
      'anthropic-version': '2023-06-01',
    }
  }

  private split(options: GenerateOptions): { system?: string; messages: AnthropicMessage[] } {
    const system: string[] = []
    const messages: AnthropicMessage[] = []

    for (const message of options.messages) {
      if (message.role === 'system') {
        system.push(message.content)
        continue
      }
      const content: AnthropicContent[] = [{ type: 'text', text: message.content }]
      if (message.image) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: message.image.mimeType, data: message.image.base64 },
        })
      }
      messages.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content })
    }

    return { system: system.join('\n\n') || undefined, messages }
  }

  private body(options: GenerateOptions, stream: boolean): Record<string, unknown> {
    const { system, messages } = this.split(options)
    return {
      model: this.model,
      max_tokens: options.maxTokens ?? this.env.maxOutputTokens,
      ...(system ? { system } : {}),
      messages,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(stream ? { stream: true } : {}),
    }
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult> {
    const response = await withTimeout(
      fetch(`${this.base}/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.body(options, false)),
        signal: options.signal ?? null,
      }),
      this.env.requestTimeoutMs,
      'provider',
    )
    await raiseForStatus(response, 'AI provider')

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const text = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')

    return {
      text,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    }
  }

  async *streamText(options: GenerateOptions): AsyncGenerator<string, void, void> {
    const response = await withTimeout(
      fetch(`${this.base}/messages`, {
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
        const event = JSON.parse(payload) as {
          type?: string
          delta?: { type?: string; text?: string }
        }
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          if (event.delta.text) yield event.delta.text
        }
      } catch {
        /* ignore malformed frames */
      }
    }
  }

  async generateEmbedding(): Promise<EmbeddingResult> {
    throw new CapabilityNotSupportedError('embeddings', this.name)
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
