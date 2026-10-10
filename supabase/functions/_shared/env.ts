/**
 * Typed access to the *server-side* environment.
 *
 * Every secret lives here — never in a `VITE_*` variable, never in the
 * browser bundle. Values are read lazily so a function can start (and answer
 * health checks) even when a provider key is missing.
 *
 * Set them with:
 *   supabase secrets set AI_PROVIDER=openai OPENAI_API_KEY=sk-…
 */

export type ProviderName = 'openai' | 'google' | 'anthropic'

export interface AiEnv {
  provider: ProviderName
  model: string
  apiKey: string
  baseUrl: string | null
  embeddingModel: string
  embeddingDim: number
  maxOutputTokens: number
  requestTimeoutMs: number
  dailyLimit: number
  featureDailyLimit: number
  topK: number
  toolPlanning: 'rule' | 'llm'
}

function num(name: string, fallback: number): number {
  const raw = Deno.env.get(name)
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function pickProvider(): ProviderName {
  const raw = (Deno.env.get('AI_PROVIDER') ?? '').toLowerCase().trim()
  if (raw === 'google' || raw === 'gemini') return 'google'
  if (raw === 'anthropic' || raw === 'claude') return 'anthropic'
  if (raw === 'openai' || raw === 'openai-compatible') return 'openai'

  /* Not configured explicitly → infer from whichever key exists. */
  if (Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')) return 'google'
  if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic'
  return 'openai'
}

function keyFor(provider: ProviderName): string {
  if (provider === 'google') return Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY') ?? ''
  if (provider === 'anthropic') return Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  return Deno.env.get('OPENAI_API_KEY') ?? ''
}

function defaultModel(provider: ProviderName): string {
  if (provider === 'google') return 'gemini-2.0-flash'
  if (provider === 'anthropic') return 'claude-sonnet-4-20250514'
  return 'gpt-4o-mini'
}

/** Read the AI configuration (all values are server-side only). */
export function aiEnv(): AiEnv {
  const provider = pickProvider()
  return {
    provider,
    model: Deno.env.get('AI_MODEL')?.trim() || defaultModel(provider),
    apiKey: keyFor(provider),
    baseUrl: Deno.env.get('AI_BASE_URL')?.trim() || null,
    embeddingModel: Deno.env.get('AI_EMBEDDING_MODEL')?.trim() || 'text-embedding-3-small',
    /* Must match the dimension of AI_EMBEDDING_MODEL AND the database
       (public.studyos_embedding_dim()). See .env.example. */
    embeddingDim: num('AI_EMBEDDING_DIM', 1536),
    maxOutputTokens: num('AI_MAX_OUTPUT_TOKENS', 1200),
    requestTimeoutMs: num('AI_REQUEST_TIMEOUT_MS', 45_000),
    dailyLimit: num('AI_DAILY_LIMIT', 60),
    featureDailyLimit: num('AI_FEATURE_DAILY_LIMIT', 25),
    topK: num('AI_TOP_K', 6),
    toolPlanning: (Deno.env.get('AI_TOOL_PLANNING') as 'rule' | 'llm' | null) ?? 'rule',
  }
}

/** `true` when a usable provider key is present. */
export function providerConfigured(env: AiEnv = aiEnv()): boolean {
  return Boolean(env.apiKey)
}
