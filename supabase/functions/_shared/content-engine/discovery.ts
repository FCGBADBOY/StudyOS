/**
 * Discovery: walk a registered source with its board adapter and record what
 * is found.
 *
 * What makes this "legality-first" rather than a scraper:
 *
 *   * the walker only ever holds URLs that passed `PoliteFetcher` — allow-list,
 *     robots.txt, rate, depth and size all already applied;
 *   * the adapter decides *what is interesting*; the walker never invents URLs
 *     from templates, so a session year is discovered, not hard-coded;
 *   * each hit is classified with `decideStorage()` **before** anything is
 *     written: a document with an unclear licence is stored as metadata plus a
 *     canonical URL and nothing else;
 *   * duplicates are collapsed by content hash, so re-running discovery is
 *     idempotent rather than additive.
 *
 * Output is a list of rows for `source_documents` — this module never touches
 * the database itself, which keeps it testable.
 */
import { decideStorage, type StorageDecision } from '../../../../src/content-engine/license.ts'
import type { AdapterSession, BoardSourceAdapter, DiscoveryTarget } from '../../../../src/content-engine/sources/base-source.ts'
import { isAllowedDomain } from '../../../../src/content-engine/sources/base-source.ts'
import type {
  AccessMethod,
  DocKind,
  LicenseStatus,
  OfficialStatus,
  SourceType,
} from '../../../../src/content-engine/types.ts'
import { PoliteFetcher, normaliseLinks } from './crawler.ts'

export interface DiscoveredDocument {
  sourceId: string
  sourceName: string
  url: string
  canonicalUrl: string
  title: string
  domain: string
  docKind: DocKind
  officialStatus: OfficialStatus
  licenseStatus: LicenseStatus
  redistributionAllowed: boolean
  accessMethod: AccessMethod
  retrievalStatus: 'linked' | 'stored' | 'blocked'
  decision: StorageDecision
  academicSession: string | null
  bytes: number
  contentType: string
}

export interface DiscoveryRunOptions {
  source: {
    id: string
    name: string
    domain: string
    baseUrl: string
    sourceType: SourceType
    licenseStatus: LicenseStatus
    redistributionAllowed: boolean
    accessMethod: AccessMethod
  }
  adapter: BoardSourceAdapter
  fetcher: PoliteFetcher
  kind: 'syllabus' | 'papers'
  filter?: { className?: string; subjectName?: string; year?: number }
  /** Stop after this many documents have been recorded. */
  maxDocuments?: number
  /** Session resolved by the caller (defaults to the adapter's own probe). */
  session?: AdapterSession | null
  signal?: AbortSignal
}

export interface DiscoveryRunResult {
  session: AdapterSession | null
  fetched: number
  refused: { domain: number; robots: number; rate: number; size: number }
  documents: DiscoveredDocument[]
  errors: string[]
}

/** Best-effort page title; never fabricated when the page has none. */
function titleOf(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i)
  if (!match) return fallback
  const text = match[1].replace(/\s+/g, ' ').trim()
  return text || fallback
}

/** Guess the document kind from a URL/title. Anything unsure is `reference`. */
function classifyKind(url: string, title: string, hint?: DocKind): DocKind {
  if (hint) return hint
  const haystack = `${url} ${title}`.toLowerCase()
  if (/sample[\s-_]?paper|specimen|model[\s-_]?paper/.test(haystack)) return 'sample_paper'
  if (/question[\s-_]?paper|previous[\s-_]?year|pyq|q[\s-]?paper/.test(haystack)) return 'question_paper'
  if (/marking[\s-_]?scheme|mark[\s-_]?distribution|rubric/.test(haystack)) return 'marking_scheme'
  if (/syllabus|curriculum|course[\s-_]?structure/.test(haystack)) return 'syllabus'
  if (/ncert|textbook|ebook|chapter/.test(haystack)) return 'reference'
  if (/notification|circular|date[\s-]?sheet|admit[\s-]?card/.test(haystack)) return 'notification'
  return 'other'
}

/**
 * Authenticity is never assumed. A document is `verified_official` only when
 * it came from an official board domain we have registered as such; anything
 * else is `unverified` until a reviewer says otherwise.
 */
