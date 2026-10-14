/**
 * robots.txt handling for the content engine.
 *
 * Rules this module exists to guarantee:
 *
 *   * a crawl of a host it cannot read robots.txt for does not happen
 *     (fail closed, not open);
 *   * `Disallow` is honoured for our specific product token, falling back to
 *     the generic `*` group when no product token matches;
 *   * `Crawl-delay` is respected when the site asks for one;
 *   * results are cached per host for the length of a run so we never fetch
 *     robots.txt more than once per domain.
 *
 * This is deliberately a tiny, dependency-free parser. Only the directives we
 * act on are understood; everything else is ignored rather than guessed at.
 */

export interface RobotsRules {
  /** Absolute path prefixes our product token (or `*`) may not fetch. */
  disallow: string[]
  /** Path prefixes explicitly allowed, which take precedence when longer. */
  allow: string[]
  /** Seconds the site asks us to wait between requests, if stated. */
  crawlDelaySeconds: number | null
  /** True when the host answered with a usable robots.txt. */
  present: boolean
}

const EMPTY: RobotsRules = {
  disallow: [],
  allow: [],
  crawlDelaySeconds: null,
  present: false,
}

/** Our crawler identifies itself here; sites can target it precisely. */
export const PRODUCT_TOKEN = 'studyos'

export function parseRobots(text: string, productToken = PRODUCT_TOKEN): RobotsRules {
  const groups: Array<{ allow: string[]; disallow: string[]; delay: number | null }> = []
  let current: { allow: string[]; disallow: string[]; delay: number | null } | null = null
  let appliesToUs = false

  const flush = () => {
    if (current && appliesToUs) groups.push(current)
    current = null
    appliesToUs = false
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue

    const separator = line.indexOf(':')
    if (separator < 0) continue

    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === 'user-agent') {
      /* A run of User-agent lines belongs to the group that follows them. */
      if (!current) {
        current = { allow: [], disallow: [], delay: null }
        appliesToUs = false
      }
      const agent = value.replace(/^\*/).toLowerCase()
      if (agent === `*` || agent.includes(productToken.toLowerCase())) appliesToUs = true
      continue
    }

    if (!current) continue

    if (field === 'disallow') {
      /* An empty Disallow means "everything allowed" for this group. */
      if (value) current.disallow.push(value)
      else current.disallow.push('')
      continue
    }
    if (field === 'allow') {
      if (value) current.allow.push(value)
      continue
    }
    if (field === 'crawl-delay') {
      const seconds = Number(value)
      if (Number.isFinite(seconds) && seconds >= 0) current.delay = seconds
      continue
    }

    /* A new directive type ends the current group's definition. */
    if (field === 'user-agent') flush()
  }
  flush()

  if (groups.length === 0) return { ...EMPTY, present: true }

  const disallow = groups.flatMap((group) => group.disallow).filter((entry) => entry !== '')
  const allow = groups.flatMap((group) => group.allow)
  const delay = groups.find((group) => group.delay !== null)?.delay ?? null

  return {
    disallow,
    allow,
    crawlDelaySeconds: delay,
    present: true,
  }
}

/** Longest-match semantics: an explicit Allow beats a Disallow of the same length. */
export function isPathAllowed(path: string, rules: RobotsRules): boolean {
  if (!rules.present) return false /* fail closed — no rules, no crawl */

  let bestAllow = -1
  for (const prefix of rules.allow) {
    if (path.startsWith(prefix)) bestAllow = Math.max(bestAllow, prefix.length)
  }

  let bestDisallow = -1
  for (const prefix of rules.disallow) {
    if (prefix === '') continue
    if (path.startsWith(prefix)) bestDisallow = Math.max(bestDisallow, prefix.length)
  }

  if (bestDisallow < 0) return true
  return bestAllow > bestDisallow
}

export interface RobotsFetcher {
  (robotsUrl: string): Promise<string | null>
}

/**
 * Per-run robots.txt cache.
 *
 * `null` means "we could not determine the rules" and is treated as blocked
 * by `isAllowed()`, so an unreachable robots.txt stops the crawl rather than
 * silently permitting it.
 */
export class RobotsCache {
  private readonly cache = new Map<string, Promise<RobotsRules | null>>()

  constructor(private readonly fetchText: RobotsFetcher) {}

  private load(origin: string): Promise<RobotsRules | null> {
    const cached = this.cache.get(origin)
    if (cached) return cached

    const pending = this.fetchText(`${origin}/robots.txt`)
      .then((text) => (text === null ? null : parseRobots(text)))
      .catch(() => null)
    this.cache.set(origin, pending)
    return pending
  }

  async rulesFor(url: string): Promise<RobotsRules | null> {
    let origin: string
    try {
      origin = new URL(url).origin
    } catch {
      return null
    }
    return this.load(origin)
  }

  /** `null` (unknown) is treated as not allowed — see class comment. */
  async isAllowed(url: string): Promise<boolean> {
    const rules = await this.rulesFor(url)
    if (!rules || !rules.present) return false
    let path: string
    try {
      const parsed = new URL(url)
      path = `${parsed.pathname}${parsed.search}`
    } catch {
      return false
    }
    return isPathAllowed(path, rules)
  }

  async crawlDelayFor(url: string): Promise<number | null> {
    const rules = await this.rulesFor(url)
    return rules?.crawlDelaySeconds ?? null
  }
}
