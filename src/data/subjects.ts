import type { Chapter, Difficulty, Subject, SubjectId } from '@/types'
import { slugify } from '@/utils/format'

/**
 * Compact chapter builder — keeps ~60 chapters of realistic CBSE Class 12
 * data readable while producing fully-shaped `Chapter` objects.
 */
function c(
  subjectId: SubjectId,
  index: number,
  title: string,
  description: string,
  progress: number,
  difficulty: Difficulty,
  questionCount: number,
  pyqCount: number,
  estimatedMinutes: number,
  topics: string,
  extra: Partial<Chapter> = {},
): Chapter {
  const slug = slugify(title)
  return {
    id: `chapter:${subjectId}:${slug}`,
    slug,
    index,
    title,
    shortTitle: title,
    description,
    progress,
    difficulty,
    questionCount,
    pyqCount,
    estimatedMinutes,
    topics: topics
      .split('|')
      .map((topic) => topic.trim())
      .filter(Boolean),
    ...extra,
  }
}

/* --------------------------------- Physics -------------------------------- */

const PHYSICS_CHAPTERS: Chapter[] = [
  c('physics', 1, 'Electrostatics', 'Electric charges, fields, potential and the physics of capacitors.', 92, 'Moderate', 210, 96, 240,
    'Electric charges and fields | Electrostatic potential | Capacitors and dielectrics | Conductors'),
  c('physics', 2, 'Current Electricity', 'Ohm’s law, drift velocity, and the bridge experiments that define the chapter.', 78, 'Moderate', 195, 88, 210,
    'Ohm’s law and resistance | Drift velocity | Kirchhoff’s laws | Wheatstone bridge | Meter bridge and potentiometer'),
  c('physics', 3, 'Moving Charges and Magnetism', 'Magnetic fields produced by moving charge and current-carrying conductors.', 64, 'Hard', 176, 74, 220,
    'Biot–Savart law | Ampère’s law | Cyclotron | Moving coil galvanometer | Torque on a dipole'),
  c('physics', 4, 'Electromagnetic Induction', 'Faraday’s experiments, Lenz’s law and the birth of alternating current.', 45, 'Hard', 168, 81, 200,
    'Faraday’s laws | Lenz’s law | Self and mutual inductance | AC generator'),
  c('physics', 5, 'Alternating Current', 'Phasors, LCR circuits, resonance and the power factor.', 38, 'Moderate', 142, 66, 170,
    'AC through resistors, inductors, capacitors | Phasor diagrams | LCR series circuit | Resonance | Transformers'),
  c('physics', 6, 'Electromagnetic Waves', 'Displacement current and the spectrum that carries light, radio and X-rays.', 100, 'Easy', 84, 32, 90,
    'Displacement current | Characteristics of EM waves | EM spectrum'),
  c('physics', 7, 'Ray Optics', 'Reflection, refraction, lenses and optical instruments.', 30, 'Moderate', 160, 72, 190,
    'Reflection at spherical mirrors | Refraction and total internal reflection | Refraction by spherical lenses | Optical instruments'),
  c('physics', 8, 'Wave Optics', 'Huygens, interference, diffraction and polarisation.', 12, 'Hard', 138, 64, 170,
    'Huygens’ principle | YDSE and interference | Diffraction | Polarisation', { weak: true }),
  c('physics', 9, 'Dual Nature of Radiation and Matter', 'Photoelectric effect, photons and de Broglie’s hypothesis.', 0, 'Moderate', 120, 58, 150,
    'Emission of electrons | Photoelectric effect | Wave nature of matter'),
  c('physics', 10, 'Atoms', 'Rutherford, Bohr and the hydrogen spectrum.', 0, 'Moderate', 104, 46, 130,
    'Atomic models | Bohr postulates | Hydrogen spectrum | Energy levels'),
  c('physics', 11, 'Nuclei', 'Binding energy, radioactivity, fission and fusion.', 0, 'Hard', 96, 42, 140,
    'Nuclear size and density | Binding energy | Radioactive decay | Fission and fusion', { weak: true }),
  c('physics', 12, 'Semiconductor Electronics', 'Junction diodes, Zener regulators and logic gates.', 0, 'Easy', 132, 60, 150,
    'Intrinsic and extrinsic semiconductors | p–n junction | Zener diode | Logic gates | Photodiodes and LEDs'),
]

/* -------------------------------- Chemistry ------------------------------- */

