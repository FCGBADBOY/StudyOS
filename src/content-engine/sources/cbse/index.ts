/**
 * CBSE source adapter — the first, fully implemented board adapter.
 *
 * Priority order (spec §5): official CBSE properties first, then official
 * academic portals, then approved open-educational mirrors. Nothing outside
 * `domains` is ever fetched, and every session/year is *discovered* from the
 * live pages rather than hard-coded — when a new academic session appears the
 * adapter picks it up on the next run.
 *
 * The patterns below describe where CBSE publishes:
 *   - curriculum / syllabus listings
 *   - Sample Question Papers and Marking Schemes
 *   - previous year question papers
 *   - notifications that change the curriculum
 *
 * They are intentionally expressed as *patterns over an allow-list* rather
 * than a fixed list of URLs, so a URL scheme change is a one-line edit here
 * and not a broken crawler.
 */
import type { DocKind } from '../../types'
import {
  detectSession,
  extractHrefs,
  matchesPatterns,
  newestSession,
  textOf,
  type AdapterSession,
  type BoardSourceAdapter,
  type DiscoveryTarget,
  type PaperFilter,
  type UrlPattern,
} from '../base-source'

/** Domains CBSE material is accepted from. Subdomains are allowed. */
const CBSE_DOMAINS = ['cbse.gov.in', 'cbseacademic.nic.in', 'results.cbse.nic.in', 'nic.in']

/**
 * URL patterns for the CBSE property set.
 *
 * `include` patterns are the only URLs the worker will request; `exclude`
 * patterns keep the crawler out of login areas, archived circular archives it
 * does not need, and non-academic subdomains such as the results portal.
 */
const CBSE_PATTERNS: UrlPattern[] = [
  // --- seeds -------------------------------------------------------------
  {
    pattern: '^https?://(www\\.)?cbse\\.gov\\.in/(curriculum|academic|syllabus|assessment)',
    behaviour: 'include',
    depth: 0,
    description: 'CBSE curriculum & academic landing pages',
  },
  {
    pattern: '^https?://cbseacademic\\.nic\\.in/?.*$',
    behaviour: 'include',
    depth: 0,
    description: 'CBSE Academic microsite',
  },
  {
    pattern: '^https?://(www\\.)?cbse\\.gov\\.in/',
    behaviour: 'include',
    depth: 1,
    description: 'CBSE site, one hop from an approved seed',
  },

  // --- document types ----------------------------------------------------
  {
    pattern: '\\.(pdf|docx?|xlsx?)(\\?.*)?$',
    behaviour: 'include',
    docKind: 'reference',
    depth: 3,
    description: 'Direct document links',
  },
  {
    pattern: '/(curriculum|syllabus|academic)/.*\\.(pdf|docx?)',
    behaviour: 'include',
    docKind: 'syllabus',
    depth: 3,
    description: 'Syllabus documents',
  },
  {
    pattern: '(sample[-_ ]?(question[-_ ]?)?paper|sqp)',
    behaviour: 'include',
    docKind: 'sample_paper',
    depth: 3,
    description: 'Sample Question Papers',
  },
  {
    pattern: '(marking[-_ ]?scheme|ms\\b)',
    behaviour: 'include',
    docKind: 'marking_scheme',
    depth: 3,
    description: 'Marking schemes',
  },
  {
    pattern: '(question[-_ ]?paper|previous[-_ ]?year|pyq|board[-_ ]?paper)',
    behaviour: 'include',
    docKind: 'question_paper',
    depth: 3,
    description: 'Board / previous year papers',
  },
  {
    pattern: '(curriculum|syllabus|learning[-_ ]?outcome)',
    behaviour: 'include',
    docKind: 'syllabus',
    depth: 3,
    description: 'Syllabus landing pages',
  },

  // --- never touch -------------------------------------------------------
  {
    pattern: '/(login|signin|captcha|admin|dashboard)/',
    behaviour: 'exclude',
    description: 'Never bypass a login or form',
  },
  {
    pattern: '(results\\.cbse\\.nic\\.in|/results?/)',
    behaviour: 'exclude',
    description: 'Results portal has no academic content',
  },
  {
    pattern: '\\.(jpg|jpeg|png|gif|svg|mp4|zip|rar|exe)(\\?.*)?$',
    behaviour: 'exclude',
    description: 'Binary assets we never need',
  },
]

/** Class labels the adapter understands, mapped onto StudyOS class slugs. */
const CLASS_ALIASES: Record<string, string> = {
  'class x': 'class-10',
  'class 10': 'class-10',
  'x': 'class-10',
  'class xii': 'class-12',
  'class 12': 'class-12',
  'xii': 'class-12',
  'class ix': 'class-9',
  'class 9': 'class-9',
  'class xi': 'class-11',
  'class 11': 'class-11',
}

