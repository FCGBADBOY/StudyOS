/**
 * Conversation persistence + context-window management.
 *
 *  - threads and messages live in `ai_conversations` / `ai_messages` (RLS:
 *    owner-only);
 *  - only the most recent `RECENT_WINDOW` turns go into the prompt;
 *  - everything older is folded into a single rolling `summary` (one extra
 *    model call, stored on the conversation) so long chats stay cheap.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { AIMode, ResponseMeta } from '../types.ts'
import type { AiProvider } from '../providers/provider.interface.ts'
import type { ConversationTurn } from '../prompts/base.ts'
import { log } from '../logging.ts'

export const RECENT_WINDOW = 12
export const MAX_MESSAGE_CHARS = 4000
export const MAX_TITLE_CHARS = 60

export interface ConversationRow {
  id: string
  user_id: string
  title: string
  summary: string | null
  summary_message_count: number
  message_count: number
  mode: AIMode
  subject_id: string | null
  chapter_id: string | null
}

/** Split turns into (older → summarise) + (recent → inline prompt). */
export function splitHistory(turns: ConversationTurn[]): {
  older: ConversationTurn[]
  recent: ConversationTurn[]
} {
  if (turns.length <= RECENT_WINDOW) return { older: [], recent: turns }
  return { older: turns.slice(0, turns.length - RECENT_WINDOW), recent: turns.slice(-RECENT_WINDOW) }
}

/** Derive a short thread title from the first message. */
export function deriveTitle(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim()
  if (clean.length <= MAX_TITLE_CHARS) return clean || 'New chat'
  return `${clean.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`
}

/** Load the conversation (owner-scoped) or create it from the first message. */
export async function ensureConversation(
  db: SupabaseClient,
  userId: string,
  input: {
    conversationId?: string | null
    message: string
    mode: AIMode
    subjectId?: string | null
    chapterId?: string | null
  },
): Promise<ConversationRow> {
  if (input.conversationId) {
    const { data } = await db
      .from('ai_conversations')
      .select('id, user_id, title, summary, summary_message_count, message_count, mode, subject_id, chapter_id')
      .eq('id', input.conversationId)
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      const patch: Record<string, unknown> = {}
      if (input.mode) patch.mode = input.mode
      if (input.subjectId && !data.subject_id) patch.subject_id = input.subjectId
      if (input.chapterId && !data.chapter_id) patch.chapter_id = input.chapterId
      if (Object.keys(patch).length) {
        await db.from('ai_conversations').update(patch).eq('id', data.id)
      }
      return data as ConversationRow
    }
    /* Fall through: unknown/foreign id → start a fresh thread (never trust it). */
  }

  const { data, error } = await db
    .from('ai_conversations')
    .insert({
      user_id: userId,
      title: deriveTitle(input.message),
      mode: input.mode,
      subject_id: input.subjectId ?? null,
      chapter_id: input.chapterId ?? null,
    })
    .select('id, user_id, title, summary, summary_message_count, message_count, mode, subject_id, chapter_id')
    .single()

  if (error || !data) {
    throw new Error('We could not open a chat thread. Please try again.')
  }
  return data as ConversationRow
}

export interface LoadedHistory {
  turns: ConversationTurn[]
  /** Previous assistant meta (used to continue progressive hints). */
  lastAssistantMeta: ResponseMeta | null
}

/** Recent turns for the conversation, oldest first. */
export async function loadHistory(
  db: SupabaseClient,
  userId: string,
  conversationId: string,
  limit = RECENT_WINDOW * 3,
): Promise<LoadedHistory> {
  const { data, error } = await db
    .from('ai_messages')
    .select('role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return { turns: [], lastAssistantMeta: null }

  const rows = (data as Array<{ role: string; content: string; metadata: ResponseMeta | null }>).slice().reverse()
  const lastAssistant = [...rows].reverse().find((row) => row.role === 'assistant')

  return {
    turns: rows
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({ role: row.role as 'user' | 'assistant', content: row.content })),
    lastAssistantMeta: (lastAssistant?.metadata ?? null) as ResponseMeta | null,
  }
}

/** Append a message (metadata = display payload only, never secrets). */
export async function appendMessage(
  db: SupabaseClient,
  userId: string,
  conversationId: string,
  message: { role: 'user' | 'assistant' | 'system'; content: string; mode?: AIMode; meta?: unknown },
): Promise<void> {
  try {
    await db.from('ai_messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: message.role,
      content: message.content.slice(0, 24_000),
      mode: message.mode ?? null,
      metadata: (message.meta ?? {}) as Record<string, unknown>,
    })
    await db
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId)
  } catch (error) {
    log('warn', 'ai.message_persist_failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

/** Regenerate: drop the last assistant answer so it can be produced again. */
export async function dropLastAssistant(
  db: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<void> {
  try {
    const { data } = await db
      .from('ai_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) await db.from('ai_messages').delete().eq('id', (data as { id: string }).id)
  } catch (error) {
    log('warn', 'ai.regenerate_failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * Fold `older` turns into the conversation's rolling summary. Returns the new
 * summary text (or the existing one when nothing changed). Never throws.
 */
export async function summarizeOlder(
  provider: AiProvider,
  db: SupabaseClient,
  userId: string,
  conversation: ConversationRow,
  older: ConversationTurn[],
): Promise<string | null> {
  if (!older.length) return conversation.summary ?? null

  const alreadyCovered = (conversation.summary_message_count ?? 0) >= older.length
  if (alreadyCovered && conversation.summary) return conversation.summary

  try {
    const transcript = older
      .map((turn) => `${turn.role === 'user' ? 'Student' : 'Tutor'}: ${turn.content}`)
      .join('\n')
      .slice(0, 12_000)

    const result = await provider.generateText({
      messages: [
        {
          role: 'system',
          content:
            'Summarise this study conversation in under 150 words. Keep: topics covered, questions asked, answers’ key results, unresolved doubts. Plain text only.',
        },
        { role: 'user', content: transcript },
      ],
      maxTokens: 300,
      temperature: 0.2,
    })

    const summary = result.text.trim()
    if (!summary) return conversation.summary ?? null

    await db
      .from('ai_conversations')
      .update({ summary, summary_message_count: conversation.summary_message_count + older.length })
      .eq('id', conversation.id)
      .eq('user_id', userId)

    return summary
  } catch (error) {
    log('warn', 'ai.summary_failed', { error: error instanceof Error ? error.message : String(error) })
    return conversation.summary ?? null
  }
}
