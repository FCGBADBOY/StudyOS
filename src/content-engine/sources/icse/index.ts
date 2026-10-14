/**
 * ICSE (Council for the Indian School Certificate Examinations, Class 10)
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

export const icseAdapter = createAdapter({
  id: 'icse',
  boardSlug: 'icse',
  boardName: 'Council for the Indian School Certificate Examinations',
  label: 'ICSE',
  description: 'ICSE (Class 10) curriculum, specimen papers and previous year papers.',
  domains: ['cisce.org', 'icseonline.in'],
  baseUrl: 'https://www.cisce.org/',
  defaultSourceType: 'official_board',
  defaultLicense: 'official',
  urlPatterns: PATTERNS,
  syllabusSeeds: [{ url: 'https://www.cisce.org/curriculum.html', docKind: 'curriculum' }],
  paperSeeds: [
    { url: 'https://www.cisce.org/specimen-papers.html', docKind: 'sample_paper' },
    { url: 'https://www.cisce.org/question-papers.html', docKind: 'question_paper' },
  ],
})
