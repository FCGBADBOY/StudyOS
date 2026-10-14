/**
 * ISC (Council for the Indian School Certificate Examinations, Class 12)
 * adapter — configuration, not a bespoke scraper.
 */
import { createAdapter, UNIVERSAL_EXCLUDES } from '../factory'
import type { UrlPattern } from '../base-source'

const PATTERNS: UrlPattern[] = [
  {
    pattern: '^https?://(www\\.)?(cisce\\.org|icseonline\\.in)/',
    behaviour: 'include',
    depth: 0,
    description: 'Approved CISCE properties',
  },
  {
    pattern: '(curriculum|syllabus|regulation)',
    behaviour: 'include',
    docKind: 'syllabus',
    depth: 3,
    description: 'Curriculum & syllabus pages',
  },
  {
    pattern: '(specimen|sample[-_ ]?paper)',
    behaviour: 'include',
    docKind: 'sample_paper',
    depth: 3,
    description: 'Specimen / sample papers',
  },
  {
    pattern: '(question[-_ ]?paper|previous[-_ ]?year)',
    behaviour: 'include',
    docKind: 'question_paper',
    depth: 3,
    description: 'Previous year papers',
  },
  {
    pattern: '\\.(pdf|docx?)(\\?.*)?$',
    behaviour: 'include',
    docKind: 'reference',
    depth: 3,
    description: 'Direct documents',
  },
  ...UNIVERSAL_EXCLUDES,
]

export const iscAdapter = createAdapter({
  id: 'isc',
  boardSlug: 'isc',
  boardName: 'Council for the Indian School Certificate Examinations (ISC)',
  label: 'ISC',
  description: 'ISC (Class 12) curriculum, specimen papers and previous year papers.',
  domains: ['cisce.org', 'icseonline.in'],
  baseUrl: 'https://www.cisce.org/',
  defaultSourceType: 'official_board',
  defaultLicense: 'official',
  urlPatterns: PATTERNS,
  syllabusSeeds: [{ url: 'https://www.cisce.org/curriculum-isc.html', docKind: 'curriculum' }],
  paperSeeds: [
    { url: 'https://www.cisce.org/specimen-papers-isc.html', docKind: 'sample_paper' },
    { url: 'https://www.cisce.org/question-papers-isc.html', docKind: 'question_paper' },
  ],
})
