import type { SearchCategory, SearchResult } from '@/types'

/** Global search corpus — notes, PYQs, formulas, questions and chapters. */
export const SEARCH_INDEX: SearchResult[] = [
  {
    id: 'sr-1',
    title: "Kirchhoff's Laws",
    category: 'Chapters',
    meta: 'Physics · Current Electricity',
    snippet: 'Junction and loop rules, sign conventions and balanced bridge condition.',
    to: '/library/cbse/class-12/physics/current-electricity',
    subjectId: 'physics',
  },
  {
    id: 'sr-2',
    title: 'Electrochemistry PYQs',
    category: 'PYQs',
    meta: 'Chemistry · 42 questions · 2016–2025',
    snippet: 'Nernst equation numericals, conductance and cell chemistry from board papers.',
    to: '/pyq/chemistry',
    subjectId: 'chemistry',
  },
  {
    id: 'sr-3',
    title: 'Alcohols, Phenols and Ethers',
    category: 'Chapters',
    meta: 'Chemistry · Chapter 07 · 60% done',
    snippet: 'Named reactions, preparation routes and mechanism practice.',
    to: '/library/cbse/class-12/chemistry/alcohols-phenols-and-ethers',
    subjectId: 'chemistry',
  },
  {
    id: 'sr-4',
    title: 'Nernst Equation',
    category: 'Formulas',
    meta: 'Chemistry · Electrochemistry',
    snippet: 'E = E° – (0.059/n) · log Q — appeared 8 times in board papers.',
    to: '/formula-flow',
    subjectId: 'chemistry',
  },
  {
    id: 'sr-5',
    title: 'Electrostatics — Complete Notes',
    category: 'Notes',
    meta: 'Physics · 42 pages',
    snippet: 'Coulomb’s law, fields, potential, Gauss theorem and capacitors.',
    to: '/library/cbse/class-12/physics/electrostatics',
    subjectId: 'physics',
  },
  {
    id: 'sr-6',
    title: 'Energy stored in a capacitor',
    category: 'Formulas',
    meta: 'Physics · Electrostatics',
    snippet: 'U = ½CV² with related forms Q = CV and U = Q²/2C.',
    to: '/formula-flow',
    subjectId: 'physics',
  },
  {
    id: 'sr-7',
    title: 'Integration by Parts — Solved PYQs',
    category: 'Questions',
    meta: 'Mathematics · 18 solved examples',
    snippet: 'ILATE order, definite integrals and the classic eˣ mix questions.',
    to: '/library/cbse/class-12/mathematics/integrals',
    subjectId: 'mathematics',
  },
  {
    id: 'sr-8',
    title: 'Reimer–Tiemann Reaction',
    category: 'Notes',
    meta: 'Chemistry · Alcohols, Phenols and Ethers',
    snippet: 'Ortho-formylation of phenol via dichlorocarbene — mechanism and product.',
    to: '/reaction-lab',
    subjectId: 'chemistry',
  },
  {
    id: 'sr-9',
    title: 'Electromagnetic Induction — PYQ Bank',
    category: 'PYQs',
    meta: 'Physics · 81 questions',
    snippet: 'Faraday and Lenz numericals, AC generator derivations from 2011–2025.',
    to: '/pyq/physics',
    subjectId: 'physics',
  },
  {
    id: 'sr-10',
    title: 'Ohm’s law and resistance',
    category: 'Formulas',
    meta: 'Physics · Current Electricity',
    snippet: 'V = IR, R = ρL/A and the temperature dependence of resistivity.',
    to: '/formula-flow',
    subjectId: 'physics',
  },
  {
    id: 'sr-11',
    title: 'Wave Optics — Quick Revision',
    category: 'Notes',
    meta: 'Physics · 6 pages',
    snippet: 'YDSE fringe width, resolving power and polarisation in one page.',
    to: '/library/cbse/class-12/physics/wave-optics',
    subjectId: 'physics',
  },
  {
    id: 'sr-12',
    title: 'Bayes’ Theorem — Practice Set',
    category: 'Questions',
    meta: 'Mathematics · 12 questions',
    snippet: 'Tree diagrams, total probability and past-year 4-mark questions.',
    to: '/library/cbse/class-12/mathematics/probability',
    subjectId: 'mathematics',
  },
  {
    id: 'sr-13',
    title: 'Coordination Compounds — Important Questions',
    category: 'Questions',
    meta: 'Chemistry · 25 questions',
    snippet: 'IUPAC naming, CFT splitting and magnetic moment calculations.',
    to: '/library/cbse/class-12/chemistry/coordination-compounds',
    subjectId: 'chemistry',
  },
  {
    id: 'sr-14',
    title: 'Semiconductor Devices — Diagram Sheet',
    category: 'Notes',
    meta: 'Physics · Diagrams',
    snippet: 'Zener regulator, common-emitter characteristics and logic gate symbols.',
    to: '/library/cbse/class-12/physics/semiconductor-electronics',
    subjectId: 'physics',
  },
  {
    id: 'sr-15',
    title: 'CBSE 2025 Physics Set 1',
    category: 'PYQs',
    meta: 'Physics · 70 marks · 3 hours',
    snippet: 'Full paper with section-wise marks and detailed solutions.',
    to: '/pyq/physics/2025-cbse-physics-set-1',
    subjectId: 'physics',
  },
  {
    id: 'sr-16',
    title: 'SQL Query Writing',
    category: 'Notes',
    meta: 'Computer Science · Database Concepts',
    snippet: 'DDL, DML, aggregate functions and joins with Python connectors.',
    to: '/library/cbse/class-12/computer-science/database-concepts-and-sql',
    subjectId: 'computer-science',
  },
]

export const SEARCH_CATEGORIES: SearchCategory[] = [
  'All',
  'Notes',
  'PYQs',
  'Formulas',
  'Questions',
  'Chapters',
]

/** Case-insensitive multi-token search with category filtering. */
export function searchIndex(query: string, category: SearchCategory = 'All'): SearchResult[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const scoped = category === 'All' ? SEARCH_INDEX : SEARCH_INDEX.filter((item) => item.category === category)
  if (!tokens.length) return scoped
  return scoped.filter((item) => {
    const haystack = `${item.title} ${item.meta} ${item.snippet} ${item.category}`.toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
}