function resolveClass(label: string): string | undefined {
  const key = label.trim().toLowerCase().replace(/\s+/g, ' ')
  return CLASS_ALIASES[key] ?? CLASS_ALIASES[key.replace(/\.$/, '')]
}

export const cbseAdapter: BoardSourceAdapter = {
  id: 'cbse',
  boardSlug: 'cbse',
  boardName: 'Central Board of Secondary Education',
  label: 'CBSE',
  description:
    'Official CBSE curriculum, Sample Question Papers, marking schemes and previous year board papers.',

  domains: CBSE_DOMAINS,
  baseUrl: 'https://www.cbse.gov.in/',
  defaultSourceType: 'official_board',
  defaultLicense: 'official',
  defaultAccessMethod: 'public',

  urlPatterns: CBSE_PATTERNS,

  resolveSession(html: string, url: string): AdapterSession | null {
    const text = textOf(html)

    /* Anchor text on a listing page is the strongest signal. */
    const linkTexts = extractHrefs(html, url)
      .map((href) => {
        const [, tail] = /([^/]+?)(?:\.pdf)?(?:\?.*)?$/i.exec(href) ?? []
        return tail ?? ''
      })
      .filter((value) => /20\d{2}/.test(value))

    const sessions = linkTexts
      .map((value) => detectSession(value.replace(/[._]+/g, ' '))?.academicSession)
      .filter((value): value is string => Boolean(value))

    const newest = newestSession(sessions)
    if (newest) return { academicSession: newest, confidence: 'confirmed', sessionUrl: url }

    const detected = detectSession(text)
    if (detected) return { ...detected, sessionUrl: url }

    return null
  },

  discoverSyllabusTargets(session: AdapterSession): DiscoveryTarget[] {
    const year = session.academicSession.split('-')[0]
    return [
      {
        url: 'https://www.cbse.gov.in/curriculum.html',
        docKind: 'curriculum',
        depth: 0,
        hint: { session: session.academicSession },
      },
      {
        url: 'https://cbseacademic.nic.in/curriculum.html',
        docKind: 'curriculum',
        depth: 0,
        hint: { session: session.academicSession },
      },
      {
        url: `https://cbseacademic.nic.in/wp-content/uploads/curriculum/${year}/`,
        docKind: 'syllabus',
        depth: 0,
        hint: { session: session.academicSession, year },
      },
      {
        url: 'https://cbseacademic.nic.in/syllabus.html',
        docKind: 'syllabus',
        depth: 0,
        hint: { session: session.academicSession },
      },
    ]
  },

  discoverPaperTargets(session: AdapterSession, filter: PaperFilter = {}): DiscoveryTarget[] {
    const targets: DiscoveryTarget[] = []
    const hint: Record<string, string> = { session: session.academicSession }
    if (filter.className) hint.class = filter.className
    if (filter.subjectName) hint.subject = filter.subjectName
    if (filter.year) hint.year = String(filter.year)

    const seeds: Array<{ url: string; docKind: DocKind }> = [
      { url: 'https://cbseacademic.nic.in/sample-papers.html', docKind: 'sample_paper' },
      { url: 'https://cbseacademic.nic.in/question-papers.html', docKind: 'question_paper' },
      { url: 'https://www.cbse.gov.in/circulars.html', docKind: 'notification' },
    ]

    for (const seed of seeds) {
      if (filter.docKind && filter.docKind !== seed.docKind) continue
      targets.push({ url: seed.url, docKind: seed.docKind, depth: 0, hint })
    }

    return targets
  },

  extractLinks(html: string, url: string, depth: number): DiscoveryTarget[] {
    const targets: DiscoveryTarget[] = []
    const seen = new Set<string>()

    for (const href of extractHrefs(html, url)) {
      if (seen.has(href)) continue
      seen.add(href)

      const docKind = CBSE_PATTERNS.find(
        (pattern) =>
          pattern.behaviour === 'include' &&
          pattern.docKind &&
          new RegExp(pattern.pattern, 'i').test(href),
      )?.docKind

      targets.push({
        url: href,
        docKind: docKind ?? 'other',
        depth: depth + 1,
      })
    }

    return targets
  },

  matches(url: string, depth: number): boolean {
    return matchesPatterns(url, CBSE_PATTERNS, depth)
  },
}

/**
 * Resolve a class label found on a CBSE page into a StudyOS class slug.
 * Exported for the worker's normalisation step and for the admin preview.
 */
export function cbseClassSlug(label: string): string | undefined {
  return resolveClass(label)
}