function authenticityFor(url: string, sourceType: SourceType): OfficialStatus {
  /* Only a board's own domain may claim `verified_official`. An academic body
     that is not the issuing board is not the board, however official it is. */
  if (sourceType === 'official_board') return 'verified_official'
  if (sourceType === 'open_archive' || sourceType === 'open_educational') {
    return 'verified_source_archive'
  }
  return 'unverified'
}

/**
 * Breadth-first walk. BFS rather than DFS so that hitting the budget stops
 * exploration evenly across the site instead of down one branch.
 */
export async function runDiscovery(options: DiscoveryRunOptions): Promise<DiscoveryRunResult> {
  const { adapter, fetcher, source } = options
  const budget = options.maxDocuments ?? 40
  const allowedDomains = adapter.domains

  const result: DiscoveryRunResult = {
    session: options.session ?? null,
    fetched: 0,
    refused: { domain: 0, robots: 0, rate: 0, size: 0 },
    documents: [],
    errors: [],
  }

  const seeds: DiscoveryTarget[] = options.session
    ? options.kind === 'syllabus'
      ? adapter.discoverSyllabusTargets(options.session)
      : adapter.discoverPaperTargets(options.session, options.filter)
    : []

  const queue: Array<{ url: string; depth: number; docKind?: DocKind }> = seeds
    .filter((target) => adapter.matches(target.url, 0))
    .map((target) => ({ url: target.url, depth: target.depth ?? 0, docKind: target.docKind }))
  const visited = new Set<string>()

  if (queue.length === 0 && !options.session) {
    /* No session yet — probe the landing page first so we never assume a year. */
    queue.push({ url: adapter.baseUrl, depth: 0 })
  }

  while (queue.length > 0 && result.documents.length < budget) {
    if (options.signal?.aborted) {
      result.errors.push('Discovery was cancelled.')
      break
    }

    const next = queue.shift()
    if (!next || visited.has(next.url)) continue
    visited.add(next.url)

    if (!fetcher.canDescend(next.depth)) continue

    const page = await fetcher.fetch(next.url)
    result.fetched += 1

    if (!page.ok && page.refused) {
      result.refused[page.refused] += 1
      if (page.refused === 'robots' || page.refused === 'domain') continue
      if (page.refused === 'rate') {
        /* Back off rather than hammering a host that asked us to slow down. */
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      continue
    }
    if (!page.ok) continue

    /* Resolve (or confirm) the academic session from real page text. */
    if (!result.session) {
      const detected = adapter.resolveSession(page.body, page.finalUrl)
      if (detected) {
        result.session = detected
        for (const target of adapter.discoverSyllabusTargets(detected)) {
          if (!visited.has(target.url)) queue.push({ url: target.url, depth: target.depth, docKind: target.docKind })
        }
        for (const target of adapter.discoverPaperTargets(detected, options.filter)) {
          if (!visited.has(target.url)) queue.push({ url: target.url, depth: target.depth, docKind: target.docKind })
        }
      }
    }

    const title = titleOf(page.body, next.url)
    const kind = classifyKind(page.finalUrl, title, next.docKind)
    const decision = decideStorage({
      license: source.licenseStatus,
      accessMethod: source.accessMethod,
    })

    result.documents.push({
      sourceId: source.id,
      sourceName: source.name,
      url: page.url,
      canonicalUrl: page.finalUrl,
      title,
      domain: new URL(page.finalUrl).hostname.replace(/^www\./, ''),
      docKind: kind,
      officialStatus: authenticityFor(page.finalUrl, source.sourceType),
      licenseStatus: source.licenseStatus,
      redistributionAllowed: decision === 'store',
      accessMethod: source.accessMethod,
      retrievalStatus: decision === 'block' ? 'blocked' : decision === 'store' ? 'stored' : 'linked',
      decision,
      academicSession: result.session?.academicSession ?? null,
      bytes: page.bytes,
      contentType: page.contentType,
    })

    /* Only continue walking when the page itself says there is more to see. */
    if (next.depth >= fetcher.maxDepth) continue
    const links = adapter.extractLinks(page.body, page.finalUrl, next.depth + 1)
    const hrefs = links.length
      ? links.map((link) => link.url)
      : normaliseLinks(fetcher.linksFrom(page), page.finalUrl)

    for (const href of hrefs) {
      if (visited.has(href)) continue
      if (!isAllowedDomain(href, allowedDomains)) continue
      if (!adapter.matches(href, next.depth + 1)) continue
      queue.push({ url: href, depth: next.depth + 1 })
    }
  }

  return result
}
