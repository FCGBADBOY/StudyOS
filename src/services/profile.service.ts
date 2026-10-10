/**
 * Profile service — `public.profiles` (one row per authenticated user).
 *
 * The row is created automatically by a database trigger when a user signs up
 * (see `supabase/migrations/*_profiles.sql`); `ensureProfile` is the safety
 * net for accounts created before that migration and for Google sign-in
 * metadata updates.
 *
 * Demo mode (no backend) edits are stored in localStorage so profile changes
 * survive a refresh even without Supabase.
 */
import type { Achievement, ProfileUser } from '@/types'
import type { AuthUser, ProfilePatch, ProfileRow } from '@/types/auth'
import { PROFILE as DEMO_PROFILE } from '@/data/profile'
import { readLocal, writeLocal } from '@/utils/storage'
import { db, forgetMemo, initialsOf, isDemo, memo, one } from './shared'
import { getBoards, getClasses, getStreams, getSubjects } from './academic.service'
import { getHistory, getStats, loadActivity } from './progress.service'

const DEMO_KEY = 'profile-local'

/* ------------------------------- demo profile ---------------------------- */

export function getDemoProfile(): ProfileUser {
  const overlay = readLocal<Partial<ProfileUser>>(DEMO_KEY, {})
  const merged: ProfileUser = { ...DEMO_PROFILE, ...overlay }
  return { ...merged, initials: initialsOf(merged.name) }
}

/* ------------------------------- row access ------------------------------ */

