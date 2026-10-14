/**
 * The politeness layer: everything that decides *whether* and *how* we fetch.
 *
 * Hard limits (from `CRAWL_LIMITS`, the same object the adapters see) are
 * enforced here rather than trusted from callers:
 *
 *   * **allow-list only** — a host not registered in `content_engine_sources`
 *     is never contacted, whatever a page's links say;
 *   * **robots.txt always** — unknown rules mean "do not fetch";
 *   * **per-domain rate** — a rolling window plus `Crawl-delay`;
 *   * **depth cap** — discovery stops following links past `maxDepth`;
 *   * **size cap** — responses are aborted past `maxBytes`, never buffered;
 *   * **concurrency cap** — one host is never asked for more than
 *     `concurrency` things at a time.
 *
 * Nothing here logs response bodies. Pages are transient: only what we
 * deliberately decide to keep is written to storage.
 */
import { CRAWL_LIMITS, absolutise, extractHrefs, hostOf, isAllowedDomain } from '../../../../src/content-engine/sources/base-source.ts'
import { RobotsCache } from './robots.ts'

export interface FetchResult {
  url: string
  ok: boolean
  status: number | null
  finalUrl: string
  contentType: string
  body: string
  bytes: number
  /** Set when the fetch was refused by our own policy rather than the network. */
  refused: 'domain' | 'robots' | 'rate' | 'size' | null
}

export interface CrawlRequest {
  url: string
  depth: number
  signal?: AbortSignal
}

/** Rolling-window rate limiter, one instance per host. */
class DomainGate {
  private stamps: number[] = []
  private active = 0
  private lastAt = 0

  constructor(
    private readonly maxPerMinute: number,
    private readonly concurrency: number,
  ) {}

  /** Resolves when the request may proceed, or rejects if it would exceed the cap. */
  async take(minIntervalMs: number): Promise<void> {
    const now = Date.now()
    this.stamps = this.stamps.filter((stamp) => now - stamp < 60_000)

    if (this.stamps.length >= this.maxPerMinute) {
      throw new Refusal('rate', `Host is at its ${this.maxPerMinute}/minute crawl cap.`)
    }
    if (this.active >= this.concurrency) {
      throw new Refusal('rate', `Host already has ${this.active} requests in flight.`)
    }

    const sinceLast = now - this.lastAt
    const wait = Math.max(minIntervalMs, 0) - sinceLast
    if (wait > 0) await delay(wait)

    this.stamps.push(Date.now())
    this.lastAt = Date.now()
    this.active += 1
  }

  release(): void {
    this.active = Math.max(0, this.active - 1)
  }
}

