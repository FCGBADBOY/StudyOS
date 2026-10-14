/**
 * Adapter factory — the default behaviour every board shares.
 *
 * A new board adapter is mostly configuration: domains, seeds and patterns.
 * Anything genuinely board-specific (session detection quirks, a proprietary
 * listing layout) overrides the returned object. This keeps each adapter file
 * small enough to read and review, which matters because these declarations
 * are what stand between StudyOS and an uncontrolled crawler.
 */
import {
  detectSession,
  extractHrefs,
  matchesPatterns,
  textOf,
  type AdapterSession,
  type BoardSourceAdapter,
  type DiscoveryTarget,
  type PaperFilter,
  type UrlPattern,
} from './base-source'
import type { AccessMethod, DocKind, LicenseStatus, SourceType } from '../types'

export interface AdapterConfig {
  id: string
  boardSlug: string
  boardName: string
  label: string
  description: string
  domains: string[]
  baseUrl: string
  defaultSourceType: SourceType
  defaultLicense: LicenseStatus
  defaultAccessMethod?: AccessMethod
  urlPatterns: UrlPattern[]
  /** Seed pages for syllabus discovery. */
  syllabusSeeds: Array<{ url: string; docKind: DocKind }>
  /** Seed pages for question papers / sample papers. */
  paperSeeds: Array<{ url: string; docKind: DocKind }>
  /** Override when a board's session text needs custom parsing. */
  parseSession?: (text: string, url: string) => AdapterSession | null
}

export function createAdapter(config: AdapterConfig): BoardSourceAdapter {
  const adapter: BoardSourceAdapter = {
    id: config.id,
    boardSlug: config.boardSlug,
    boardName: config.boardName,
    label: config.label,
    description: config.description,
    domains: config.domains,
    baseUrl: config.baseUrl,
    defaultSourceType: config.defaultSourceType,
    defaultLicense: config.defaultLicense,
    defaultAccessMethod: config.defaultAccessMethod ?? 'public',
    urlPatterns: config.urlPatterns,

    resolveSession(html: string, url: string): AdapterSession | null {
      if (config.parseSession) {
        const custom = config.parseSession(textOf(html), url)
        if (custom) return custom
      }
      const detected = detectSession(textOf(html))
      return detected ? { ...detected, sessionUrl: url } : null
    },

    discoverSyllabusTargets(session: AdapterSession): DiscoveryTarget[] {
      return config.syllabusSeeds.map((seed) => ({
        url: seed.url,
        docKind: seed.docKind,
        depth: 0,
        hint: { session: session.academicSession },
      }))
    },

    discoverPaperTargets(session: AdapterSession, filter: PaperFilter = {}): DiscoveryTarget[] {
      return config.paperSeeds
        .filter((seed) => !filter.docKind || filter.docKind === seed.docKind)
        .map((seed) => ({
          url: seed.url,
          docKind: seed.docKind,
          depth: 0,
          hint: {
            session: session.academicSession,
            ...(filter.className ? { class: filter.className } : {}),
            ...(filter.subjectName ? { subject: filter.subjectName } : {}),
            ...(filter.year ? { year: String(filter.year) } : {}),
          },
        }))
    },

    extractLinks(html: string, url: string, depth: number): DiscoveryTarget[] {
      const seen = new Set<string>()
      const targets: DiscoveryTarget[] = []

      for (const href of extractHrefs(html, url)) {
        if (seen.has(href)) continue
        seen.add(href)

        const docKind =
          config.urlPatterns.find(
            (pattern) =>
              pattern.behaviour === 'include' &&
              pattern.docKind &&
              new RegExp(pattern.pattern, 'i').test(href),
          )?.docKind ?? 'other'

        targets.push({ url: href, docKind, depth: depth + 1 })
      }

      return targets
    },

    matches(url: string, depth: number): boolean {
      return matchesPatterns(url, config.urlPatterns, depth)
    },
  }

  return adapter
}

/** Common `exclude` rules every adapter inherits: never touch gated areas. */
export const UNIVERSAL_EXCLUDES: UrlPattern[] = [
  { pattern: '/(login|signin|signup|captcha|otp)/', behaviour: 'exclude', description: 'Never bypass a login' },
  { pattern: '\\.(jpg|jpeg|png|gif|svg|mp4|zip|rar|exe)(\\?.*)?$', behaviour: 'exclude', description: 'Binary assets' },
]
