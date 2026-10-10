/**
 * Conversation history for the AI Tutor.
 *
 * Reads/writes go straight to `ai_conversations` / `ai_messages` with the
 * user's own session — row-level security means a student can only ever see
 * their own threads, and the edge functions additionally scope by user id.
 *
 * Nothing here is privileged: no provider keys, no service role, no message
 * content beyond the signed-in student's own.
 */
import { isDemo, mutate, one, rows, db } from '@/services/shared'
import type { AIMode, ConversationMessage, ConversationSummary } from '@/ai/types'

interface ConversationRow {
  id: string
  title: string
  mode: AIMode | null
  subject_id: string | null
  chapter_id: string | null
  message_count: number
  created_at: string
  updated_at: string
}

function toSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    subjectId: row.subject_id,
    chapterId: row.chapter_id,
    messageCount: row.message_count ?? 0,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

const SELECT = 'id, title, mode, subject_id, chapter_id, message_count, created_at, updated_at'

/** Recent threads for the history drawer (newest first). */
export async function listConversations(limit = 30): Promise<ConversationSummary[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []

  const data = await rows<ConversationRow>(
    client
      .from('ai_conversations')
      .select(SELECT)
      .order('updated_at', { ascending: false })
      .limit(limit),
  )
  return data.map(toSummary)
}

/** Case-insensitive title search over the student's own threads. */
export async function searchConversations(query: string, limit = 20): Promise<ConversationSummary[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []
  const term = query.trim()
  if (!term) return listConversations(limit)

  const data = await rows<ConversationRow>(
    client
      .from('ai_conversations')
      .select(SELECT)
      .ilike('title', `%${term.replace(/[%_]/g, '')}%`)
      .order('updated_at', { ascending: false })
      .limit(limit),
  )
  return data.map(toSummary)
}

/** One thread's history, oldest first (used when continuing a conversation). */
export async function getMessages(conversationId: string): Promise<ConversationMessage[]> {
  if (isDemo) return []
  const client = db()
  if (!client) return []

  const data = await rows<{
    id: string
    conversation_id: string
    role: 'user' | 'assistant'
    content: string
    mode: AIMode | null
    metadata: Record<string, unknown> | null
    created_at: string
  }>(
    client
      .from('ai_messages')
      .select('id, conversation_id, role, content, mode, metadata, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200),
  )

  return data.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    mode: row.mode,
    meta: row.metadata ?? null,
    createdAt: row.created_at,
  }))
}

/** Rename via the RPC (server derives nothing — the student types the title). */
export async function renameConversation(conversationId: string, title: string): Promise<void> {
  if (isDemo) return
  const client = db()
  if (!client) return
  const trimmed = title.trim().slice(0, 120)
  if (!trimmed) throw new Error('A conversation name cannot be empty.')

  const { error } = await client.rpc('ai_set_conversation_title', {
    p_id: conversationId,
    p_title: trimmed,
  })
  if (error) throw new Error('We could not rename that conversation.')
}

/** Delete a thread (messages cascade). */
export async function deleteConversation(conversationId: string): Promise<void> {
  if (isDemo) return
  const client = db()
  if (!client) return
  await mutate(client.from('ai_conversations').delete().eq('id', conversationId))
}

/** Create an empty thread up-front (the tutor does this on the first send too). */
export async function createConversation(input: {
  title?: string
  mode?: AIMode
  subjectId?: string | null
  chapterId?: string | null
}): Promise<ConversationSummary | null> {
  if (isDemo) return null
  const client = db()
  if (!client) return null

  const row = await one<ConversationRow>(
    client
      .from('ai_conversations')
      .insert({
        title: input.title?.slice(0, 120) || 'New chat',
        mode: input.mode ?? 'explain',
        subject_id: input.subjectId ?? null,
        chapter_id: input.chapterId ?? null,
      })
      .select(SELECT),
  )
  return row ? toSummary(row) : null
}

/** Message count for the drawer badge (cheap, own rows only). */
export async function conversationCount(): Promise<number> {
  if (isDemo) return 0
  const client = db()
  if (!client) return 0
  const { count } = await client
    .from('ai_conversations')
    .select('id', { count: 'exact', head: true })
  return count ?? 0
}
