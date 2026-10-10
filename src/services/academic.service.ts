/**
 * Academic hierarchy service: boards → classes → streams → subjects → chapters.
 *
 * Returns the UI's existing shapes so no screen had to change its vocabulary.
 * Nothing is hard-coded to CBSE: rows come from the database, so any board,
 * class, stream, subject or chapter can be added with data only.
 */
import { BOARDS as DEMO_BOARDS, CLASSES as DEMO_CLASSES, STREAMS as DEMO_STREAMS } from '@/data/boards'
import {
  SUBJECTS as DEMO_SUBJECTS,
  findChapterBySlug,
  getChapter,
  getSubject as getDemoSubject,
} from '@/data/subjects'
import type { Board, Chapter, ClassOption, StreamOption, Subject, SubjectId } from '@/types'
import type { BoardRow, ChapterRow, ClassRow, StreamRow, SubjectRow, SubjectFilter } from '@/types/academic'
import { chapterKey, db, isDemo, memo, rows, toSubjectId } from './shared'
import { getChapterProgressMap, getSubjectActivity, type ActivityData } from './progress.service'
import { getBookmarkedKeys } from './bookmark.service'

/* --------------------------------- helpers -------------------------------- */

function subjectAccentOf(slug: string): Subject['accent'] {
  if (slug === 'computer-science') return 'computer'
  if (slug === 'mathematics') return 'mathematics'
  if (slug === 'english') return 'english'
  if (slug === 'chemistry') return 'chemistry'
  return 'physics'
}

/** Resolve URL slugs → row ids (returns `null` when nothing matches). */
async function resolveFilter(filter: SubjectFilter = {}) {
  const client = db()
  if (!client) return null

  const [boards, classes, streams] = await Promise.all([
    rows<BoardRow>(client.from('boards').select('*')),
    rows<ClassRow>(client.from('classes').select('*')),
    rows<StreamRow>(client.from('streams').select('*')),
  ])

  return {
    boards,
    classes,
    streams,
    boardId: filter.board ? boards.find((row) => row.slug === filter.board)?.id ?? null : null,
    classId: filter.classId ? classes.find((row) => row.slug === filter.classId)?.id ?? null : null,
    streamId: filter.streamId ? streams.find((row) => row.slug === filter.streamId)?.id ?? null : null,
  }
}

/* ------------------------------- boards/classes --------------------------- */

export async function getBoards(): Promise<Board[]> {
  if (isDemo) return DEMO_BOARDS

  const client = db()
  if (!client) return DEMO_BOARDS

  return memo('boards', async () => {
    const [boardRows, classRows, subjectRows, chapterRows, resourceRows] = await Promise.all([
      rows<BoardRow>(client.from('boards').select('*').order('display_order')),
      rows<ClassRow>(client.from('classes').select('*').order('display_order')),
      rows<{ id: string; board_id: string | null }>(client.from('subjects').select('id, board_id')),
      rows<{ id: string; subject_id: string }>(client.from('chapters').select('id, subject_id')),
      rows<{ chapter_id: string }>(
        client.from('resources').select('chapter_id').eq('is_published', true),
      ),
    ])

    const chaptersBySubject = new Map<string, string[]>()
    chapterRows.forEach((chapter) => {
      const list = chaptersBySubject.get(chapter.subject_id) ?? []
      list.push(chapter.id)
      chaptersBySubject.set(chapter.subject_id, list)
    })

    const resourceCountByBoard = new Map<string, number>()
    let shared = 0
    subjectRows.forEach((subject) => {
      const chapterIds = chaptersBySubject.get(subject.id) ?? []
      const count = resourceRows.filter((resource) => chapterIds.includes(resource.chapter_id)).length
      if (subject.board_id) {
        resourceCountByBoard.set(subject.board_id, (resourceCountByBoard.get(subject.board_id) ?? 0) + count)
      } else {
        shared += count
      }
    })

    return boardRows.map<Board>((board) => ({
      id: board.slug as Board['id'],
      name: board.name,
      short: board.short_name,
      description: board.description ?? '',
      classCount: classRows.length,
      resourceCount: (resourceCountByBoard.get(board.id) ?? 0) + shared,
    }))
  })
}

