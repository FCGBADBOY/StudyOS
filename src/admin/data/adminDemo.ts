/**
 * Admin Portal demo dataset.
 *
 * Used only when Supabase is not configured (`isDemo`), so every admin screen
 * stays navigable and every action still persists across a refresh via the
 * localStorage overlay in `src/admin/services/adminDemo.ts`.
 *
 * Everything here is clearly labelled seed data. In a real deployment the same
 * screens read from `public.profiles`, `public.resources`, `public.pyq_questions`
 * and the `admin_*` RPCs — nothing in this file ships to those users' queries.
 */
import type {
  AdminBoardRow,
  AdminChapterRow,
  AdminClassRow,
  AdminPyqRow,
  AdminReportRow,
  AdminResourceRow,
  AdminStreamRow,
  AdminSubjectRow,
  AdminUserRow,
  AuditLogRow,
} from '../types/admin'

const now = Date.now()
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString()

/* ------------------------------- hierarchy -------------------------------- */

export const DEMO_ADMINS_BOARDS: AdminBoardRow[] = [
  {
    id: 'b-cbse',
    slug: 'cbse',
    name: 'CBSE',
    short_name: 'CBSE',
    description: 'Central Board of Secondary Education — NCERT aligned.',
    display_order: 1,
    is_archived: false,
  },
  {
    id: 'b-icse',
    slug: 'icse',
    name: 'ICSE',
    short_name: 'ICSE',
    description: 'Council for the Indian School Certificate Examinations.',
    display_order: 2,
    is_archived: false,
  },
  {
    id: 'b-isc',
    slug: 'isc',
    name: 'ISC',
    short_name: 'ISC',
    description: 'Indian School Certificate — Class 11 & 12 focus.',
    display_order: 3,
    is_archived: false,
  },
  {
    id: 'b-wbchse',
    slug: 'wbchse',
    name: 'WBCHSE',
    short_name: 'WBCHSE',
    description: 'West Bengal Council of Higher Secondary Education.',
    display_order: 4,
    is_archived: false,
  },
  {
    id: 'b-mah',
    slug: 'maharashtra-board',
    name: 'Maharashtra Board',
    short_name: 'MSBSHSE',
    description: 'Maharashtra State Board of Secondary & Higher Secondary Education.',
    display_order: 5,
    is_archived: false,
  },
  {
    id: 'b-up',
    slug: 'up-board',
    name: 'UP Board',
    short_name: 'UPMSP',
    description: 'Uttar Pradesh Madhyamik Shiksha Parishad.',
    display_order: 6,
    is_archived: true,
  },
]

export const DEMO_ADMINS_CLASSES: AdminClassRow[] = [
  { id: 'c-6', slug: 'class-6', name: 'Class 6', description: null, display_order: 6, senior: false, is_archived: false },
  { id: 'c-7', slug: 'class-7', name: 'Class 7', description: null, display_order: 7, senior: false, is_archived: false },
  { id: 'c-8', slug: 'class-8', name: 'Class 8', description: null, display_order: 8, senior: false, is_archived: false },
  { id: 'c-9', slug: 'class-9', name: 'Class 9', description: 'Foundation year for the board syllabus.', display_order: 9, senior: false, is_archived: false },
  { id: 'c-10', slug: 'class-10', name: 'Class 10', description: 'First board examination year.', display_order: 10, senior: false, is_archived: false },
  { id: 'c-11', slug: 'class-11', name: 'Class 11', description: 'Stream specialisation begins.', display_order: 11, senior: true, is_archived: false },
  { id: 'c-12', slug: 'class-12', name: 'Class 12', description: 'Senior secondary board year.', display_order: 12, senior: true, is_archived: false },
]

export const DEMO_ADMINS_STREAMS: AdminStreamRow[] = [
  { id: 's-science', slug: 'science', name: 'Science', description: 'Physics, Chemistry, Mathematics and Computer Science.', display_order: 1, is_archived: false },
  { id: 's-commerce', slug: 'commerce', name: 'Commerce', description: 'Accountancy, Business Studies and Economics.', display_order: 2, is_archived: false },
  { id: 's-humanities', slug: 'humanities', name: 'Humanities', description: 'History, Political Science and Geography.', display_order: 3, is_archived: false },
]

