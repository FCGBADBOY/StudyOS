/**
 * Provider registry — the one place that knows which concrete provider the
 * deployment uses. Selected entirely from server-side env vars.
 *
 *   AI_PROVIDER = openai | google | anthropic   (inferred from keys if unset)
 *
 * To add a provider: implement `AiProvider`, then add a case below. Nothing
 * else in the codebase (edge functions, prompts, retrieval, frontend) changes.
 */
import { aiEnv, type AiEnv } from '../../env.ts'
import {
  ProviderNotConfiguredError,
  type AiProvider,
} from './provider.interface.ts'
import { OpenAiProvider } from './openai.provider.ts'
import { GoogleProvider } from './google.provider.ts'
import { AnthropicProvider } from './anthropic.provider.ts'

export * from './provider.interface.ts'
export { OpenAiProvider } from './openai.provider.ts'
export { GoogleProvider } from './google.provider.ts'
export { AnthropicProvider } from './anthropic.provider.ts'

/** Build the configured provider (throws when no key is present). */
export function createProvider(env: AiEnv = aiEnv()): AiProvider {
  if (!env.apiKey) throw new ProviderNotConfiguredError()
  switch (env.provider) {
    case 'google':
      return new GoogleProvider(env)
    case 'anthropic':
      return new AnthropicProvider(env)
    default:
      return new OpenAiProvider(env)
  }
}

/**
 * A provider that can embed, or `null` when none can (e.g. Anthropic) —
 * retrieval then degrades to keyword search instead of failing.
 */
export function createEmbeddingProvider(env: AiEnv = aiEnv()): AiProvider | null {
  try {
    const provider = createProvider(env)
    return provider.capabilities.embeddings ? provider : null
  } catch {
    return null
  }
}