const CHEMISTRY_CHAPTERS: Chapter[] = [
  c('chemistry', 1, 'Solutions', 'Raoult’s law, colligative properties and the van’t Hoff factor.', 85, 'Moderate', 168, 74, 190,
    'Types of solutions | Raoult’s law | Colligative properties | van’t Hoff factor'),
  c('chemistry', 2, 'Electrochemistry', 'Nernst equation, conductance, galvanic and electrolytic cells.', 70, 'Moderate', 182, 92, 210,
    'Redox reactions | Nernst equation | Conductance and conductivity | Electrochemical cells | Batteries and fuel cells',
    { favorite: true }),
  c('chemistry', 3, 'Chemical Kinetics', 'Rate laws, order, molecularity and the Arrhenius equation.', 55, 'Moderate', 154, 68, 180,
    'Rate of reaction | Rate law and order | Molecularity | Half-life | Arrhenius equation'),
  c('chemistry', 4, 'The d and f Block Elements', 'Transition metals, lanthanoids and their characteristic properties.', 40, 'Hard', 148, 62, 170,
    'Electronic configuration of transition elements | General properties | Lanthanoids and actinoids | Important compounds'),
  c('chemistry', 5, 'Coordination Compounds', 'Nomenclature, isomerism and crystal field theory.', 22, 'Hard', 156, 70, 190,
    'Werner’s theory | IUPAC nomenclature | Isomerism | VBT and CFT | Stability and metal carbonyls', { weak: true }),
  c('chemistry', 6, 'Haloalkanes and Haloarenes', 'Nucleophilic substitution, elimination and aryl halide reactions.', 100, 'Easy', 144, 58, 150,
    'Nomenclature and preparation | Nucleophilic substitution | Elimination reactions | Reactions of haloarenes'),
  c('chemistry', 7, 'Alcohols, Phenols and Ethers', 'Preparation, reactions and named reactions of the alcohol family.', 60, 'Moderate', 178, 86, 200,
    'Preparation of alcohols | Properties of alcohols and phenols | Reimer–Tiemann and Kolbe reactions | Williamson synthesis | Ethers',
    { favorite: true }),
  c('chemistry', 8, 'Aldehydes, Ketones and Carboxylic Acids', 'Nucleophilic addition, aldol condensation and acid derivatives.', 35, 'Hard', 190, 88, 210,
    'Nomenclature and preparation | Nucleophilic addition reactions | Aldol and Cannizzaro reactions | Carboxylic acids',
    { weak: true }),
  c('chemistry', 9, 'Amines', 'Preparation, basicity and diazonium chemistry.', 15, 'Moderate', 142, 64, 170,
    'Classification and nomenclature | Preparation of amines | Physical and chemical properties | Diazonium salts'),
  c('chemistry', 10, 'Biomolecules', 'Carbohydrates, proteins, nucleic acids and vitamins.', 5, 'Easy', 118, 46, 140,
    'Carbohydrates | Proteins and amino acids | Nucleic acids | Enzymes, vitamins and nucleic acids'),
]

/* ------------------------------- Mathematics ------------------------------ */

const MATHEMATICS_CHAPTERS: Chapter[] = [
  c('mathematics', 1, 'Relations and Functions', 'Types of relations, functions and their composition.', 80, 'Moderate', 190, 78, 200,
    'Types of relations | Functions and their types | Composition of functions | Invertible functions'),
  c('mathematics', 2, 'Inverse Trigonometric Functions', 'Domains, ranges and identities of inverse trig functions.', 65, 'Moderate', 146, 62, 170,
    'Inverse trigonometric functions | Properties and identities'),
  c('mathematics', 3, 'Matrices', 'Types, operations and elementary transformations of matrices.', 74, 'Easy', 178, 74, 180,
    'Matrix arithmetic | Types of matrices | Elementary row operations'),
  c('mathematics', 4, 'Determinants', 'Properties, cofactors and solving linear systems.', 68, 'Moderate', 172, 76, 180,
    'Properties of determinants | Minors and cofactors | Adjoint and inverse | Applications to linear equations'),
  c('mathematics', 5, 'Continuity and Differentiability', 'Chain rule, implicit differentiation and exponential functions.', 52, 'Hard', 214, 92, 240,
    'Continuity | Differentiability | Chain rule | Implicit differentiation | Exponential and logarithmic functions'),
  c('mathematics', 6, 'Application of Derivatives', 'Rate of change, tangents, maxima and minima.', 44, 'Hard', 206, 90, 230,
    'Rate of change | Tangents and normals | Increasing and decreasing functions | Maxima and minima'),
  c('mathematics', 7, 'Integrals', 'Techniques of integration and the fundamental theorem.', 30, 'Hard', 236, 104, 280,
    'Integration by substitution | Partial fractions | By parts | Definite integrals | Fundamental theorem',
    { weak: true }),
  c('mathematics', 8, 'Application of Integrals', 'Areas under curves and between curves.', 20, 'Moderate', 148, 64, 170,
    'Area under simple curves | Area between two curves'),
  c('mathematics', 9, 'Differential Equations', 'Order, degree and methods of solving differential equations.', 12, 'Hard', 168, 78, 190,
    'Order and degree | Separation of variables | Homogeneous equations | Linear differential equations',
    { weak: true }),
  c('mathematics', 10, 'Vector Algebra', 'Vectors, dot and cross products with geometric meaning.', 46, 'Easy', 154, 66, 160,
    'Vector operations | Dot product | Cross product | Scalar triple product'),
  c('mathematics', 11, 'Three Dimensional Geometry', 'Direction cosines, lines and planes in space.', 34, 'Moderate', 148, 68, 175,
    'Direction cosines and ratios | Equation of lines and planes | Shortest distance'),
  c('mathematics', 12, 'Linear Programming', 'Graphical optimisation of objective functions.', 70, 'Easy', 96, 42, 110,
    'Linear inequalities | Objective function | Feasible region | Optimal solution'),
  c('mathematics', 13, 'Probability', 'Conditional probability, Bayes’ theorem and distributions.', 8, 'Hard', 186, 86, 210,
    'Conditional probability | Total probability and Bayes’ theorem | Random variables | Binomial distribution',
    { weak: true }),
]