export async function getClasses(): Promise<ClassOption[]> {
  if (isDemo) return DEMO_CLASSES
  const client = db()
  if (!client) return DEMO_CLASSES

  return memo('classes', async () => {
    const list = await rows<ClassRow>(client.from('classes').select('*').order('display_order'))
    return list.map<ClassOption>((row) => ({
      id: row.slug as ClassOption['id'],
      name: row.name,
      description: row.description ?? '',
      senior: row.senior,
    }))
  })
}

export async function getStreams(): Promise<StreamOption[]> {
  if (isDemo) return DEMO_STREAMS
  const client = db()
  if (!client) return DEMO_STREAMS

  return memo('streams', async () => {
    const [streamRows, subjectRows] = await Promise.all([
      rows<StreamRow>(client.from('streams').select('*').order('display_order')),
      rows<SubjectRow>(client.from('subjects').select('*')),
    ])

    return streamRows.map<StreamOption>((row) => ({
      id: row.slug as StreamOption['id'],
      name: row.name,
      description: row.description ?? '',
      subjects: subjectRows
        .filter((subject) => subject.stream_id === row.id || subject.stream_id === null)
        .sort((a, b) => a.display_order - b.display_order)
        .map((subject) => subject.slug),
    }))
  })
}

/* -------------------------------- subjects -------------------------------- */

/** Subject rows for a hierarchy filter (plus every chapter they own). */
async function loadSubjectRows(filter: SubjectFilter = {}): Promise<{ subjects: SubjectRow[]; chapters: ChapterRow[] }> {
  const client = db()
  if (!client) return { subjects: [], chapters: [] }

  const resolved = await resolveFilter(filter)
  if (!resolved) return { subjects: [], chapters: [] }

  let query = client.from('subjects').select('*').order('display_order')
  if (resolved.classId) query = query.eq('class_id', resolved.classId)
  if (resolved.streamId) query = query.or(`stream_id.eq.${resolved.streamId},stream_id.is.null`)
  if (resolved.boardId) query = query.or(`board_id.eq.${resolved.boardId},board_id.is.null`)

  const subjects = await rows<SubjectRow>(query)
  if (!subjects.length) return { subjects, chapters: [] }

  const chapters = await rows<ChapterRow>(
    client
      .from('chapters')
      .select('*')
      .in(
        'subject_id',
        subjects.map((subject) => subject.id),
      )
      .order('display_order'),
  )

  return { subjects, chapters }
}

/**
 * Full `Subject[]` (with chapters, per-chapter progress, PYQ counts, accuracy
 * and bookmark flags) — the payload behind the Library screens.
 */
export async function getSubjects(filter: SubjectFilter = {}): Promise<Subject[]> {
  if (isDemo) return DEMO_SUBJECTS

  const { subjects, chapters } = await loadSubjectRows(filter)
  if (!subjects.length) return []

  const [progressMap, activity, bookmarks, pyqCounts] = await Promise.all([
    getChapterProgressMap(),
    getSubjectActivity(),
    getBookmarkedKeys(),
    getPyqCountsByChapter(),
  ])

  return subjects.map((subject) => {
    const own = chapters.filter((chapter) => chapter.subject_id === subject.id)
    const uiChapters: Chapter[] = own.map((chapter, index) => buildChapter(subject, chapter, index, {
      progressMap,
      activity,
      bookmarks,
      pyqCounts,
    }))

    const completed = uiChapters.filter((chapter) => chapter.progress >= 100).length
    const progress = uiChapters.length
      ? Math.round(uiChapters.reduce((sum, chapter) => sum + chapter.progress, 0) / uiChapters.length)
      : 0
    const stats = activity.bySubject.get(subject.slug)

    return {
      id: toSubjectId(subject.slug),
      name: subject.name,
      short: subject.name.slice(0, 3),
      slug: subject.slug,
      description: subject.description ?? '',
      accent: subjectAccentOf(subject.slug),
      teacher: '',
      totalChapters: uiChapters.length,
      completedChapters: completed,
      progress,
      questionCount: stats?.questions ?? 0,
      accuracy: stats?.accuracy ?? 0,
      revisionMinutes: stats?.minutes ?? 0,
      chapters: uiChapters,
    } satisfies Subject
  })
}