export const DEMO_ADMINS_SUBJECTS: AdminSubjectRow[] = [
  { id: 'sub-physics', slug: 'physics', class_id: 'c-12', board_id: 'b-cbse', stream_id: 's-science', name: 'Physics', code: 'PHY', description: 'Mechanics to modern physics.', display_order: 1, is_archived: false },
  { id: 'sub-chemistry', slug: 'chemistry', class_id: 'c-12', board_id: 'b-cbse', stream_id: 's-science', name: 'Chemistry', code: 'CHM', description: 'Physical, organic and inorganic chemistry.', display_order: 2, is_archived: false },
  { id: 'sub-maths', slug: 'mathematics', class_id: 'c-12', board_id: 'b-cbse', stream_id: 's-science', name: 'Mathematics', code: 'MAT', description: 'Calculus, algebra and probability.', display_order: 3, is_archived: false },
  { id: 'sub-english', slug: 'english', class_id: 'c-12', board_id: 'b-cbse', stream_id: null, name: 'English', code: 'ENG', description: 'Core English for all streams.', display_order: 4, is_archived: false },
  { id: 'sub-cs', slug: 'computer-science', class_id: 'c-12', board_id: 'b-cbse', stream_id: 's-science', name: 'Computer Science', code: 'CSC', description: 'Python, data structures and SQL.', display_order: 5, is_archived: false },
  { id: 'sub-accountancy', slug: 'accountancy', class_id: 'c-12', board_id: 'b-cbse', stream_id: 's-commerce', name: 'Accountancy', code: 'ACC', description: 'Financial accounting fundamentals.', display_order: 6, is_archived: false },
  { id: 'sub-history', slug: 'history', class_id: 'c-12', board_id: 'b-cbse', stream_id: 's-humanities', name: 'History', code: 'HIS', description: 'Modern world history.', display_order: 7, is_archived: false },
  { id: 'sub-physics-11', slug: 'physics', class_id: 'c-11', board_id: 'b-cbse', stream_id: 's-science', name: 'Physics', code: 'PHY', description: 'Class 11 physics syllabus.', display_order: 1, is_archived: false },
  { id: 'sub-removed', slug: 'bengali', class_id: 'c-12', board_id: 'b-wbchse', stream_id: null, name: 'Bengali', code: 'BEN', description: 'Retired elective — kept for archived records.', display_order: 99, is_archived: true },
]

