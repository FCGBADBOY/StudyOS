/**
 * Student-facing provenance reads.
 *
 * `source_provenance` is publicly readable by design (spec §51): if StudyOS
 * used someone else's material, the record of where it came from is part of
 * the content, not an admin-only detail.
 *
 * Reads are best-effort. A failure resolves to an empty list rather than
 * throwing, because a missing attribution footnote must never stop a student
 * from opening a chapter — the section simply does not render.
 */
import { db, isDemo, rows } from './shared'
import type { SourceProvenanceRow } from '@/content-engine/types'

/** Attribution records attached to one chapter's published material. */
export async function getChapterProvenance(chapterId: string): Promise<SourceProvenanceRow[]> {
  if (isDemo || !chapterId) return []
  const client = db()
  if (!client) return []

  try {
    return await rows<SourceProvenanceRow>(
      client
        .from('source_provenance')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: false })
        .limit(12),
    )
  } catch {
    return []
  }
}