/* --------------------------------- English -------------------------------- */

const ENGLISH_CHAPTERS: Chapter[] = [
  c('english', 1, 'The Last Lesson', 'Alphonse Daudet — language, identity and the cost of procrastination.', 100, 'Easy', 64, 24, 80,
    'Plot and theme | Character study | Value-based questions | Extract handling'),
  c('english', 2, 'Lost Spring', 'Anand Patel — childhood lost to bangle-making and scrap work.', 88, 'Easy', 58, 22, 75,
    'Author’s craft | Themes of poverty | Long answer practice'),
  c('english', 3, 'Deep Water', 'William Douglas — overcoming fear through persistence.', 75, 'Easy', 52, 18, 70,
    'Narrative arc | Psychological depth | Message and moral'),
  c('english', 4, 'The Rattrap', 'Selma Lagerlöf — generosity redeeming a thief.', 60, 'Moderate', 56, 20, 75,
    'Symbolism | Irony | Character arc'),
  c('english', 5, 'Indigo', 'Louis Fischer — a chapter of peasant courage and Gandhi’s strategy.', 40, 'Moderate', 62, 26, 85,
    'Historical context | Fact and opinion | Long answer questions'),
  c('english', 6, 'Poets and Pancakes', 'Asokamitran — Gemini Studios and the craft of writing.', 25, 'Moderate', 48, 18, 70,
    'Humour and satire | Narrative techniques | Extract questions'),
  c('english', 7, 'The Third Level', 'Jack Finney — escapism, philately and time travel.', 10, 'Moderate', 44, 16, 65,
    'Theme of escape | Fantasy and reality | Character motives'),
  c('english', 8, 'The Tiger King', 'Kalki — satire on vanity and destiny.', 0, 'Easy', 46, 18, 65,
    'Satire | Irony | Characterisation'),
]

/* ------------------------------ Computer Science -------------------------- */

const COMPUTER_CHAPTERS: Chapter[] = [
  c('computer-science', 1, 'Python Revision Tour and Functions', 'Scope, parameters, recursion and lambda in modern Python.', 90, 'Easy', 132, 50, 150,
    'Python revision | Functions and scope | Recursion | Lambda and map/filter'),
  c('computer-science', 2, 'File Handling', 'Text, CSV and binary file operations with record structures.', 75, 'Easy', 118, 44, 140,
    'File modes | Text and CSV files | Binary files | Record handling'),
  c('computer-science', 3, 'Data Structures — Stack and Queue', 'Implementing and applying linear structures.', 58, 'Moderate', 146, 62, 170,
    'Stack operations | Infix to postfix | Queue and deque | Applications'),
  c('computer-science', 4, 'Sorting and Searching', 'Algorithms, their complexity and analysis.', 48, 'Moderate', 124, 54, 150,
    'Linear and binary search | Bubble, selection, insertion sort | Complexity analysis'),
  c('computer-science', 5, 'Database Concepts and SQL', 'ER modelling, keys, normalisation and SQL queries.', 66, 'Moderate', 134, 56, 160,
    'ER model | Relational model and keys | Normalisation | SQL DDL and DML'),
  c('computer-science', 6, 'Interface Python with SQL', 'Driving a database from Python for CRUD and analytics.', 44, 'Moderate', 128, 52, 150,
    'sqlite3 connector | CRUD operations | Search and aggregate | Parameterised queries'),
  c('computer-science', 7, 'Computer Networks', 'OSI, TCP/IP, transmission media and network security.', 30, 'Hard', 120, 48, 150,
    'Network types | OSI and TCP/IP models | Transmission media | Network devices and security',
    { weak: true }),
  c('computer-science', 8, 'Society, Law and Ethics', 'Cybercrime, digital footprint and intellectual property.', 100, 'Easy', 64, 18, 80,
    'Digital footprint | Cyber safety | IT Act and cybercrime | Intellectual property'),
]