export const DEMO_ADMINS_CHAPTERS: AdminChapterRow[] = [
  { id: 'ch-1', subject_id: 'sub-physics', slug: 'electrostatics', name: 'Electrostatics', chapter_number: 1, description: 'Coulomb’s law, capacitors and potential.', display_order: 1, difficulty: 'hard', estimated_minutes: 180, topics: ['Coulomb’s law', 'Gauss’s law', 'Capacitors'], is_archived: false },
  { id: 'ch-2', subject_id: 'sub-physics', slug: 'current-electricity', name: 'Current Electricity', chapter_number: 2, description: 'Ohm’s law, Kirchhoff’s laws and resistance networks.', display_order: 2, difficulty: 'moderate', estimated_minutes: 150, topics: ['Ohm’s law', 'Kirchhoff’s laws', 'Wheatstone bridge'], is_archived: false },
  { id: 'ch-3', subject_id: 'sub-physics', slug: 'magnetic-effects', name: 'Magnetic Effects of Current', chapter_number: 3, description: 'Lorentz force and electromagnetic induction.', display_order: 3, difficulty: 'hard', estimated_minutes: 165, topics: ['Lorentz force', 'Faraday’s law'], is_archived: false },
  { id: 'ch-4', subject_id: 'sub-physics', slug: 'optics', name: 'Ray Optics & Optical Instruments', chapter_number: 9, description: 'Reflection, refraction and instruments.', display_order: 4, difficulty: 'moderate', estimated_minutes: 140, topics: ['Snell’s law', 'Microscopes'], is_archived: false },
  { id: 'ch-5', subject_id: 'sub-physics', slug: 'dual-nature', name: 'Dual Nature of Radiation & Matter', chapter_number: 11, description: 'Photoelectric effect and de Broglie waves.', display_order: 5, difficulty: 'hard', estimated_minutes: 120, topics: ['Photoelectric effect'], is_archived: false },
  { id: 'ch-6', subject_id: 'sub-chemistry', slug: 'solutions', name: 'Solutions', chapter_number: 2, description: 'Concentration units and colligative properties.', display_order: 1, difficulty: 'moderate', estimated_minutes: 130, topics: ['Raoult’s law', 'Osmosis'], is_archived: false },
  { id: 'ch-7', subject_id: 'sub-chemistry', slug: 'electrochemistry', name: 'Electrochemistry', chapter_number: 3, description: 'Galvanic cells and Nernst equation.', display_order: 2, difficulty: 'hard', estimated_minutes: 145, topics: ['Galvanic cells', 'Nernst equation'], is_archived: false },
  { id: 'ch-8', subject_id: 'sub-chemistry', slug: 'aldehydes-ketones', name: 'Aldehydes, Ketones & Carboxylic Acids', chapter_number: 12, description: 'Nomenclature and nucleophilic addition.', display_order: 3, difficulty: 'hard', estimated_minutes: 190, topics: ['Aldol condensation'], is_archived: false },
  { id: 'ch-9', subject_id: 'sub-maths', slug: 'relations-functions', name: 'Relations & Functions', chapter_number: 1, description: 'Types of relations and composite functions.', display_order: 1, difficulty: 'easy', estimated_minutes: 110, topics: ['Equivalence relations'], is_archived: false },
  { id: 'ch-10', subject_id: 'sub-maths', slug: 'inverse-trigonometry', name: 'Inverse Trigonometric Functions', chapter_number: 2, description: 'Principal values and identities.', display_order: 2, difficulty: 'moderate', estimated_minutes: 100, topics: ['Principal values'], is_archived: false },
  { id: 'ch-11', subject_id: 'sub-maths', slug: 'continuity-differentiability', name: 'Continuity & Differentiability', chapter_number: 5, description: 'Limits, continuity and chain rule.', display_order: 3, difficulty: 'hard', estimated_minutes: 200, topics: ['Chain rule', 'Mean value theorem'], is_archived: false },
  { id: 'ch-12', subject_id: 'sub-maths', slug: 'integrals', name: 'Integrals', chapter_number: 7, description: 'Indefinite and definite integration.', display_order: 4, difficulty: 'hard', estimated_minutes: 220, topics: ['Substitution', 'By parts'], is_archived: false },
  { id: 'ch-13', subject_id: 'sub-cs', slug: 'python-review', name: 'Python Review', chapter_number: 1, description: 'Data types, control flow and functions.', display_order: 1, difficulty: 'easy', estimated_minutes: 120, topics: ['Lists', 'Dictionary'], is_archived: false },
  { id: 'ch-14', subject_id: 'sub-cs', slug: 'functions-recursion', name: 'Functions & Recursion', chapter_number: 2, description: 'Scope, arguments and recursive patterns.', display_order: 2, difficulty: 'moderate', estimated_minutes: 130, topics: ['Recursion', 'Default args'], is_archived: false },
  { id: 'ch-15', subject_id: 'sub-cs', slug: 'file-handling', name: 'File Handling', chapter_number: 3, description: 'Text and binary file operations.', display_order: 3, difficulty: 'moderate', estimated_minutes: 90, topics: ['CSV module'], is_archived: false },
  { id: 'ch-16', subject_id: 'sub-english', slug: 'flamingo', name: 'Flamingo — Prose', chapter_number: 1, description: 'Analytical prose sections.', display_order: 1, difficulty: 'easy', estimated_minutes: 90, topics: ['The Last Lesson'], is_archived: false },
  { id: 'ch-17', subject_id: 'sub-physics', slug: 'old-syllabus-chapter', name: 'Oscillations (old syllabus)', chapter_number: 14, description: 'Retired from the 2026 syllabus.', display_order: 99, difficulty: 'hard', estimated_minutes: 150, topics: ['SHM'], is_archived: true },
]

/* -------------------------------- resources -------------------------------- */