/** PYQ volume per chapter (drives `chapter.pyqCount`). */
async function getPyqCountsByChapter(): Promise<Map<string, number>> {
  const client = db()
  if (!client) return new Map()

  const list = await rows<{ chapter_id: string | null }>(
    client.from('pyq_questions').select('chapter_id'),
  )
  const counts = new Map<string, number>()
  list.forEach((row) => {
    if (!row.chapter_id) return
    counts.set(row.chapter_id, (counts.get(row.chapter_id) ?? 0) + 1)
  })
  return counts
}

interface ChapterContext {
  progressMap: Map<string, number>
  activity: ActivityData
  bookmarks: Set<string>
  pyqCounts: Map<string, number>
}

function buildChapter(subject: SubjectRow, chapter: ChapterRow, index: number, ctx: ChapterContext): Chapter {
  const key = chapterKey(subject.slug, chapter.slug)
  const progress = ctx.progressMap.get(chapter.id) ?? 0
  const stats = ctx.activity.byChapter.get(chapter.id)
  const pyqCount = ctx.pyqCounts.get(chapter.id) ?? 0
  const weak = Boolean(stats && stats.attempts > 0 && stats.accuracy < 50)

  return {
    id: key,
    slug: chapter.slug,
    index: chapter.chapter_number || index + 1,
    title: chapter.name,
    shortTitle: chapter.name,
    description: chapter.description ?? '',
    progress,
    difficulty: chapter.difficulty,
    questionCount: pyqCount,
    pyqCount,
    estimatedMinutes: chapter.estimated_minutes,
    topics: chapter.topics ?? [],
    favorite: ctx.bookmarks.has(key),
    weak,
  }
}

/** One subject (with chapters) by slug — used by PYQ + dashboard deep links. */
export async function getSubject(subjectId?: string, filter: SubjectFilter = {}): Promise<Subject | undefined> {
  if (!subjectId) return undefined
  if (isDemo) return getDemoSubject(subjectId)

  const list = await getSubjects(filter)
  const direct = list.find((subject) => subject.id === subjectId || subject.slug === subjectId)
  if (direct) return direct

  /* No hierarchy in the URL (PYQ routes) → fall back to any class. */
  const any = await getSubjects({})
  return any.find((subject) => subject.id === subjectId || subject.slug === subjectId)
}

/** Chapter lookup used by the Library chapter page. */
export async function getChapterEntry(
  subjectId?: string,
  chapterSlug?: string,
  filter: SubjectFilter = {},
): Promise<{ subject: Subject; chapter: Chapter } | undefined> {
  if (!subjectId || !chapterSlug) return undefined
  if (isDemo) return getChapter(subjectId, chapterSlug)

  const subject = await getSubject(subjectId, filter)
  if (!subject) return undefined
  const chapter = subject.chapters.find((entry) => entry.slug === chapterSlug)
  return chapter ? { subject, chapter } : undefined
}

/** Resolve a chapter slug across every subject (global search / deep links). */
export async function findChapterEntry(
  chapterSlug: string,
  filter: SubjectFilter = {},
): Promise<{ subject: Subject; chapter: Chapter } | undefined> {
  if (isDemo) return findChapterBySlug(chapterSlug)

  const list = await getSubjects(filter)
  for (const subject of list) {
    const chapter = subject.chapters.find((entry) => entry.slug === chapterSlug)
    if (chapter) return { subject, chapter }
  }
  return undefined
}
