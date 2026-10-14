/**
 * Board source adapter contract.
 *
 * There is deliberately no giant scraper: every board plugs in through this
 * interface, so adding ICSE/WBCHSE/Maharashtra later means adding a folder,
 * not editing `if board === "CBSE"` branches around the app (spec §4/§6).
 *
 * An adapter is *declarative where it can be* (which domains are allowed,
 * which URL patterns to walk, how a page is interpreted) and only reaches for
 * code when a page genuinely needs parsing. It never:
 *
 *   - bypasses a login, CAPTCHA, paywall or robots directive
 *   - crawls outside its own `domains` allow-list
 *   - claims a licence it was not told about (see `license.ts`)
 *
 * Adapters are pure data + pure functions so the same object can run inside
 * the Deno worker *and* be rendered in the admin UI ("what will this crawl?").
 */
import type { AccessMethod, DocKind, LicenseStatus, SourceType } from '../types'

/* -------------------------------------------------------------------------- */
/* Crawl rules                                                                */
/* -------------------------------------------------------------------------- */

/** Hard ceilings applied on top of whatever an adapter asks for. */
export const CRAWL_LIMITS = {
  /** Links followed from an approved page. Never unlimited. */
  maxDepth: 3,
  /** Documents accepted from a single run. */
  maxDocuments: 400,
  /** Bytes accepted for one document — bigger is a link, not a download. */
  maxBytes: 25 * 1024 * 1024,
  /** Concurrent in-flight requests to one host. */
  maxConcurrency: 2,
  /** Minimum gap between two requests to the same host. */
  minDelayMs: 800,
  /** Redirects followed before the URL is treated as a different origin. */
  maxRedirects: 3,
} as const

export type MatchBehaviour = 'include' | 'exclude'

export interface UrlPattern {
  /** Regular expression source, tested against the full URL. */
  pattern: string
  /** Only `include` patterns are fetched; `exclude` wins over them. */
  behaviour: MatchBehaviour
  /** What the matched URL is expected to yield. */
  docKind?: DocKind
  /** Depth at which this pattern is reachable (0 = the seed page itself). */
  depth?: number
  description?: string
}

export interface AdapterSession {
  /** e.g. `2025-26`. Discovered dynamically — never hard-coded (spec §5). */
  academicSession: string
  /** URLs that were live when the adapter last resolved a session. */
  sessionUrl?: string
  confidence: 'confirmed' | 'inferred' | 'unknown'
}

export interface DiscoveryTarget {
  /** Absolute, already-normalised URL to fetch. */
  url: string
  docKind: DocKind
  depth: number
  /** Optional filters carried forward (class/subject/year). */
  hint?: Record<string, string>
}

export interface AdapterContext {
  /** Applied to every fetch: politeness + identification. */
  userAgent: string
  /** Stop after this many requests regardless of adapter intent. */
  budgetMs: number
  maxDepth: number
  rateLimitMs: number
}

export interface FetchOutcome {
  url: string
  status: number
  contentType: string | null
  bytes: number
  body: string | null
  /** Set when the request was refused before it was made. */
  blocked?: 'robots' | 'domain' | 'depth' | 'size' | 'type'
}

/**
 * One board's knowledge of where its material lives.
 *
 * `discover*` methods return *targets*, not content — the worker performs the
 * fetching under one shared set of safety rules so no adapter can accidentally
 * opt out of robots.txt or the rate limiter.
 */
export interface BoardSourceAdapter {
  /** Stable id used in `source_registry` and in `getSourceAdapter()`. */
  id: string
  /** Board slug this adapter serves (e.g. `cbse`). */
  boardSlug: string
  boardName: string
  label: string
  description: string

  /** Hostnames the adapter may touch. Anything else is refused. */
  domains: string[]
  /** Normalised entry points. */
  baseUrl: string

  defaultSourceType: SourceType
  /** What the adapter asserts about its own material's licence. */
  defaultLicense: LicenseStatus
  defaultAccessMethod: AccessMethod

  urlPatterns: UrlPattern[]