/* ------------------------------ Subject assembly -------------------------- */

type SubjectMeta = {
  id: SubjectId
  name: string
  short: string
  description: string
  accent: Subject['accent']
  teacher: string
  accuracy: number
  chapters: Chapter[]
}

const SUBJECT_META: SubjectMeta[] = [
  {
    id: 'physics',
    name: 'Physics',
    short: 'PHY',
    description: 'Mechanics, electricity, optics and modern physics — NCERT aligned with PYQ drill-downs.',
    accent: 'physics',
    teacher: 'Ananya Rao',
    accuracy: 74,
    chapters: PHYSICS_CHAPTERS,
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    short: 'CHEM',
    description: 'Physical, organic and inorganic chemistry with reaction maps and equation drills.',
    accent: 'chemistry',
    teacher: 'Rohit Menon',
    accuracy: 81,
    chapters: CHEMISTRY_CHAPTERS,
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    short: 'MATH',
    description: 'Calculus, algebra, vectors and probability with step-by-step solved PYQs.',
    accent: 'mathematics',
    teacher: 'Divya Sharma',
    accuracy: 68,
    chapters: MATHEMATICS_CHAPTERS,
  },
  {
    id: 'english',
    name: 'English',
    short: 'ENG',
    description: 'Flamingo and Vistas core reader with extract practice and long-answer frameworks.',
    accent: 'english',
    teacher: 'Kabir Sen',
    accuracy: 88,
    chapters: ENGLISH_CHAPTERS,
  },
  {
    id: 'computer-science',
    name: 'Computer Science',
    short: 'CS',
    description: 'Python, data structures, SQL and networks — theory paired with coding practice.',
    accent: 'computer',
    teacher: 'Neha Iyer',
    accuracy: 79,
    chapters: COMPUTER_CHAPTERS,
  },
]

function buildSubject(meta: SubjectMeta): Subject {
  const totalQuestions = meta.chapters.reduce((sum, chapter) => sum + chapter.questionCount, 0)
  const totalMinutes = meta.chapters.reduce((sum, chapter) => sum + chapter.estimatedMinutes, 0)
  const progress = Math.round(
    meta.chapters.reduce((sum, chapter) => sum + chapter.progress, 0) / meta.chapters.length,
  )

  return {
    id: meta.id,
    name: meta.name,
    short: meta.short,
    slug: meta.id,
    description: meta.description,
    accent: meta.accent,
    teacher: meta.teacher,
    totalChapters: meta.chapters.length,
    completedChapters: meta.chapters.filter((chapter) => chapter.progress === 100).length,
    progress,
    questionCount: totalQuestions,
    accuracy: meta.accuracy,
    revisionMinutes: Math.round(totalMinutes * 0.4),
    chapters: meta.chapters,
  }
}

export const SUBJECTS: Subject[] = SUBJECT_META.map(buildSubject)

/* ------------------------------- lookups ---------------------------------- */

export function getSubject(id?: string | null): Subject | undefined {
  if (!id) return undefined
  return SUBJECTS.find((subject) => subject.id === id || subject.slug === id)
}

export function getSubjectName(id?: string | null): string {
  return getSubject(id)?.name ?? 'Subject'
}

export function getChapter(
  subjectId: string | undefined,
  chapterSlug: string | undefined,
): { subject: Subject; chapter: Chapter } | undefined {
  const subject = getSubject(subjectId)
  if (!subject || !chapterSlug) return undefined
  const chapter = subject.chapters.find((entry) => entry.slug === chapterSlug)
  return chapter ? { subject, chapter } : undefined
}

/** Resolve a chapter slug across every subject (deep links from search). */
export function findChapterBySlug(
  chapterSlug: string,
): { subject: Subject; chapter: Chapter } | undefined {
  for (const subject of SUBJECTS) {
    const chapter = subject.chapters.find((entry) => entry.slug === chapterSlug)
    if (chapter) return { subject, chapter }
  }
  return undefined
}

export interface ChapterRow {
  subject: Subject
  chapter: Chapter
}

/** Flat chapter index — handy for search and "recently viewed" lists. */
export const ALL_CHAPTERS: ChapterRow[] = SUBJECTS.flatMap((subject) =>
  subject.chapters.map((chapter) => ({ subject, chapter })),
)

/** Next chapter in a subject (for "continue" flows). */
export function nextChapter(subject: Subject, currentSlug: string): Chapter | undefined {
  const index = subject.chapters.findIndex((chapter) => chapter.slug === currentSlug)
  if (index === -1) return undefined
  return subject.chapters[index + 1]
}
