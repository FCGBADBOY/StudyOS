/**
 * WBCHSE (West Bengal Council of Higher Secondary Education) adapter.
 *
 * Config-only, exactly like every other board: domains, seeds, patterns.
 */
import { createAdapter, UNIVERSAL_EXCLUDES } from '../factory'
import type { UrlPattern } from '../base-source'

const PATTERNS: UrlPattern[] = [
  {
    pattern: '^https?://(www\\.)?(wbchse\\.nic\\.in|wbchse\\.wikipedia\\.org)/',
    behaviour: 'include',
    depth: 0,
    description: 'Approved WBCHSE properties',
  },
  {
    pattern: '(syllabus|curriculum|course[-_ ]?of[-_ ]?study)',
    behaviour: 'include',
    docKind: 'syllabus',
    depth: 3,
    description: 'Syllabus pages',
  },
  {
    pattern: '(sample[-_ ]?paper|specimen)',
    behaviour: 'include',
    docKind: 'sample_paper',
    depth: 3,
    description: 'Sample papers',
  },
  {
    pattern: '(question[-_ ]?paper|previous[-_ ]?year|old[-_ ]?question)',
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

export const wbchseAdapter = createAdapter({
  id: 'wbchse',
  boardSlug: 'wbchse',
  boardName: 'West Bengal Council of Higher Secondary Education',
  label: 'WBCHSE',
  description: 'WBCHSE Higher Secondary syllabus, sample papers and previous year papers.',
  domains: ['wbchse.nic.in'],
  baseUrl: 'https://wbchse.nic.in/',
  defaultSourceType: 'official_board',
  defaultLicense: 'official',
  urlPatterns: PATTERNS,
  syllabusSeeds: [{ url: 'https://wbchse.nic.in/syllabus.html', docKind: 'syllabus' }],
  paperSeeds: [
    { url: 'https://wbchse.nic.in/sample-paper.html', docKind: 'sample_paper' },
    { url: 'https://wbchse.nic.in/question-paper.html', docKind: 'question_paper' },
  ],
})