async function currentUid(): Promise<string | null> {
  const client = db()
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

/** Raw row for the signed-in user (or `null`). */
export async function getProfileRow(): Promise<ProfileRow | null> {
  if (isDemo) return null
  const client = db()
  const uid = await currentUid()
  if (!client || !uid) return null

  return memo(`profile:${uid}`, async () => {
    const row = await one<ProfileRow>(client.from('profiles').select('*').eq('id', uid).maybeSingle())
    return row
  })
}

/**
 * Make sure a profile row exists and mirrors the OAuth identity.
 * Called once when the session becomes available.
 */
export async function ensureProfile(user: AuthUser): Promise<void> {
  if (isDemo) return
  const client = db()
  if (!client) return

  const existing = await one<ProfileRow>(client.from('profiles').select('*').eq('id', user.id).maybeSingle())

  if (!existing) {
    const { error } = await client.from('profiles').insert({
      id: user.id,
      full_name: user.name,
      avatar_url: user.avatarUrl,
      username: user.email ? user.email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').toLowerCase() : null,
    })
    if (error && !/duplicate key|unique constraint/i.test(error.message)) throw new Error(error.message)

    /* Give the fresh account the seeded exams for its (empty) board later —
       exam cloning happens once the student picks a board in onboarding. */
    forgetMemo(`profile:${user.id}`)
    return
  }

  /* Keep name/avatar in sync with Google (only if the student never edited). */
  const patch: ProfilePatch = {}
  if (!existing.full_name && user.name) patch.full_name = user.name
  if (!existing.avatar_url && user.avatarUrl) patch.avatar_url = user.avatarUrl
  if (Object.keys(patch).length) {
    await client.from('profiles').update(patch).eq('id', user.id)
    forgetMemo(`profile:${user.id}`)
  }
}

/* --------------------------------- read ---------------------------------- */

/** The UI profile payload (identity + academic labels + real statistics). */
export async function getProfile(): Promise<ProfileUser> {
  if (isDemo) return getDemoProfile()

  const row = await getProfileRow()
  const [boards, classes, streams, stats, history, activity] = await Promise.all([
    getBoards(),
    getClasses(),
    getStreams(),
    getStats(),
    getHistory(6),
    loadActivity(),
  ])

  const board = boards.find((entry) => entry.id === row?.board_id) ?? boards[0]
  const classOption = classes.find((entry) => entry.id === row?.class_id) ?? classes.find((entry) => entry.senior) ?? classes[0]
  const stream = streams.find((entry) => entry.id === row?.stream_id)

  let subjects = stats.subjects
  if (!subjects.length && classOption) {
    const list = await getSubjects({ classId: classOption.id, streamId: stream?.id })
    subjects = list.map((subject) => subject.slug)
  }

  const syllabus = activity.chapters.length
    ? Math.round((activity.progress.filter((p) => p.completion_percent >= 100).length / activity.chapters.length) * 100)
    : 0

  const name = row?.full_name ?? row?.username ?? 'Student'

  return {
    name,
    username: row?.username ?? (row?.id ? row.id.slice(0, 8) : 'student'),
    avatar: row?.avatar_url ?? '',
    initials: initialsOf(name),
    board: (board?.id ?? 'cbse') as ProfileUser['board'],
    boardName: board?.name ?? 'CBSE',
    classId: (classOption?.id ?? 'class-12') as ProfileUser['classId'],
    className: classOption?.name ?? 'Class 12',
    streamId: stream?.id as ProfileUser['streamId'],
    streamName: stream?.name,
    school: row?.school ?? '—',
    targetExam: row?.target_exam ?? (board ? `${board.name} ${classOption?.name ?? ''}`.trim() : 'Board exams'),
    joined: row?.created_at ?? new Date().toISOString(),
    streak: stats.streak,
    questionsSolved: stats.totalAttempts,
    chaptersCompleted: stats.chaptersCompleted,
    studyMinutes: stats.studyMinutes,
    subjects: subjects as ProfileUser['subjects'],
    achievements: buildAchievements(stats.streak, stats.totalAttempts, stats.chaptersCompleted, stats.accuracy, syllabus),
    history,
    savedResources: stats.savedResources,
  }
}

/** Rule-based badges — earned from real numbers, never pre-set. */
export function buildAchievements(
  streak: number,
  questions: number,
  chapters: number,
  accuracy: number,
  syllabus: number,
): Achievement[] {
  const defs: Achievement[] = [
    { id: 'ach-streak-7', title: 'Week Warrior', description: 'Studied 7 days in a row', icon: 'flame', earned: streak >= 7 },
    { id: 'ach-1000', title: 'Question Machine', description: 'Solved 1,000+ questions', icon: 'target', earned: questions >= 1000 },
    {
      id: 'ach-electro',
      title: 'Circuit Master',
      description: 'Completed a chapter with 90%+ accuracy',
      icon: 'zap',
      earned: chapters > 0 && accuracy >= 90,
    },
    { id: 'ach-pyq-50', title: 'PYQ Hunter', description: 'Solved 50 previous-year questions', icon: 'book', earned: questions >= 50 },
    {
      id: 'ach-streak-30',
      title: 'Unbreakable',
      description: 'Maintain a 30-day study streak',
      icon: 'flame',
      earned: streak >= 30,
      progress: streak >= 30 ? undefined : Math.min(99, Math.round((streak / 30) * 100)),
    },
    {
      id: 'ach-syllabus',
      title: 'Full Syllabus',
      description: 'Complete 100% of the syllabus',
      icon: 'trophy',
      earned: syllabus >= 100,
      progress: syllabus >= 100 ? undefined : syllabus,
    },
  ]
  return defs
}

/* --------------------------------- write --------------------------------- */

export async function updateProfile(patch: ProfilePatch): Promise<ProfileUser> {
  if (isDemo) {
    const current = getDemoProfile()
    writeLocal(DEMO_KEY, {
      ...current,
      ...(patch.full_name != null ? { name: patch.full_name } : {}),
      ...(patch.username ? { username: patch.username } : {}),
      ...(patch.avatar_url != null ? { avatar: patch.avatar_url } : {}),
      ...(patch.school ? { school: patch.school } : {}),
      ...(patch.target_exam ? { targetExam: patch.target_exam } : {}),
    })
    return getDemoProfile()
  }

  const client = db()
  const uid = await currentUid()
  if (!client || !uid) throw new Error('Sign in to edit your profile.')

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  Object.entries(patch).forEach(([key, value]) => {
    if (value !== undefined) payload[key] = value
  })

  const { error } = await client.from('profiles').update(payload).eq('id', uid)
  if (error) throw new Error(error.message)
  forgetMemo(`profile:${uid}`)

  return getProfile()
}

/** Validate + upload an avatar, then persist its public URL. */
export async function uploadAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).')
  if (file.size > 2 * 1024 * 1024) throw new Error('That image is larger than 2 MB — pick a smaller one.')

  if (isDemo) {
    const url = await readAsDataUrl(file)
    const current = getDemoProfile()
    writeLocal(DEMO_KEY, { ...current, avatar: url })
    return url
  }

  const client = db()
  const uid = await currentUid()
  if (!client || !uid) throw new Error('Sign in to change your photo.')

  const extension = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${uid}/avatar-${Date.now()}.${extension}`

  const { error } = await client.storage.from('avatars').upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: file.type,
  })
  if (error) throw new Error('Upload failed — please try a different image.')

  const { data } = client.storage.from('avatars').getPublicUrl(path)
  await updateProfile({ avatar_url: data.publicUrl })
  return data.publicUrl
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}
