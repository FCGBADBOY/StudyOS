/**
 * Bookmarks / favourites service.
 *
 * The UI keeps favourite ids as stable strings (`chapter:<subject>:<slug>`,
 * `resource:<id>`, `pyq:<subject>:<year>`), so bookmarks persist across devices
 * while the existing `FavoriteButton` / `useFavorites` API stays untouched.
 *
 * Demo mode (no backend) keeps using the local `favorites` list, which is
 * already persisted in localStorage — bookmarks therefore survive a reload
 * even without a backend.
 */
import { readLocal, writeLocal } from '@/utils/storage'
import { db, isDemo, memo, resetMemo, rows } from './shared'
import type { BookmarkRow } from '@/types/planner'

const LOCAL_KEY = 'favorites'
/** First-run sample pin (removed as soon as the student toggles anything). */
const DEFAULT_FAVORITES = ['chapter:chemistry:alcohols-phenols-and-ethers']

/* --------------------------------- reads --------------------------------- */

/** Every bookmarked target key for the signed-in user. */
export async function getBookmarkedKeys(): Promise<Set<string>> {
  if (isDemo) return new Set(readLocal<string[]>(LOCAL_KEY, DEFAULT_FAVORITES))

  const client = db()
  if (!client) return new Set()
  const { data } = await client.auth.getUser()
  if (!data.user) return new Set()

  return memo(`bookmarks:${data.user.id}`, async () => {
    const list = await rows<BookmarkRow>(
      client.from('bookmarks').select('*').order('created_at', { ascending: false }),
    )
    return new Set(list.map((row) => row.target_key))
  })
}

/** Alias used by screens that prefer a list. */
export async function getBookmarks(): Promise<string[]> {
  return Array.from(await getBookmarkedKeys())
}

/* -------------------------------- mutations ------------------------------ */

/**
 * Add/remove a bookmark. Returns `true` when the item is bookmarked *after*
 * the call, so callers can update their UI optimistically.
 */
export async function toggleBookmark(
  targetKey: string,
  meta: { type?: 'resource' | 'chapter' | 'pyq' | 'question'; resourceId?: string; chapterId?: string; questionId?: string } = {},
): Promise<boolean> {
  const current = await getBookmarkedKeys()
  const removing = current.has(targetKey)

  if (isDemo) {
    const next = new Set(current)
    if (removing) next.delete(targetKey)
    else next.add(targetKey)
    writeLocal(LOCAL_KEY, Array.from(next))
    return !removing
  }

  const client = db()
  if (!client) return !removing
  const { data } = await client.auth.getUser()
  if (!data.user) return !removing

  if (removing) {
    const { error } = await client.from('bookmarks').delete().eq('user_id', data.user.id).eq('target_key', targetKey)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await client.from('bookmarks').insert({
      user_id: data.user.id,
      target_type: meta.type ?? inferType(targetKey),
      target_key: targetKey,
      resource_id: meta.resourceId ?? null,
      chapter_id: meta.chapterId ?? null,
      question_id: meta.questionId ?? null,
    })
    if (error && !/duplicate key|unique constraint/i.test(error.message)) throw new Error(error.message)
  }

  /* Keep the local mirror so demo/anonymous reads still work offline. */
  const next = new Set(current)
  if (removing) next.delete(targetKey)
  else next.add(targetKey)
  writeLocal(LOCAL_KEY, Array.from(next))
  resetMemo()

  return !removing
}

export async function removeBookmark(targetKey: string): Promise<void> {
  await toggleBookmark(targetKey)
}

function inferType(targetKey: string): 'resource' | 'chapter' | 'pyq' | 'question' {
  const [kind] = targetKey.split(':')
  if (kind === 'chapter') return 'chapter'
  if (kind === 'resource') return 'resource'
  if (kind === 'pyq') return 'pyq'
  return 'question'
}