export const DEMO_ADMINS_RESOURCES: AdminResourceRow[] = [
  {
    id: 'r-1', title: 'Electrostatics — Complete Notes', description: 'Full chapter notes with worked examples and derivations.',
    resource_type: 'notes', chapter_id: 'ch-1', subject_id: 'sub-physics', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'Dr. A. Sen', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: 'cbse/class-12/physics/electrostatics-notes.pdf', file_size_bytes: 2_411_520,
    tags: ['derivations', 'board-exam'], status: 'published', is_published: true,
    created_by: 'u-1', updated_by: 'u-1', reviewed_by: 'u-2', review_note: null,
    published_at: daysAgo(28), created_at: daysAgo(30), updated_at: daysAgo(2),
  },
  {
    id: 'r-2', title: 'Current Electricity — Formula Sheet', description: 'One-page revision sheet of every formula in the chapter.',
    resource_type: 'formula_sheet', chapter_id: 'ch-2', subject_id: 'sub-physics', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'R. Mehta', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: 'cbse/class-12/physics/current-electricity-formulas.pdf', file_size_bytes: 486_912,
    tags: ['formulas', 'revision'], status: 'published', is_published: true,
    created_by: 'u-1', updated_by: 'u-1', reviewed_by: 'u-2', review_note: null,
    published_at: daysAgo(21), created_at: daysAgo(22), updated_at: daysAgo(22),
  },
  {
    id: 'r-3', title: 'Solutions — Revision Notes', description: 'Condensed revision notes covering colligative properties.',
    resource_type: 'revision_notes', chapter_id: 'ch-6', subject_id: 'sub-chemistry', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'S. Iyer', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: 'cbse/class-12/chemistry/solutions-revision.pdf', file_size_bytes: 1_048_576,
    tags: ['revision'], status: 'pending_review', is_published: false,
    created_by: 'u-3', updated_by: 'u-3', reviewed_by: null, review_note: null,
    published_at: null, created_at: daysAgo(4), updated_at: daysAgo(3),
  },
  {
    id: 'r-4', title: 'Integrals — Important Questions', description: 'Curated 60-question bank ordered by difficulty.',
    resource_type: 'important_questions', chapter_id: 'ch-12', subject_id: 'sub-maths', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'K. Bhatt', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: 'cbse/class-12/maths/integrals-important.pdf', file_size_bytes: 3_145_728,
    tags: ['question-bank'], status: 'draft', is_published: false,
    created_by: 'u-3', updated_by: 'u-3', reviewed_by: null, review_note: null,
    published_at: null, created_at: daysAgo(2), updated_at: daysAgo(1),
  },
  {
    id: 'r-5', title: 'Computer Science — Sample Paper 2026', description: 'Board-pattern sample paper with marking scheme.',
    resource_type: 'sample_paper', chapter_id: null, subject_id: 'sub-cs', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'P. Nair', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: 'cbse/class-12/cs/sample-paper-2026.pdf', file_size_bytes: 1_572_864,
    tags: ['sample-paper', '2026'], status: 'published', is_published: true,
    created_by: 'u-1', updated_by: 'u-2', reviewed_by: 'u-2', review_note: null,
    published_at: daysAgo(12), created_at: daysAgo(14), updated_at: daysAgo(12),
  },
  {
    id: 'r-6', title: 'Continuity & Differentiability — Video Lecture', description: '72-minute recorded lecture with chapter markers.',
    resource_type: 'video', chapter_id: 'ch-11', subject_id: 'sub-maths', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'K. Bhatt', source_name: 'StudyOS Studio', thumbnail_url: null,
    file_path: 'cbse/class-12/maths/continuity-lecture.mp4', file_size_bytes: 214_748_364,
    tags: ['video'], status: 'rejected', is_published: false,
    created_by: 'u-3', updated_by: 'u-1', reviewed_by: 'u-2',
    review_note: 'Audio levels are inconsistent in the first 6 minutes — please re-export.',
    published_at: null, created_at: daysAgo(9), updated_at: daysAgo(6),
  },
  {
    id: 'r-7', title: 'Oscillations — Legacy Notes', description: 'Superseded by the 2026 syllabus change.',
    resource_type: 'notes', chapter_id: 'ch-17', subject_id: 'sub-physics', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'Dr. A. Sen', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: 'cbse/class-12/physics/oscillations-legacy.pdf', file_size_bytes: 921_600,
    tags: ['legacy'], status: 'archived', is_published: false,
    created_by: 'u-1', updated_by: 'u-2', reviewed_by: 'u-2', review_note: null,
    published_at: daysAgo(400), created_at: daysAgo(410), updated_at: daysAgo(40),
  },
  {
    id: 'r-8', title: 'Flamingo — Prose Summary Notes', description: 'Chapter summaries with value-based questions.',
    resource_type: 'notes', chapter_id: 'ch-16', subject_id: 'sub-english', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'M. Das', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: 'cbse/class-12/english/flamingo-prose.pdf', file_size_bytes: 786_432,
    tags: ['summary'], status: 'approved', is_published: false,
    created_by: 'u-3', updated_by: 'u-3', reviewed_by: 'u-2', review_note: null,
    published_at: null, created_at: daysAgo(5), updated_at: daysAgo(2),
  },
  {
    id: 'r-9', title: 'Electrochemistry — Diagram Pack', description: 'Labeled diagrams of galvanic and electrolytic cells.',
    resource_type: 'diagram', chapter_id: 'ch-7', subject_id: 'sub-chemistry', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'S. Iyer', source_name: 'StudyOS Studio', thumbnail_url: null,
    file_path: 'cbse/class-12/chemistry/electrochemistry-diagrams.webp', file_size_bytes: 1_258_291,
    tags: ['diagrams'], status: 'pending_review', is_published: false,
    created_by: 'u-3', updated_by: 'u-3', reviewed_by: null, review_note: null,
    published_at: null, created_at: daysAgo(3), updated_at: daysAgo(3),
  },
  {
    id: 'r-10', title: 'Relations & Functions — Reference Material', description: 'Extra practice problems with fully worked solutions.',
    resource_type: 'reference_material', chapter_id: 'ch-9', subject_id: 'sub-maths', board_id: 'b-cbse', class_id: 'c-12',
    author_name: 'K. Bhatt', source_name: 'StudyOS Editorial', thumbnail_url: null,
    file_path: null, file_size_bytes: null,
    tags: [], status: 'draft', is_published: false,
    created_by: 'u-1', updated_by: 'u-1', reviewed_by: null, review_note: null,
    published_at: null, created_at: daysAgo(1), updated_at: daysAgo(1),
  },
]