  /**
   * Resolve the current academic session *dynamically* (spec §5): a new
   * session appearing on the site must be picked up without a code change.
   */
  resolveSession(html: string, url: string): AdapterSession | null

  /** Seed URLs for syllabus / curriculum discovery. */
  discoverSyllabusTargets(session: AdapterSession): DiscoveryTarget[]

  /** Seed URLs for sample papers, question papers and marking schemes. */
  discoverPaperTargets(session: AdapterSession, filter?: PaperFilter): DiscoveryTarget[]

  /**
   * Turn a fetched page into links worth following. Returns targets only —
   * the worker re-checks domain, depth and patterns before any request.
   */
  extractLinks(html: string, url: string, depth: number): DiscoveryTarget[]

  /** Should this URL be fetched at all? Excludes win. */
  matches(url: string, depth: number): boolean
}

export interface PaperFilter {
  className?: string
  subjectName?: string
  year?: number
  docKind?: DocKind
}

/* -------------------------------------------------------------------------- */
/* Helpers shared by every adapter                                            */
/* -------------------------------------------------------------------------- */

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

export function isAllowedDomain(url: string, domains: readonly string[]): boolean {
  const host = hostOf(url)
  if (!host) return false
  return domains.some((domain) => {
    const clean = domain.replace(/^www\./, '').toLowerCase()
    return host === clean || host.endsWith(`.${clean}`)
  })
}

export function absolutise(href: string, base: string): string | null {
  try {
    const url = new URL(href, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Evaluate an adapter's pattern list. `exclude` beats `include`; an adapter
 * with no `include` patterns matches nothing (fail closed, not open).
 */
export function matchesPatterns(url: string, patterns: readonly UrlPattern[], depth: number): boolean {
  const excluded = patterns.some(
    (entry) => entry.behaviour === 'exclude' && safeTest(entry.pattern, url),
  )
  if (excluded) return false

  const included = patterns.some(
    (entry) =>
      entry.behaviour === 'include' &&
      (entry.depth === undefined || depth <= entry.depth) &&
      safeTest(entry.pattern, url),
  )
  return included
}

function safeTest(pattern: string, url: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(url)
  } catch {
    return false
  }
}

/** Anchor hrefs on a page, resolved against its URL and de-duplicated. */
export function extractHrefs(html: string, baseUrl: string): string[] {
  const seen = new Set<string>()
  const anchor = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = anchor.exec(html)) !== null) {
    const resolved = absolutise(match[1], baseUrl)
    if (resolved) seen.add(resolved)
  }
  return [...seen]
}

/** Visible text of a page, collapsed — used for session/year detection. */
export function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detect the academic session from a page (e.g. "2025–26", "2025-2026",
 * "Session 2025-26"). Returns `null` rather than guessing — an unknown session
 * must stay unknown (spec §5/§59).
 */
export function detectSession(text: string): AdapterSession | null {
  const enDash = /\b(20\d{2})\s*[–—-]\s*(\d{2,4})\b/.exec(text)
  if (enDash) {
    const start = Number(enDash[1])
    const endRaw = enDash[2]
    const end = endRaw.length === 2 ? 2000 + Number(endRaw) : Number(endRaw)
    if (end === start + 1 || end === start + 2) {
      return {
        academicSession: `${start}-${end === start + 1 ? String(end).slice(2) : end}`,
        confidence: 'inferred',
      }
    }
  }

  const single = /\b(20\d{2})\s*(?:-\s*20\d{2}|Session|Board Exam)\b/.exec(text)
  if (single) {
    const year = Number(single[1])
    return { academicSession: `${year}-${String(year + 1).slice(2)}`, confidence: 'inferred' }
  }

  return null
}

/**
 * Find the *newest* session mentioned on a listing page — so a fresh academic
 * session is discovered automatically instead of waiting for a code update.
 */
export function newestSession(candidates: string[]): string | null {
  let best: string | null = null
  let bestStart = -1
  for (const candidate of candidates) {
    const start = Number(/^(20\d{2})/.exec(candidate)?.[1] ?? -1)
    if (start > bestStart) {
      bestStart = start
      best = candidate
    }
  }
  return best
}
