/**
 * Shared bootstrap for AI edge functions: authenticate → resolve the
 * server-side AI configuration → build the provider.
 *
 * Keeps every function body focused on its own feature instead of repeating
 * the security/env preamble.
 */
import { authenticate, AppError, type Caller } from './http.ts'
import { aiEnv, providerConfigured, type AiEnv } from './env.ts'
import { createEmbeddingProvider, createProvider } from './ai/providers/index.ts'
import type { AiProvider } from './ai/providers/provider.interface.ts'

export interface AiBootstrap {
  caller: Caller
  env: AiEnv
  provider: AiProvider
  embeddingProvider: AiProvider | null
}

/** Authenticated request with a usable provider (throws client-safe errors). */
export async function startAi(request: Request): Promise<AiBootstrap> {
  const caller = await authenticate(request)
  const env = aiEnv()

  if (!providerConfigured(env)) {
    throw new AppError(
      'no_provider',
      'The AI Tutor is not configured on this server yet. Add a provider key (see .env.example) and try again.',
    )
  }

  return {
    caller,
    env,
    provider: createProvider(env),
    embeddingProvider: createEmbeddingProvider(env),
  }
}