/* ----------------------------------- PYQ ---------------------------------- */

export const DEMO_ADMINS_PYQS: AdminPyqRow[] = [
  { id: 'q-1', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-physics', chapter_id: 'ch-1', year: 2024, exam_type: 'board', question_text: 'State Gauss’s law and derive the expression for the electric field due to an infinite plane sheet of charge.', question_type: 'long_answer', paper_set: 'Set 1', marks: 5, difficulty: 'hard', source: 'CBSE Delhi 2024', solution_resource_id: 'r-1', concepts: ['Gauss’s law'], is_important: true, created_at: daysAgo(60), updated_at: daysAgo(60) },
  { id: 'q-2', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-physics', chapter_id: 'ch-2', year: 2023, exam_type: 'board', question_text: 'A wire of resistance R is stretched to twice its original length. Find the new resistance.', question_type: 'numerical', paper_set: 'Set 2', marks: 2, difficulty: 'moderate', source: 'CBSE 2023', solution_resource_id: null, concepts: ['Resistance'], is_important: false, created_at: daysAgo(75), updated_at: daysAgo(75) },
  { id: 'q-3', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-physics', chapter_id: 'ch-2', year: 2022, exam_type: 'board', question_text: 'A wire of resistance R is stretched to twice its length. What happens to its resistivity?', question_type: 'MCQ', paper_set: 'Set 1', marks: 1, difficulty: 'easy', source: 'CBSE 2022', solution_resource_id: null, concepts: ['Resistivity'], is_important: false, created_at: daysAgo(90), updated_at: daysAgo(90) },
  { id: 'q-4', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-chemistry', chapter_id: 'ch-6', year: 2024, exam_type: 'board', question_text: 'Define osmotic pressure and relate it to the concentration of the solution.', question_type: 'short_answer', paper_set: 'Set 1', marks: 3, difficulty: 'moderate', source: 'CBSE 2024', solution_resource_id: null, concepts: ['Osmosis'], is_important: true, created_at: daysAgo(58), updated_at: daysAgo(58) },
  { id: 'q-5', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-chemistry', chapter_id: 'ch-7', year: 2023, exam_type: 'board', question_text: 'Calculate the EMF of a galvanic cell given the standard electrode potentials.', question_type: 'numerical', paper_set: 'Set 3', marks: 3, difficulty: 'hard', source: 'CBSE 2023', solution_resource_id: null, concepts: ['Nernst equation'], is_important: false, created_at: daysAgo(80), updated_at: daysAgo(80) },
  { id: 'q-6', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-maths', chapter_id: 'ch-12', year: 2024, exam_type: 'board', question_text: 'Evaluate the definite integral of x·e^x from 0 to 1.', question_type: 'numerical', paper_set: 'Set 1', marks: 3, difficulty: 'moderate', source: 'CBSE 2024', solution_resource_id: null, concepts: ['Integration by parts'], is_important: true, created_at: daysAgo(55), updated_at: daysAgo(55) },
  { id: 'q-7', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-maths', chapter_id: 'ch-11', year: 2021, exam_type: 'board', question_text: 'Prove that f(x) = |x| is continuous but not differentiable at x = 0.', question_type: 'long_answer', paper_set: 'Set 2', marks: 4, difficulty: 'hard', source: 'CBSE 2021', solution_resource_id: null, concepts: ['Differentiability'], is_important: false, created_at: daysAgo(120), updated_at: daysAgo(120) },
  { id: 'q-8', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-cs', chapter_id: 'ch-14', year: 2024, exam_type: 'board', question_text: 'Explain the difference between a pure function and an impure function with examples.', question_type: 'short_answer', paper_set: 'Set 1', marks: 2, difficulty: 'easy', source: 'CBSE 2024', solution_resource_id: null, concepts: ['Purity'], is_important: false, created_at: daysAgo(50), updated_at: daysAgo(50) },
  { id: 'q-9', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-cs', chapter_id: 'ch-13', year: 2023, exam_type: 'compartment', question_text: 'Write a Python function that returns the n-th Fibonacci number using recursion.', question_type: 'other', paper_set: 'Set 1', marks: 3, difficulty: 'moderate', source: 'CBSE 2023', solution_resource_id: null, concepts: ['Recursion'], is_important: true, created_at: daysAgo(85), updated_at: daysAgo(85) },
  { id: 'q-10', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-english', chapter_id: 'ch-16', year: 2022, exam_type: 'board', question_text: 'Read the extract and answer the questions that follow (The Last Lesson).', question_type: 'case_study', paper_set: 'Set 1', marks: 6, difficulty: 'moderate', source: 'CBSE 2022', solution_resource_id: null, concepts: ['Comprehension'], is_important: false, created_at: daysAgo(95), updated_at: daysAgo(95) },
  { id: 'q-11', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-physics', chapter_id: 'ch-3', year: 2023, exam_type: 'board', question_text: 'Assertion (A): A moving charge produces a magnetic field. Reason (R): Magnetic force is always perpendicular to velocity.', question_type: 'assertion_reason', paper_set: 'Set 2', marks: 1, difficulty: 'moderate', source: 'CBSE 2023', solution_resource_id: null, concepts: ['Magnetism'], is_important: false, created_at: daysAgo(78), updated_at: daysAgo(78) },
  { id: 'q-12', board_id: 'b-cbse', class_id: 'c-12', subject_id: 'sub-physics', chapter_id: 'ch-4', year: 2020, exam_type: 'board', question_text: 'Derive the expression for the magnifying power of a simple microscope.', question_type: 'long_answer', paper_set: 'Set 1', marks: 5, difficulty: 'hard', source: 'CBSE 2020', solution_resource_id: null, concepts: ['Optics'], is_important: false, created_at: daysAgo(150), updated_at: daysAgo(150) },
]

/* ---------------------------------- users --------------------------------- */

export const DEMO_ADMINS_USERS: AdminUserRow[] = [
  { id: 'u-1', full_name: 'Aarav Sen', username: 'aarav', avatar_url: null, email: 'aarav@studyos.dev', role: 'super_admin', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-12', stream_id: 's-science', target_exam: 'JEE Main', created_at: daysAgo(420), last_active_at: daysAgo(0.1) },
  { id: 'u-2', full_name: 'Riya Mehta', username: 'riya', avatar_url: null, email: 'riya@studyos.dev', role: 'admin', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-12', stream_id: 's-science', target_exam: 'NEET', created_at: daysAgo(380), last_active_at: daysAgo(0.3) },
  { id: 'u-3', full_name: 'Kabir Bhatt', username: 'kabir', avatar_url: null, email: 'kabir@studyos.dev', role: 'content_editor', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-12', stream_id: 's-science', target_exam: 'CBSE Board', created_at: daysAgo(210), last_active_at: daysAgo(1.2) },
  { id: 'u-4', full_name: 'Sana Iyer', username: 'sana', avatar_url: null, email: 'sana@studyos.dev', role: 'moderator', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-12', stream_id: 's-science', target_exam: 'NEET', created_at: daysAgo(190), last_active_at: daysAgo(0.8) },
  { id: 'u-5', full_name: 'Dev Sharma', username: 'dev', avatar_url: null, email: 'dev@studyos.dev', role: 'student', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-12', stream_id: 's-science', target_exam: 'JEE Advanced', created_at: daysAgo(160), last_active_at: daysAgo(2) },
  { id: 'u-6', full_name: 'Ishita Roy', username: 'ishita', avatar_url: null, email: 'ishita@studyos.dev', role: 'student', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-12', stream_id: 's-science', target_exam: 'NEET', created_at: daysAgo(140), last_active_at: daysAgo(3.5) },
  { id: 'u-7', full_name: 'Rohan Das', username: 'rohan', avatar_url: null, email: 'rohan@studyos.dev', role: 'student', suspended: true, suspended_at: daysAgo(15), suspended_reason: 'Repeatedly uploaded broken resource links.', board_id: 'b-icse', class_id: 'c-12', stream_id: 's-commerce', target_exam: 'CA Foundation', created_at: daysAgo(120), last_active_at: daysAgo(16) },
  { id: 'u-8', full_name: 'Anaya Gupta', username: 'anaya', avatar_url: null, email: 'anaya@studyos.dev', role: 'student', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-isc', class_id: 'c-12', stream_id: 's-humanities', target_exam: 'CUET', created_at: daysAgo(95), last_active_at: daysAgo(0.6) },
  { id: 'u-9', full_name: 'Vihaan Nair', username: 'vihaan', avatar_url: null, email: 'vihaan@studyos.dev', role: 'student', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-11', stream_id: 's-science', target_exam: 'JEE Main', created_at: daysAgo(60), last_active_at: daysAgo(5) },
  { id: 'u-10', full_name: 'Meera Kulkarni', username: 'meera', avatar_url: null, email: 'meera@studyos.dev', role: 'student', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-mah', class_id: 'c-12', stream_id: 's-commerce', target_exam: 'CA Foundation', created_at: daysAgo(25), last_active_at: daysAgo(0.2) },
  { id: 'u-11', full_name: 'Aditya Verma', username: 'aditya', avatar_url: null, email: 'aditya@studyos.dev', role: 'student', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-cbse', class_id: 'c-12', stream_id: 's-commerce', target_exam: 'CUET', created_at: daysAgo(8), last_active_at: daysAgo(0.9) },
  { id: 'u-12', full_name: 'Tara Bose', username: 'tara', avatar_url: null, email: 'tara@studyos.dev', role: 'student', suspended: false, suspended_at: null, suspended_reason: null, board_id: 'b-wbchse', class_id: 'c-12', stream_id: 's-humanities', target_exam: 'CUET', created_at: daysAgo(2), last_active_at: daysAgo(0.05) },
]

/* --------------------------------- reports -------------------------------- */

export const DEMO_ADMINS_REPORTS: AdminReportRow[] = [
  { id: 'rep-1', reporter_id: 'u-5', report_type: 'wrong_answer', item_type: 'pyq_question', item_id: 'q-2', item_title: 'A wire of resistance R is stretched to twice its original length…', description: 'The marked answer states 2R, but stretching doubles the length and halves the area, so it should be 4R.', status: 'open', resolution_note: null, resolved_by: null, resolved_at: null, created_at: daysAgo(1.2) },
  { id: 'rep-2', reporter_id: 'u-6', report_type: 'broken_resource', item_type: 'resource', item_id: 'r-10', item_title: 'Relations & Functions — Reference Material', description: 'The download produces a 404 — no file appears to be attached.', status: 'open', resolution_note: null, resolved_by: null, resolved_at: null, created_at: daysAgo(0.7) },
  { id: 'rep-3', reporter_id: 'u-8', report_type: 'incorrect_question', item_type: 'pyq_question', item_id: 'q-12', item_title: 'Derive the expression for the magnifying power of a simple microscope.', description: 'Marks listed as 5 but the CBSE 2020 paper allocated 3 for this question.', status: 'investigating', resolution_note: null, resolved_by: null, resolved_at: null, created_at: daysAgo(4) },
  { id: 'rep-4', reporter_id: 'u-9', report_type: 'duplicate_content', item_type: 'resource', item_id: 'r-7', item_title: 'Oscillations — Legacy Notes', description: 'This chapter is no longer in the syllabus — should it still appear in the library?', status: 'resolved', resolution_note: 'Archived the resource and the chapter; both are now hidden from students.', resolved_by: 'u-4', resolved_at: daysAgo(3), created_at: daysAgo(6) },
  { id: 'rep-5', reporter_id: 'u-11', report_type: 'inappropriate_content', item_type: 'resource', item_id: 'r-8', item_title: 'Flamingo — Prose Summary Notes', description: 'Reported as spam.', status: 'dismissed', resolution_note: 'Reviewed — the material is legitimate CBSE prose analysis. No action needed.', resolved_by: 'u-4', resolved_at: daysAgo(2), created_at: daysAgo(5) },
  { id: 'rep-6', reporter_id: 'u-10', report_type: 'other', item_type: 'chapter', item_id: 'ch-6', item_title: 'Solutions', description: 'Would be helpful to have a video lecture for this chapter as well.', status: 'open', resolution_note: null, resolved_by: null, resolved_at: null, created_at: daysAgo(0.3) },
]

/* -------------------------------- audit log ------------------------------- */

export const DEMO_ADMINS_AUDIT: AuditLogRow[] = [
  { id: 'a-1', actor_id: 'u-2', action: 'resource.published', entity_type: 'resource', entity_id: 'r-5', metadata: { title: 'Computer Science — Sample Paper 2026' }, created_at: daysAgo(12) },
  { id: 'a-2', actor_id: 'u-2', action: 'resource.archived', entity_type: 'resource', entity_id: 'r-7', metadata: { reason: 'Removed from the 2026 syllabus' }, created_at: daysAgo(40) },
  { id: 'a-3', actor_id: 'u-1', action: 'user.role_changed', entity_type: 'profile', entity_id: 'u-4', metadata: { role: 'moderator' }, created_at: daysAgo(180) },
  { id: 'a-4', actor_id: 'u-1', action: 'user.suspended', entity_type: 'profile', entity_id: 'u-7', metadata: { reason: 'Repeatedly uploaded broken resource links.' }, created_at: daysAgo(15) },
  { id: 'a-5', actor_id: 'u-4', action: 'report.resolved', entity_type: 'report', entity_id: 'rep-4', metadata: { status: 'resolved' }, created_at: daysAgo(3) },
  { id: 'a-6', actor_id: 'u-3', action: 'resource.created', entity_type: 'resource', entity_id: 'r-4', metadata: { title: 'Integrals — Important Questions' }, created_at: daysAgo(2) },
  { id: 'a-7', actor_id: 'u-2', action: 'resource.reviewed', entity_type: 'resource', entity_id: 'r-6', metadata: { status: 'rejected' }, created_at: daysAgo(6) },
  { id: 'a-8', actor_id: 'u-1', action: 'subject.updated', entity_type: 'subject', entity_id: 'sub-cs', metadata: { display_order: 5 }, created_at: daysAgo(20) },
]