export class Refusal extends Error {
  constructor(
    readonly kind: NonNullable<FetchResult['refused']>,
    message: string,
  ) {
    super(message)
    this.name = 'Refusal'
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface PoliteFetcherOptions {
  /** Domains we are allowed to touch (the source registry allow-list). */
  allowedDomains: readonly string[]
  maxPerMinute?: number
  concurrency?: number
  maxDepth?: number
  maxBytes?: number
  timeoutMs?: number
  userAgent?: string
}

export class PoliteFetcher {
  private readonly gates = new Map<string, DomainGate>()
  private readonly robots: RobotsCache
  private readonly maxPerMinute: number
  private readonly concurrency: number
  readonly maxDepth: number
  private readonly maxBytes: number
  private readonly timeoutMs: number
  private readonly userAgent: string

  constructor(
    private readonly options: PoliteFetcherOptions,
    fetchText: (url: string, init?: RequestInit) => Promise<string | null> = defaultFetchText,
  ) {
    this.maxPerMinute = options.maxPerMinute ?? CRAWL_LIMITS.maxRequestsPerMinute
    this.concurrency = options.concurrency ?? CRAWL_LIMITS.concurrency
    this.maxDepth = options.maxDepth ?? CRAWL_LIMITS.maxDepth
    this.maxBytes = options.maxBytes ?? CRAWL_LIMITS.maxResponseBytes
    this.timeoutMs = options.timeoutMs ?? CRAWL_LIMITS.timeoutMs
    this.userAgent = options.userAgent ?? 'StudyOSContentEngine/1.0 (+https://studyos.app/bot)'
    this.robots = new RobotsCache(fetchText)
  }

  private gateFor(host: string): DomainGate {
    let gate = this.gates.get(host)
    if (!gate) {
      gate = new DomainGate(this.maxPerMinute, this.concurrency)
      this.gates.set(host, gate)
    }
    return gate
  }

  /** Depth gate — used before any network work happens. */
  canDescend(depth: number): boolean {
    return depth <= this.maxDepth
  }

  async fetch(url: string): Promise<FetchResult> {
    const failure = (refused: NonNullable<FetchResult['refused']>, message: string, status: number | null = null): FetchResult => ({
      url,
      ok: false,
      status,
      finalUrl: url,
      contentType: '',
      body: '',
      bytes: 0,
      refused,
    })

    let host: string
    try {
      host = hostOf(url)
    } catch {
      return failure('domain', 'Malformed URL.')
    }

    if (!isAllowedDomain(url, this.options.allowedDomains)) {
      return failure('domain', `Host ${host} is not on the source allow-list.`)
    }

    if (!(await this.robots.isAllowed(url))) {
      return failure('robots', 'robots.txt does not permit this path, or could not be read.')
    }

    const gate = this.gateFor(host)
    const crawlDelay = await this.robots.crawlDelayFor(url)
    try {
      await gate.take(crawlDelay !== null ? crawlDelay * 1000 : 0)
    } catch (error) {
      if (error instanceof Refusal) return failure('rate', error.message)
      throw error
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      const signal = this.options.signal ? anySignal([this.options.signal, controller.signal]) : controller.signal

      let response: Response
      try {
        response = await fetch(url, {
          redirect: 'follow',
          signal,
          headers: {
            'user-agent': this.userAgent,
            accept: 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.8',
            'accept-language': 'en-IN,en;q=0.9',
          },
        })
      } finally {
        clearTimeout(timer)
      }

      const contentType = response.headers.get('content-type') ?? ''
      const declaredLength = Number(response.headers.get('content-length') ?? '0')
      if (declaredLength && declaredLength > this.maxBytes) {
        await response.body?.cancel()
        return { ...failure('size', `Response declared ${declaredLength} bytes, over the cap.`), status: response.status, contentType }
      }

      if (!response.ok) {
        await response.body?.cancel()
        return { ...failure('size', `Server responded ${response.status}.`, response.status), status: response.status }
      }

      const text = await readCapped(response, this.maxBytes)
      if (text === 'TOO_LARGE') {
        return { ...failure('size', 'Response exceeded the byte cap while streaming.'), status: response.status, contentType }
      }

      return {
        url,
        ok: true,
        status: response.status,
        finalUrl: response.url || url,
        contentType,
        body: text,
        bytes: new TextEncoder().encode(text).length,
        refused: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return failure('size', /abort|timeout/i.test(message) ? 'Request timed out or was aborted.' : message)
    } finally {
      gate.release()
    }
  }

  /** Links from a fetched page that are still inside the allow-list. */
  linksFrom(result: FetchResult): string[] {
    if (!result.ok || !/text\/html/i.test(result.contentType)) return []
    return extractHrefs(result.body, result.finalUrl).filter((href) =>
      isAllowedDomain(href, this.options.allowedDomains),
    )
  }
}

/** Reads a response body but never buffers more than `maxBytes`. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return 'TOO_LARGE'
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

async function defaultFetchText(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, { redirect: 'follow', ...init })
    if (!response.ok) return null
    const text = await response.text()
    return text.length > 64_000 ? text.slice(0, 64_000) : text
  } catch {
    return null
  }
}

/** Minimal `AbortSignal.any` polyfill for the edge runtime. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}

/** Convenience: absolutise + dedupe while preserving discovery order. */
export function normaliseLinks(hrefs: string[], base: string): string[] {
  const seen = new Set<string>()
  for (const href of hrefs) {
    const absolute = absolutise(href, base)
    if (absolute) seen.add(absolute)
  }
  return [...seen]
}
