import type {
  ConceptFrequency,
  PyqDifficultySlice,
  PyqOverview,
  PyqPaper,
  PyqQuestion,
  PyqSubjectStat,
} from '@/types'

/* ------------------------------- questions -------------------------------- */

export const PYQ_QUESTIONS: PyqQuestion[] = [
  {
    id: 'pyq-phy-1',
    question:
      'State Kirchhoff’s laws of electrical circuits. Derive the condition for a balanced Wheatstone bridge.',
    year: 2023,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'current-electricity',
    chapter: 'Current Electricity',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ["Kirchhoff's Laws", 'Wheatstone Bridge'],
    repeated: true,
  },
  {
    id: 'pyq-phy-2',
    question:
      'A uniform wire of resistance 16 Ω is stretched to twice its original length. Calculate its new resistance.',
    year: 2022,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'current-electricity',
    chapter: 'Current Electricity',
    marks: 2,
    difficulty: 'Easy',
    type: 'VSA',
    concepts: ['Resistance and resistivity'],
    repeated: false,
  },
  {
    id: 'pyq-phy-3',
    question:
      'Derive an expression for the instantaneous emf induced in a rectangular coil rotating in a uniform magnetic field.',
    year: 2024,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'electromagnetic-induction',
    chapter: 'Electromagnetic Induction',
    marks: 5,
    difficulty: 'Hard',
    type: 'LA',
    concepts: ['Faraday’s law', 'Motional emf'],
    repeated: true,
  },
  {
    id: 'pyq-phy-4',
    question:
      'Describe the working of an LCR series circuit with a labelled phasor diagram. Define resonant frequency.',
    year: 2023,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'alternating-current',
    chapter: 'Alternating Current',
    marks: 5,
    difficulty: 'Hard',
    type: 'LA',
    concepts: ['LCR resonance', 'Power factor'],
    repeated: true,
  },
  {
    id: 'pyq-phy-5',
    question:
      'Define electric potential due to a system of charges. Derive an expression for the potential at a point due to a point charge.',
    year: 2021,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'electrostatics',
    chapter: 'Electrostatics',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Electric potential'],
    repeated: false,
  },
  {
    id: 'pyq-phy-6',
    question:
      'Using Bohr’s model, derive the expression for the radius of the nth orbit of the hydrogen atom and state the quantisation condition.',
    year: 2024,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'atoms',
    chapter: 'Atoms',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Bohr model', 'Hydrogen spectrum'],
    repeated: true,
  },
  {
    id: 'pyq-phy-7',
    question:
      'Explain how the photoelectric effect establishes the particle nature of light. Draw the variation of stopping potential with frequency.',
    year: 2025,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'dual-nature-of-radiation-and-matter',
    chapter: 'Dual Nature of Radiation and Matter',
    marks: 5,
    difficulty: 'Hard',
    type: 'Case-based',
    concepts: ['Photoelectric effect', 'Work function'],
    repeated: true,
  },
  {
    id: 'pyq-phy-8',
    question:
      'A convex lens of focal length 20 cm forms a real image twice the size of the object. Find the object distance.',
    year: 2022,
    board: 'CBSE',
    subjectId: 'physics',
    chapterSlug: 'ray-optics',
    chapter: 'Ray Optics',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Lens formula', 'Magnification'],
    repeated: false,
  },
  {
    id: 'pyq-chem-1',
    question:
      'State the Nernst equation. Calculate the emf of the cell Zn | Zn²⁺ (0.1 M) ‖ Cu²⁺ (0.01 M) | Cu at 298 K.',
    year: 2024,
    board: 'CBSE',
    subjectId: 'chemistry',
    chapterSlug: 'electrochemistry',
    chapter: 'Electrochemistry',
    marks: 5,
    difficulty: 'Hard',
    type: 'LA',
    concepts: ['Nernst Equation', 'Electrochemical cells'],
    repeated: true,
  },
  {
    id: 'pyq-chem-2',
    question:
      'Explain the Reimer–Tiemann reaction. Write the balanced equation for the conversion of phenol to salicylaldehyde.',
    year: 2023,
    board: 'CBSE',
    subjectId: 'chemistry',
    chapterSlug: 'alcohols-phenols-and-ethers',
    chapter: 'Alcohols, Phenols and Ethers',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Reimer–Tiemann Reaction'],
    repeated: true,
  },
  {
    id: 'pyq-chem-3',
    question:
      'For the reaction 2N₂O₅ → 4NO₂ + O₂, the rate law is found to be rate = k[N₂O₅]. Determine the order and half-life expression.',
    year: 2022,
    board: 'CBSE',
    subjectId: 'chemistry',
    chapterSlug: 'chemical-kinetics',
    chapter: 'Chemical Kinetics',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Order of reaction', 'Half-life'],
    repeated: false,
  },
  {
    id: 'pyq-chem-4',
    question:
      'Why do transition elements exhibit variable oxidation states? Explain with suitable examples and the role of (n–1)d electrons.',
    year: 2025,
    board: 'CBSE',
    subjectId: 'chemistry',
    chapterSlug: 'the-d-and-f-block-elements',
    chapter: 'The d and f Block Elements',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Variable oxidation states'],
    repeated: true,
  },
  {
    id: 'pyq-chem-5',
    question:
      'Describe the aldol condensation reaction. Why does acetaldehyde undergo it while formaldehyde does not?',
    year: 2024,
    board: 'CBSE',
    subjectId: 'chemistry',
    chapterSlug: 'aldehydes-ketones-and-carboxylic-acids',
    chapter: 'Aldehydes, Ketones and Carboxylic Acids',
    marks: 5,
    difficulty: 'Hard',
    type: 'LA',
    concepts: ['Aldol condensation', 'α-hydrogen'],
    repeated: true,
  },
  {
    id: 'pyq-chem-6',
    question:
      'Define osmotic pressure and derive the van’t Hoff relation πV = nRT for a dilute solution.',
    year: 2021,
    board: 'CBSE',
    subjectId: 'chemistry',
    chapterSlug: 'solutions',
    chapter: 'Solutions',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Colligative properties', 'Osmotic pressure'],
    repeated: false,
  },
  {
    id: 'pyq-math-1',
    question:
      'Using properties of determinants, prove that the determinant of the given 3 × 3 matrix equals zero when two rows are proportional.',
    year: 2023,
    board: 'CBSE',
    subjectId: 'mathematics',
    chapterSlug: 'determinants',
    chapter: 'Determinants',
    marks: 4,
    difficulty: 'Medium',
    type: 'LA',
    concepts: ['Properties of determinants'],
    repeated: true,
  },
  {
    id: 'pyq-math-2',
    question:
      'Evaluate the definite integral of x·sin x from 0 to π using integration by parts and interpret the result geometrically.',
    year: 2024,
    board: 'CBSE',
    subjectId: 'mathematics',
    chapterSlug: 'integrals',
    chapter: 'Integrals',
    marks: 4,
    difficulty: 'Hard',
    type: 'LA',
    concepts: ['Integration by parts', 'Definite integrals'],
    repeated: true,
  },
  {
    id: 'pyq-math-3',
    question:
      'Find the interval in which f(x) = x³ – 3x² + 4 is strictly increasing. Also find the points of local extrema.',
    year: 2025,
    board: 'CBSE',
    subjectId: 'mathematics',
    chapterSlug: 'application-of-derivatives',
    chapter: 'Application of Derivatives',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Monotonicity', 'Maxima and minima'],
    repeated: true,
  },
  {
    id: 'pyq-math-4',
    question:
      'A shopkeeper mixes two varieties of tea. Formulate the linear programming problem and solve it graphically for maximum profit.',
    year: 2022,
    board: 'CBSE',
    subjectId: 'mathematics',
    chapterSlug: 'linear-programming',
    chapter: 'Linear Programming',
    marks: 5,
    difficulty: 'Easy',
    type: 'LA',
    concepts: ['Feasible region', 'Objective function'],
    repeated: false,
  },
  {
    id: 'pyq-math-5',
    question:
      'Bag A contains 3 red and 5 black balls, bag B contains 4 red and 4 black balls. A ball is drawn at random from a bag chosen at random. Use Bayes’ theorem to find the probability it came from bag A.',
    year: 2023,
    board: 'CBSE',
    subjectId: 'mathematics',
    chapterSlug: 'probability',
    chapter: 'Probability',
    marks: 4,
    difficulty: 'Hard',
    type: 'SA',
    concepts: ['Bayes’ theorem', 'Total probability'],
    repeated: true,
  },
  {
    id: 'pyq-eng-1',
    question:
      'Justify the title “Lost Spring”. Answer in about 120–150 words with reference to the plight of bangle makers.',
    year: 2024,
    board: 'CBSE',
    subjectId: 'english',
    chapterSlug: 'lost-spring',
    chapter: 'Lost Spring',
    marks: 5,
    difficulty: 'Medium',
    type: 'LA',
    concepts: ['Theme and title'],
    repeated: true,
  },
  {
    id: 'pyq-eng-2',
    question:
      'Read the extract and answer: Why did M. Hamel call French “the most beautiful language in the world”?',
    year: 2023,
    board: 'CBSE',
    subjectId: 'english',
    chapterSlug: 'the-last-lesson',
    chapter: 'The Last Lesson',
    marks: 3,
    difficulty: 'Easy',
    type: 'SA',
    concepts: ['Extract questions', 'Language and identity'],
    repeated: false,
  },
  {
    id: 'pyq-cs-1',
    question:
      'Write a Python function using recursion that returns the nth term of the sequence: 1, 1, 2, 3, 5, 8 … Include the base case.',
    year: 2024,
    board: 'CBSE',
    subjectId: 'computer-science',
    chapterSlug: 'python-revision-tour-and-functions',
    chapter: 'Python Revision Tour and Functions',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Recursion'],
    repeated: false,
  },
  {
    id: 'pyq-cs-2',
    question:
      'Write SQL queries to: (a) create a table Student(roll INT, name TEXT, marks INT) (b) list students scoring above 75 grouped by class.',
    year: 2025,
    board: 'CBSE',
    subjectId: 'computer-science',
    chapterSlug: 'database-concepts-and-sql',
    chapter: 'Database Concepts and SQL',
    marks: 4,
    difficulty: 'Easy',
    type: 'SA',
    concepts: ['SQL DDL and DML'],
    repeated: true,
  },
  {
    id: 'pyq-cs-3',
    question:
      'Differentiate between a stack and a queue. Write push and pop operations for a stack implemented with a list.',
    year: 2022,
    board: 'CBSE',
    subjectId: 'computer-science',
    chapterSlug: 'data-structures-stack-and-queue',
    chapter: 'Data Structures — Stack and Queue',
    marks: 3,
    difficulty: 'Medium',
    type: 'SA',
    concepts: ['Stack operations'],
    repeated: false,
  },
]

