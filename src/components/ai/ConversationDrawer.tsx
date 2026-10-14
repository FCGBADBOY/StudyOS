/**
 * Conversation history (bottom sheet): recent threads, title search, rename,
 * delete and "start a new chat".
 *
 * Data comes from `ai_conversations` under RLS — a student only ever sees
 * their own threads, and the server keeps a rolling summary of older turns so
 * long threads stay inside the context window.
 *
 * Visual treatment: each thread is a designed row card — a themed icon tile,
 * the title with its metadata, and quiet rename/delete affordances on the
 * trailing edge. The active thread is tinted so the student always knows
 * which conversation they are inside.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, MessageSquarePlus, Pencil, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { BottomSheet, Button, Chip, EmptyState, IconTile, IconButton, Input, LoadingState } from '@/components/ui'
import { cardHover } from '@/animations'
import { cn } from '@/utils/cn'
import type { ConversationSummary } from '@/ai/types'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((Date.now() - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function ConversationDrawer({
  open,
  onClose,
  conversations,
  loading,
  activeId,
  onNew,
  onOpen,
  onRename,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  conversations: ConversationSummary[]
  loading: boolean
  activeId: string | null
  onNew: () => void
  onOpen: (conversation: ConversationSummary) => void
  onRename: (conversation: ConversationSummary, title: string) => void
  onDelete: (conversation: ConversationSummary) => void
}) {
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setQuery('')
    }
  }, [open])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((entry) => entry.title.toLowerCase().includes(term))
  }, [conversations, query])

  /* Desktop pointers get a gentle lift on each thread row. */
  useEffect(() => {
    const root = listRef.current
    if (!root) return
    const cleanups = Array.from(root.querySelectorAll<HTMLElement>('[data-thread]')).map((row) =>
      cardHover(row),
    )
    return () => cleanups.forEach((fn) => fn())
  }, [filtered.length, open])

  const commitRename = (conversation: ConversationSummary) => {
    const title = draftTitle.trim()
    if (title && title !== conversation.title) onRename(conversation, title)
    setEditingId(null)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Your chats"
      description="Threads are private to your account."
      footer={
        <Button icon={<MessageSquarePlus />} onClick={onNew} className="w-full">
          New chat
        </Button>
      }
    >
      <div className="space-y-3 px-4 pb-6">
        <label className="relative block">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your chats…"
            aria-label="Search conversations"
            className="pl-9"
          />
        </label>

        {loading ? (
          <LoadingState label="Loading your chats" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={conversations.length ? 'No chat matches' : 'No chats yet'}
            description={
              conversations.length
                ? 'Try a different word from the title.'
                : 'Ask the tutor anything — your threads will appear here.'
            }
            illustration="notebook"
            theme="ai"
            compact
          />
        ) : (
          <ul ref={listRef} role="list" className="space-y-2">
            {filtered.map((conversation) => {
              const isActive = conversation.id === activeId
              const isEditing = editingId === conversation.id

              return (
                <li
                  key={conversation.id}
                  data-thread={isActive ? undefined : ''}
                  className={cn(
                    'rounded-tile transition-shadow duration-150',
                    isActive
                      ? 'bg-brand-soft ring-1 ring-inset ring-brand-ring'
                      : 'bg-surface shadow-card hover:shadow-raised',
                  )}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2 p-2.5">
                      <Input
                        value={draftTitle}
                        autoFocus
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') commitRename(conversation)
                          if (event.key === 'Escape') setEditingId(null)
                        }}
                        aria-label="Conversation title"
                        className="min-w-0 flex-1"
                      />
                      <Button size="sm" variant="soft" onClick={() => commitRename(conversation)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 p-2.5">
                      <button
                        type="button"
                        onClick={() => onOpen(conversation)}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-tile text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                      >
                        <IconTile
                          icon={<MessageSquare />}
                          theme={isActive ? 'ai' : 'neutral'}
                          variant={isActive ? 'soft' : 'outlined'}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="clamp-2 block text-[13px] font-semibold leading-snug text-foreground">
                            {conversation.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-faint">
                            {relativeTime(conversation.updatedAt)}
                            {conversation.messageCount ? ` · ${conversation.messageCount} messages` : ''}
                            {conversation.mode ? ` · ${conversation.mode}` : ''}
                          </span>
                        </span>
                      </button>

                      <IconButton
                        label="Rename chat"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11"
                        onClick={() => {
                          setEditingId(conversation.id)
                          setDraftTitle(conversation.title)
                        }}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label="Delete chat"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11"
                        onClick={() => onDelete(conversation)}
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {filtered.length > 0 && (
          <Chip
            icon={<ShieldCheck />}
            className="w-full justify-center text-[11px]"
            ariaLabel="Privacy note"
          >
            Only you can see these chats — RLS keeps every thread owner-only.
          </Chip>
        )}
      </div>
    </BottomSheet>
  )
}
