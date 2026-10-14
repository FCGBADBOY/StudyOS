/**
 * Generic open-source adapter.
 *
 * For approved open-educational repositories (NCERT, OER mirrors, open
 * archives) whose material is explicitly reusable. Because the licence claim
 * comes from the *registry row* rather than from the site's own marketing, this
 * adapter is deliberately conservative:
 *
 *   - seeds must be listed in `source_registry` before anything is fetched;
 *   - `defaultLicense` is `unknown`, so `decideStorage()` returns
 *     `metadata_only` until an admin verifies the licence;
 *   - it never follows a link to a domain that is not itself approved.
 */
import { createAdapter, UNIVERSAL_EXCLUDES } from '../factory'
import type { UrlPattern } from '../base-source'

const PATTERNS: UrlPattern[] = [
  { pattern: '^https?://(www\\.)?ncert\\.nic\\.in/', behaviour: 'include', depth: 0, description: 'NCERT' },
  { pattern: '(syllabus|curriculum|textbook)', behaviour: 'include', docKind: 'syllabus', depth: 3, description: 'Syllabus / textbook listings' },
  { pattern: '(sample[-_ ]?paper|worksheet)', behaviour: 'include', docKind: 'sample_paper', depth: 3, description: 'Worksheets & sample papers' },
  { pattern: '(question[-_ ]?paper|previous[-_ ]?year)', behaviour: 'include', docKind: 'question_paper', depth: 3, description: 'Question papers' },
  { pattern: '\\.(pdf|docx?)(\\?.*)?$', behaviour: 'include', docKind: 'reference', depth: 3, description: 'Direct documents' },
  ...UNIVERSAL_EXCLUDES,
]

export const genericOpenSourceAdapter = createAdapter({
  id: 'generic-open-source',
  boardSlug: 'generic',
  boardName: 'Approved open educational repositories',
  label: 'Open sources',
  description:
    'Approved open-educational repositories. Files are only stored once an admin has verified the licence; otherwise StudyOS keeps a link.',
  domains: ['ncert.nic.in'],
  baseUrl: 'https://ncert.nic.in/',
  defaultSourceType: 'open_educational',
  /* Deliberately `unknown`: the registry row is what upgrades this. */
  defaultLicense: 'unknown',
  urlPatterns: PATTERNS,
  syllabusSeeds: [{ url: 'https://ncert.nic.in/textbook.php', docKind: 'syllabus' }],
  paperSeeds: [{ url: 'https://ncert.nic.in/question-paper.php', docKind: 'question_paper' }],
})