/* ---------------------------- concept frequency --------------------------- */

export const CONCEPT_FREQUENCY: ConceptFrequency[] = [
  {
    id: 'concept-nernst',
    title: 'Nernst Equation',
    subjectId: 'chemistry',
    chapter: 'Electrochemistry',
    appearances: 8,
    priority: 'HIGH PRIORITY',
    years: [2016, 2018, 2019, 2021, 2022, 2023, 2024, 2025],
    marks: 5,
    difficulty: 'Hard',
    trend: [1, 0, 1, 1, 1, 1, 2, 1],
  },
  {
    id: 'concept-kirchhoff',
    title: "Kirchhoff's Laws",
    subjectId: 'physics',
    chapter: 'Current Electricity',
    appearances: 6,
    priority: 'HIGH PRIORITY',
    years: [2017, 2019, 2020, 2022, 2023, 2025],
    marks: 3,
    difficulty: 'Medium',
    trend: [1, 1, 0, 1, 1, 0, 1, 1],
  },
  {
    id: 'concept-integration-parts',
    title: 'Integration by Parts',
    subjectId: 'mathematics',
    chapter: 'Integrals',
    appearances: 7,
    priority: 'HIGH PRIORITY',
    years: [2016, 2018, 2020, 2021, 2023, 2024, 2025],
    marks: 4,
    difficulty: 'Hard',
    trend: [1, 1, 1, 0, 1, 1, 1, 1],
  },
  {
    id: 'concept-aldol',
    title: 'Aldol Condensation',
    subjectId: 'chemistry',
    chapter: 'Aldehydes, Ketones and Carboxylic Acids',
    appearances: 5,
    priority: 'HIGH PRIORITY',
    years: [2018, 2020, 2022, 2024, 2025],
    marks: 3,
    difficulty: 'Hard',
    trend: [0, 1, 1, 0, 1, 1, 1, 0],
  },
  {
    id: 'concept-photoelectric',
    title: 'Photoelectric Effect',
    subjectId: 'physics',
    chapter: 'Dual Nature of Radiation and Matter',
    appearances: 5,
    priority: 'MEDIUM PRIORITY',
    years: [2017, 2019, 2021, 2023, 2025],
    marks: 3,
    difficulty: 'Medium',
    trend: [1, 1, 0, 1, 0, 1, 1, 0],
  },
  {
    id: 'concept-bayes',
    title: 'Bayes’ Theorem',
    subjectId: 'mathematics',
    chapter: 'Probability',
    appearances: 5,
    priority: 'MEDIUM PRIORITY',
    years: [2016, 2019, 2021, 2023, 2024],
    marks: 4,
    difficulty: 'Hard',
    trend: [1, 1, 1, 1, 1, 0, 1, 0],
  },
  {
    id: 'concept-reimer',
    title: 'Reimer–Tiemann Reaction',
    subjectId: 'chemistry',
    chapter: 'Alcohols, Phenols and Ethers',
    appearances: 6,
    priority: 'HIGH PRIORITY',
    years: [2017, 2019, 2021, 2022, 2024, 2025],
    marks: 3,
    difficulty: 'Medium',
    trend: [1, 1, 1, 1, 0, 1, 1, 1],
  },
  {
    id: 'concept-sql',
    title: 'SQL Query Writing',
    subjectId: 'computer-science',
    chapter: 'Database Concepts and SQL',
    appearances: 4,
    priority: 'MEDIUM PRIORITY',
    years: [2019, 2021, 2023, 2025],
    marks: 4,
    difficulty: 'Easy',
    trend: [0, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: 'concept-polarisation',
    title: 'Polarisation of Light',
    subjectId: 'physics',
    chapter: 'Wave Optics',
    appearances: 3,
    priority: 'LOW PRIORITY',
    years: [2018, 2020, 2024],
    marks: 2,
    difficulty: 'Medium',
    trend: [1, 1, 0, 0, 1, 0, 1, 0],
  },
]

/* -------------------------------- overview -------------------------------- */

const DIFFICULTY: PyqDifficultySlice[] = [
  { label: 'Easy', value: 24 },
  { label: 'Medium', value: 51 },
  { label: 'Hard', value: 25 },
]

const SUBJECT_STATS: PyqSubjectStat[] = [
  { subjectId: 'physics', subjectName: 'Physics', questions: 4280, chaptersCovered: 12, repeatRate: 46 },
  { subjectId: 'chemistry', subjectName: 'Chemistry', questions: 3960, chaptersCovered: 10, repeatRate: 52 },
  { subjectId: 'mathematics', subjectName: 'Mathematics', questions: 5120, chaptersCovered: 13, repeatRate: 38 },
  { subjectId: 'english', subjectName: 'English', questions: 2740, chaptersCovered: 8, repeatRate: 34 },
  { subjectId: 'computer-science', subjectName: 'Computer Science', questions: 2542, chaptersCovered: 8, repeatRate: 29 },
]

export const PYQ_OVERVIEW: PyqOverview = {
  questionsAnalyzed: 18642,
  papersScanned: 412,
  yearsCovered: 15,
  repeatRate: 42,
  topConcepts: CONCEPT_FREQUENCY,
  frequentChapters: [
    { chapter: 'Electrochemistry', subjectId: 'chemistry', count: 142 },
    { chapter: 'Integrals', subjectId: 'mathematics', count: 128 },
    { chapter: 'Current Electricity', subjectId: 'physics', count: 116 },
    { chapter: 'Alcohols, Phenols and Ethers', subjectId: 'chemistry', count: 104 },
    { chapter: 'Continuity and Differentiability', subjectId: 'mathematics', count: 98 },
    { chapter: 'Electromagnetic Induction', subjectId: 'physics', count: 91 },
  ],
  difficulty: DIFFICULTY,
  subjectStats: SUBJECT_STATS,
}

/* --------------------------------- papers --------------------------------- */

export const PYQ_PAPERS: PyqPaper[] = [
  {
    id: 'paper-phy-2025-1',
    slug: '2025-cbse-physics-set-1',
    year: 2025,
    board: 'CBSE',
    classId: 'class-12',
    subjectId: 'physics',
    subjectName: 'Physics',
    set: 'Set 1',
    duration: '3 hours',
    marks: 70,
    sections: [
      { name: 'Section A', questions: '1 – 18 (MCQ)', marks: '1 mark each' },
      { name: 'Section B', questions: '19 – 27', marks: '2 marks each' },
      { name: 'Section C', questions: '28 – 34', marks: '3 marks each' },
      { name: 'Section D', questions: '35 – 36 (Case)', marks: '4 marks each' },
      { name: 'Section E', questions: '37 – 39', marks: '5 marks each' },
    ],
    questions: PYQ_QUESTIONS.filter((question) => question.subjectId === 'physics').slice(0, 6),
  },
  {
    id: 'paper-chem-2025-1',
    slug: '2025-cbse-chemistry-set-1',
    year: 2025,
    board: 'CBSE',
    classId: 'class-12',
    subjectId: 'chemistry',
    subjectName: 'Chemistry',
    set: 'Set 1',
    duration: '3 hours',
    marks: 70,
    sections: [
      { name: 'Section A', questions: '1 – 18 (MCQ)', marks: '1 mark each' },
      { name: 'Section B', questions: '19 – 27', marks: '2 marks each' },
      { name: 'Section C', questions: '28 – 34', marks: '3 marks each' },
      { name: 'Section D', questions: '35 – 36 (Case)', marks: '4 marks each' },
      { name: 'Section E', questions: '37 – 39', marks: '5 marks each' },
    ],
    questions: PYQ_QUESTIONS.filter((question) => question.subjectId === 'chemistry').slice(0, 6),
  },
  {
    id: 'paper-math-2024-2',
    slug: '2024-cbse-mathematics-set-2',
    year: 2024,
    board: 'CBSE',
    classId: 'class-12',
    subjectId: 'mathematics',
    subjectName: 'Mathematics',
    set: 'Set 2',
    duration: '3 hours',
    marks: 80,
    sections: [
      { name: 'Section A', questions: '1 – 20 (MCQ)', marks: '1 mark each' },
      { name: 'Section B', questions: '21 – 26', marks: '2 marks each' },
      { name: 'Section C', questions: '27 – 33', marks: '3 marks each' },
      { name: 'Section D', questions: '34 – 36 (Case)', marks: '4 marks each' },
      { name: 'Section E', questions: '37 – 39', marks: '5 marks each' },
    ],
    questions: PYQ_QUESTIONS.filter((question) => question.subjectId === 'mathematics').slice(0, 6),
  },
  {
    id: 'paper-cs-2025-1',
    slug: '2025-cbse-computer-science-set-1',
    year: 2025,
    board: 'CBSE',
    classId: 'class-12',
    subjectId: 'computer-science',
    subjectName: 'Computer Science',
    set: 'Set 1',
    duration: '3 hours',
    marks: 70,
    sections: [
      { name: 'Section A', questions: '1 – 15 (MCQ)', marks: '1 mark each' },
      { name: 'Section B', questions: '16 – 22', marks: '2 marks each' },
      { name: 'Section C', questions: '23 – 29', marks: '3 marks each' },
      { name: 'Section D', questions: '30 – 32 (Case)', marks: '5 marks each' },
    ],
    questions: PYQ_QUESTIONS.filter((question) => question.subjectId === 'computer-science'),
  },
  {
    id: 'paper-eng-2024-1',
    slug: '2024-cbse-english-core-set-1',
    year: 2024,
    board: 'CBSE',
    classId: 'class-12',
    subjectId: 'english',
    subjectName: 'English Core',
    set: 'Set 1',
    duration: '3 hours',
    marks: 80,
    sections: [
      { name: 'Section A', questions: 'Reading comprehension', marks: '20 marks' },
      { name: 'Section B', questions: 'Creative writing', marks: '20 marks' },
      { name: 'Section C', questions: 'Literature', marks: '40 marks' },
    ],
    questions: PYQ_QUESTIONS.filter((question) => question.subjectId === 'english'),
  },
]

/* ------------------------------- helpers ---------------------------------- */

export function questionsForSubject(subjectId?: string): PyqQuestion[] {
  if (!subjectId) return PYQ_QUESTIONS
  return PYQ_QUESTIONS.filter((question) => question.subjectId === subjectId)
}

export function questionsForChapter(chapterSlug?: string): PyqQuestion[] {
  if (!chapterSlug) return []
  return PYQ_QUESTIONS.filter((question) => question.chapterSlug === chapterSlug)
}

export function papersForSubject(subjectId?: string): PyqPaper[] {
  if (!subjectId) return PYQ_PAPERS
  return PYQ_PAPERS.filter((paper) => paper.subjectId === subjectId)
}

export function getPaper(slug?: string): PyqPaper | undefined {
  if (!slug) return undefined
  return PYQ_PAPERS.find((paper) => paper.slug === slug || paper.id === slug)
}

export function conceptsForSubject(subjectId?: string): ConceptFrequency[] {
  if (!subjectId) return CONCEPT_FREQUENCY
  return CONCEPT_FREQUENCY.filter((concept) => concept.subjectId === subjectId)
}

/** Frequency by subject for the overview charts. */
export function conceptCountsBySubject() {
  const map = new Map<string, number>()
  for (const concept of CONCEPT_FREQUENCY) {
    map.set(concept.subjectId, (map.get(concept.subjectId) ?? 0) + concept.appearances)
  }
  return Array.from(map.entries()).map(([subjectId, appearances]) => ({ subjectId, appearances }))
}
