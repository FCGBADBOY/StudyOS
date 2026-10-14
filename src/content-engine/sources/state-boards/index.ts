/**
 * State board adapters.
 *
 * One small configuration block per board, all sharing the factory — this is
 * what "multi-board architecture" is supposed to look like (spec §6): adding
 * a board is data, never a new `if` somewhere in the app.
 *
 * Every block is *disabled until an admin enables a matching row in
 * `source_registry`*, and each only ever reaches its own official domain.
 */
import { createAdapter, UNIVERSAL_EXCLUDES } from '../factory'
import type { BoardSourceAdapter, UrlPattern } from '../base-source'

interface StateBoardConfig {
  id: string
  boardSlug: string
  boardName: string
  label: string
  description: string
  domains: string[]
  baseUrl: string
  syllabusUrl: string
  samplePaperUrl?: string
  questionPaperUrl?: string
}

function patternsFor(host: string): UrlPattern[] {
  return [
    { pattern: `^https?://(www\\.)?${host}/`, behaviour: 'include', depth: 0, description: 'Official board site' },
    { pattern: '(syllabus|curriculum)', behaviour: 'include', docKind: 'syllabus', depth: 3, description: 'Syllabus' },
    { pattern: '(sample[-_ ]?paper|model[-_ ]?paper)', behaviour: 'include', docKind: 'sample_paper', depth: 3, description: 'Model papers' },
    { pattern: '(question[-_ ]?paper|previous[-_ ]?year)', behaviour: 'include', docKind: 'question_paper', depth: 3, description: 'Previous papers' },
    { pattern: '\\.(pdf|docx?)(\\?.*)?$', behaviour: 'include', docKind: 'reference', depth: 3, description: 'Direct documents' },
    ...UNIVERSAL_EXCLUDES,
  ]
}

function build(config: StateBoardConfig): BoardSourceAdapter {
  const host = config.domains[0]
  const seeds: Array<{ url: string; docKind: 'syllabus' | 'sample_paper' | 'question_paper' }> = [
    { url: config.syllabusUrl, docKind: 'syllabus' },
  ]
  if (config.samplePaperUrl) seeds.push({ url: config.samplePaperUrl, docKind: 'sample_paper' })
  if (config.questionPaperUrl) seeds.push({ url: config.questionPaperUrl, docKind: 'question_paper' })

  return createAdapter({
    id: config.id,
    boardSlug: config.boardSlug,
    boardName: config.boardName,
    label: config.label,
    description: config.description,
    domains: config.domains,
    baseUrl: config.baseUrl,
    defaultSourceType: 'official_board',
    defaultLicense: 'official',
    urlPatterns: patternsFor(host.replace(/\./g, '\\.')),
    syllabusSeeds: [{ url: config.syllabusUrl, docKind: 'syllabus' }],
    paperSeeds: seeds.filter((seed) => seed.docKind !== 'syllabus'),
  })
}

export const maharashtraAdapter = build({
  id: 'maharashtra',
  boardSlug: 'maharashtra',
  boardName: 'Maharashtra State Board of Secondary and Higher Secondary Education',
  label: 'Maharashtra',
  description: 'Maharashtra State Board syllabus, model papers and previous papers.',
  domains: ['mahahboard.org'],
  baseUrl: 'https://www.mahahboard.org/',
  syllabusUrl: 'https://www.mahahboard.org/syllabus.html',
  samplePaperUrl: 'https://www.mahahboard.org/model-paper.html',
  questionPaperUrl: 'https://www.mahahboard.org/question-paper.html',
})

export const upBoardAdapter = build({
  id: 'up-board',
  boardSlug: 'up-board',
  boardName: 'Uttar Pradesh Madhyamik Shiksha Parishad',
  label: 'UP Board',
  description: 'UP Board syllabus, model papers and previous papers.',
  domains: ['upmsp.edu.in'],
  baseUrl: 'https://upmsp.edu.in/',
  syllabusUrl: 'https://upmsp.edu.in/Syllabus.html',
  samplePaperUrl: 'https://upmsp.edu.in/Model-Paper.html',
  questionPaperUrl: 'https://upmsp.edu.in/Previous-Papers.html',
})

export const biharBoardAdapter = build({
  id: 'bihar-board',
  boardSlug: 'bihar-board',
  boardName: 'Bihar School Examination Board',
  label: 'Bihar Board',
  description: 'Bihar Board syllabus, model papers and previous papers.',
  domains: ['biharboardonline.bihar.gov.in', 'bselk.com'],
  baseUrl: 'https://biharboardonline.bihar.gov.in/',
  syllabusUrl: 'https://biharboardonline.bihar.gov.in/syllabus.html',
  questionPaperUrl: 'https://biharboardonline.bihar.gov.in/previous-papers.html',
})

export const tamilNaduAdapter = build({
  id: 'tamil-nadu',
  boardSlug: 'tamil-nadu',
  boardName: 'Tamil Nadu Board of Secondary Education',
  label: 'Tamil Nadu',
  description: 'Tamil Nadu State Board syllabus and previous papers.',
  domains: ['dge.tn.gov.in', 'tnschools.gov.in'],
  baseUrl: 'https://dge.tn.gov.in/',
  syllabusUrl: 'https://dge.tn.gov.in/syllabus.html',
  questionPaperUrl: 'https://dge.tn.gov.in/previous-papers.html',
})

export const karnatakaAdapter = build({
  id: 'karnataka',
  boardSlug: 'karnataka',
  boardName: 'Department of Pre-University Education, Karnataka',
  label: 'Karnataka',
  description: 'Karnataka PUE syllabus, model papers and previous papers.',
  domains: ['kar.nic.in', 'pue.karnataka.gov.in'],
  baseUrl: 'https://pue.karnataka.gov.in/',
  syllabusUrl: 'https://pue.karnataka.gov.in/syllabus.html',
  samplePaperUrl: 'https://pue.karnataka.gov.in/model-paper.html',
})

export const keralaAdapter = build({
  id: 'kerala',
  boardSlug: 'kerala',
  boardName: 'General Education Department, Government of Kerala',
  label: 'Kerala',
  description: 'Kerala State Board syllabus and previous papers.',
  domains: ['pareekshabhavan.kerala.gov.in', 'scert.kerala.gov.in'],
  baseUrl: 'https://pareekshabhavan.kerala.gov.in/',
  syllabusUrl: 'https://scert.kerala.gov.in/syllabus.html',
  questionPaperUrl: 'https://pareekshabhavan.kerala.gov.in/previous-papers.html',
})

/** Every state-board adapter the engine knows about today. */
export const STATE_BOARD_ADAPTERS: BoardSourceAdapter[] = [
  maharashtraAdapter,
  upBoardAdapter,
  biharBoardAdapter,
  tamilNaduAdapter,
  karnatakaAdapter,
  keralaAdapter,
]
