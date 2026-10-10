/**
 * StudyOS domain model.
 *
 * Every shape here is intentionally backend-shaped: ids are strings, dates are
 * ISO strings and relations reference ids/slugs. When a real API is connected,
 * the same types can be returned by the server without touching the UI.
 */

/* ------------------------------- academics -------------------------------- */

export type BoardId = 'cbse' | 'icse' | 'isc' | 'state-boards' | 'other'

export interface Board {
  id: BoardId
  name: string
  short: string
  description: string
  classCount: number
  resourceCount: number
}

export type ClassId =
  | 'class-9'
  | 'class-10'
  | 'class-11'
  | 'class-12'
  | 'other'

export interface ClassOption {
  id: ClassId
  name: string
  description: string
  senior: boolean
}

export type StreamId = 'science' | 'commerce' | 'humanities'

export interface StreamOption {
  id: StreamId
  name: string
  description: string
  subjects: string[]
}

export type SubjectId =
  | 'physics'
  | 'chemistry'
  | 'mathematics'
  | 'english'
  | 'computer-science'

export type Difficulty = 'Easy' | 'Moderate' | 'Hard'

export interface Chapter {
  id: string
  slug: string
  index: number
  title: string
  shortTitle: string
  description: string
  progress: number // 0 – 100
  difficulty: Difficulty
  questionCount: number
  pyqCount: number
  estimatedMinutes: number
  topics: string[]
  favorite?: boolean
  weak?: boolean
}

export interface Subject {
  id: SubjectId
  name: string
  short: string
  slug: string
  description: string
  accent: 'physics' | 'chemistry' | 'mathematics' | 'english' | 'computer'
  teacher: string
  totalChapters: number
  completedChapters: number
  progress: number
  questionCount: number
  accuracy: number
  revisionMinutes: number
  chapters: Chapter[]
}

export type ResourceType =
  | 'notes'
  | 'pyq'
  | 'sample-paper'
  | 'important-questions'
  | 'formula-sheet'
  | 'diagram'
  | 'revision'
  | 'video'
  | 'reference'

export interface Resource {
  id: string
  type: ResourceType
  title: string
  subjectId: SubjectId
  chapterSlug?: string
  description: string
  meta: string
  size?: string
  pages?: number
  questions?: number
  updated: string
  bookmarked?: boolean
  downloaded?: boolean
}

/* --------------------------------- exam ----------------------------------- */

export interface Exam {
  id: string
  name: string
  board: BoardId
  classId: ClassId
  date: string // ISO date
  subjects: SubjectId[]
  color: 'brand' | 'accent' | 'warning' | 'danger'
}

/* ------------------------------- study data ------------------------------- */

export type Priority = 'High' | 'Medium' | 'Low'

export interface StudySession {
  id: string
  subjectId: SubjectId
  subjectName: string
  topic: string
  duration: number // minutes
  priority: Priority
  completed: boolean
  time?: string
  notes?: string
}

export interface WeeklyPlanDay {
  id: string
  day: string
  date: string
  sessions: StudySession[]
  plannedMinutes: number
  doneMinutes: number
}

export interface TodayFocus {
  id: string
  title: string
  subjectId: SubjectId
  subjectName: string
  minutes: number
  difficulty: Difficulty
  progress: number
  reason: string
}

export interface QuickAction {
  id: string
  label: string
  hint: string
  to: string
  icon: 'sparkles' | 'scan' | 'file-text' | 'sigma' | 'book-marked'
}

export interface ContinueItem {
  id: string
  subjectId: SubjectId
  subjectName: string
  chapterSlug: string
  chapter: string
  progress: number
  lastStudied: string
  minutesLeft: number
}

export interface ProgressSnapshot {
  weekMinutes: number
  questionsSolved: number
  accuracy: number
  streak: number
}

/* ------------------------------- progress --------------------------------- */

export interface DayStudy {
  day: string
  minutes: number
  questions: number
}

export interface SubjectStat {
  subjectId: SubjectId
  subjectName: string
  accuracy: number
  questions: number
  minutes: number
  trend: number // percentage point change vs last week
}

export interface TopicStat {
  topic: string
  subjectId: SubjectId
  value: number // 0-100 mastery or weakness score
}

export interface ProgressReport {
  weekMinutes: number
  weekMinutesTrend: number
  questionsSolved: number
  questionsTrend: number
  averageAccuracy: number
  accuracyTrend: number
  chaptersCompleted: number
  streak: number
  daily: DayStudy[]
  subjectStats: SubjectStat[]
  strongest: TopicStat[]
  weakest: TopicStat[]
  rings: { label: string; value: number; color: string }[]
  monthlyGoalMinutes: number
  completedGoalMinutes: number
}

/* ---------------------------------- PYQ ----------------------------------- */

export type PyqDifficulty = 'Easy' | 'Medium' | 'Hard'
export type PriorityLevel = 'HIGH PRIORITY' | 'MEDIUM PRIORITY' | 'LOW PRIORITY'

export interface PyqQuestion {
  id: string
  question: string
  year: number
  board: string
  subjectId: SubjectId
  chapterSlug: string
  chapter: string
  marks: number
  difficulty: PyqDifficulty
  type: 'MCQ' | 'VSA' | 'SA' | 'LA' | 'Case-based' | 'AR' | 'Numerical' | 'Other'
  concepts: string[]
  repeated: boolean
  /** Tagged by the content team as high-probability. */
  important?: boolean
}

export interface ConceptFrequency {
  id: string
  title: string
  subjectId: SubjectId
  chapter: string
  appearances: number
  priority: PriorityLevel
  years: number[]
  marks: number
  difficulty: PyqDifficulty
  trend: number[]
}

export interface PyqSubjectStat {
  subjectId: SubjectId
  subjectName: string
  questions: number
  chaptersCovered: number
  repeatRate: number
}

export interface PyqDifficultySlice {
  label: PyqDifficulty
  value: number
}

export interface PyqPaper {
  id: string
  slug: string
  year: number
  board: string
  classId: ClassId
  subjectId: SubjectId
  subjectName: string
  set: string
  duration: string
  marks: number
  sections: { name: string; questions: string; marks: string }[]
  questions: PyqQuestion[]
}

export interface PyqOverview {
  questionsAnalyzed: number
  papersScanned: number
  yearsCovered: number
  repeatRate: number
  topConcepts: ConceptFrequency[]
  frequentChapters: { chapter: string; subjectId: SubjectId; count: number }[]
  difficulty: PyqDifficultySlice[]
  subjectStats: PyqSubjectStat[]
}

/* ------------------------------ mistake book ------------------------------ */

export type MistakeType =
  | 'Conceptual'
  | 'Calculation'
  | 'Formula'
  | 'Sign error'
  | 'Careless mistake'
  | 'Memory'
  | 'Other'

export interface Mistake {
  id: string
  question: string
  myAnswer: string
  correctConcept: string
  subjectId: SubjectId
  subjectName: string
  chapter: string
  chapterSlug: string
  date: string
  type: MistakeType
  solvedCount: number
  reviewed: boolean
  marks: number
}

/* -------------------------------- planner --------------------------------- */

/* ------------------------------ formula flow ------------------------------ */

export interface FormulaVariable {
  symbol: string
  meaning: string
  unit: string
}

export interface Formula {
  id: string
  title: string
  expression: string
  subjectId: SubjectId
  chapter: string
  topic: string
  variables: FormulaVariable[]
  related: { title: string; expression: string }[]
  commonMistakes: string[]
  siUnit: string
  tags: string[]
}

/* ------------------------------- reaction lab ----------------------------- */

export interface ReactionStep {
  id: string
  label: string
  detail: string
}

export interface Reaction {
  id: string
  slug: string
  name: string
  family: string
  subjectId: SubjectId
  chapter: string
  reactants: string[]
  reagents: string[]
  conditions: string
  products: string[]
  equation: string
  mechanism: string[]
  keyPoints: string[]
  steps: ReactionStep[]
}

/* --------------------------------- search --------------------------------- */

export type SearchCategory =
  | 'All'
  | 'Notes'
  | 'PYQs'
  | 'Formulas'
  | 'Questions'
  | 'Chapters'

export interface SearchResult {
  id: string
  title: string
  category: Exclude<SearchCategory, 'All'>
  meta: string
  snippet: string
  to: string
  subjectId?: SubjectId
}

/* --------------------------------- profile -------------------------------- */

export interface Achievement {
  id: string
  title: string
  description: string
  icon: 'flame' | 'target' | 'trophy' | 'book' | 'zap' | 'star'
  earned: boolean
  progress?: number
}

export interface HistoryEntry {
  id: string
  date: string
  title: string
  subjectId: SubjectId
  minutes: number
  questions: number
}

export interface ProfileUser {
  name: string
  username: string
  avatar: string
  initials: string
  board: BoardId
  boardName: string
  classId: ClassId
  className: string
  streamId?: StreamId
  streamName?: string
  school: string
  targetExam: string
  joined: string
  streak: number
  questionsSolved: number
  chaptersCompleted: number
  studyMinutes: number
  subjects: SubjectId[]
  achievements: Achievement[]
  history: HistoryEntry[]
  savedResources: number
}

/* ------------------------------ notifications ----------------------------- */

export interface NotificationItem {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  kind: 'exam' | 'streak' | 'system' | 'progress'
}

/* --------------------------- onboarding answers --------------------------- */

export interface OnboardingAnswers {
  board?: BoardId
  classId?: ClassId
  streamId?: StreamId
  subjects: SubjectId[]
  examDate?: string
  examName?: string
  dailyGoalMinutes: number
}

/* -------------------------------- UI types -------------------------------- */

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface UserPreferences {
  theme: ThemePreference
  notifications: boolean
  studyReminders: boolean
  reminderTime: string
  haptics: boolean
  reduceMotion: boolean
  language: string
  defaultBoard: BoardId
  defaultClass: ClassId
  fontScale: 'small' | 'default' | 'large'
}
