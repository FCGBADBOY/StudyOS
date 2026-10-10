/**
 * AI Tutor — streaming chat over StudyOS content.
 *
 * What it does:
 *   • streams the answer (SSE) with a live status line, so retrieval/tool
 *     work is visible instead of a silent spinner;
 *   • shows citations with real metadata + an honest "not grounded" warning;
 *   • 8 tutor modes switchable *inside* a thread, plus progressive hints;
 *   • conversation history (new / recent / search / rename / delete / continue)
 *     with context-window summarisation handled server-side;
 *   • action chips (quiz me, past-year questions, copy, regenerate, save);
 *   • image → server-side transcription → the same grounded pipeline;
 *   • demo mode (no backend) falls back to the bundled keyword tutor.
 *
 * Security: no provider key ever reaches the browser — every turn goes to the
 * `ai-chat` edge function with the student's own JWT.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BookOpenCheck,
  Bot,
  ChevronDown,
  ImagePlus,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  Square,
  Trash2,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  PageHeader,
  SectionHeader,
  Textarea,
} from '@/components/ui'
import { ActionChips } from '@/components/ai/ActionChips'
import { ConversationDrawer } from '@/components/ai/ConversationDrawer'
import { FlashcardDeck, QuizCard } from '@/components/ai/PracticeCards'
import { Markdown } from '@/components/ai/Markdown'
import { SourceCards } from '@/components/ai/SourceCards'
import { ToolStatus } from '@/components/ai/ToolStatus'
import { caretBlink, messageIn, typingDots } from '@/animations'
import { useReducedMotion } from '@/hooks'
import { useToast } from '@/context/AppProvider'
import { SUGGESTED_PROMPTS, buildTutorReply } from '@/data/tutor'
import type { ChatMessageData, TutorMode as DemoTutorMode, TutorReply } from '@/data/tutor'
import { MODE_CATALOG, MODE_LIST, buildModeMessage } from '@/ai/prompts/modes'
import { buildFocus, focusLabel } from '@/ai/retrieval/filters'
import { aiAvailable, friendlyAiError, streamChat, solveQuestion, AiError } from '@/ai/services/ai.service'
import {
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  renameConversation,
} from '@/ai/services/conversation.service'
import { createMistake } from '@/services/mistakebook.service'
import type { AIAction, AIMode, ChatFocus, ChatRequest, ConversationSummary, ResponseMeta } from '@/ai/types'
import type { SubjectId } from '@/types'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

/* --------------------------------- helpers -------------------------------- */

interface TutorMessage extends ChatMessageData {
  subjectId?: SubjectId
  /** Structured metadata from the server (sources, tools, hint progress…). */
  meta?: ResponseMeta | null
  /** Streaming status line ("Searching StudyOS library…"). */
  status?: string | null
  /** Client-safe error code/message when a turn failed. */
  error?: string | null
  /** AI-GENERATED PRACTICE payloads. */
  quiz?: ResponseMeta['quiz']
  flashcards?: ResponseMeta['flashcards']
  /** `true` while the answer is still arriving. */
  pending?: boolean
}

const SUBJECT_KEYWORDS: Array<[SubjectId, RegExp]> = [
  ['chemistry', /chem|reaction|nernst|organic|phenol|alcohol|amine|titration|electrochem|compound|molecule/i],
  ['physics', /physics|circuit|current|voltage|ohm|kirchhoff|capacitor|resistor|optics|lens|magnetic|drift/i],
  ['mathematics', /math|integral|derivat|algebra|probab|matrix|determinant|binomial|theorem/i],
  ['computer-science', /python|code|sql|program|function|algorithm|stack|queue|recursion/i],
  ['english', /essay|poem|letter|flamingo|vista|extract|english/i],
]

function detectSubject(text: string): SubjectId | undefined {
  for (const [id, pattern] of SUBJECT_KEYWORDS) if (pattern.test(text)) return id
  return undefined
}

function timeNow(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

let idCounter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${(idCounter += 1)}`

/* ------------------------------ demo answer ------------------------------- */

function DemoReplyBody({ reply }: { reply: TutorReply }) {
  return (
    <>
      {reply.equation && (
        <p className="formula mt-2 break-words rounded-tile bg-surface-sunken px-3 py-2 text-[13px] font-semibold text-foreground">
          {reply.equation}
        </p>
      )}

      {reply.steps && reply.steps.length > 0 && (
        <ol className="mt-2 space-y-1.5 pl-2">
          {reply.steps.map((step, index) => (
            <li key={step} className="flex gap-2 text-[13px] leading-snug text-muted">
              <span
                aria-hidden
                className="tabular mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-soft-fg"
              >
                {index + 1}
              </span>
              <span className="min-w-0 break-words">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {reply.code && (
        <div className="mt-2 pl-2">
          <Badge variant="neutral">{reply.code.language}</Badge>
          <pre className="formula mt-1.5 overflow-x-auto rounded-tile bg-surface-sunken p-3 text-[12px] leading-relaxed text-foreground no-scrollbar">
            {reply.code.content}
          </pre>
        </div>
      )}

      {reply.question && (
        <div className="mt-2 rounded-tile border border-border-strong bg-surface p-3 pl-2">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-[12px] font-semibold text-foreground">{reply.question.title}</p>
            <Badge variant="warning">{reply.question.marks} marks</Badge>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted">{reply.question.body}</p>
        </div>
      )}
    </>
  )
}

/* ------------------------------ message bubble ---------------------------- */

function MessageBubble({
  message,
  showFollowUps,
  onFollowUp,
  onAction,
  onRegenerate,
  onSave,
}: {
  message: TutorMessage
  showFollowUps: boolean
  onFollowUp: (prompt: string) => void
  onAction: (action: AIAction, message: string) => void
  onRegenerate: () => void
  onSave: () => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  const isUser = message.role === 'user'
  const key = `${message.id}:${message.role}`

  useLayoutEffect(() => messageIn(ref.current, message.role), [key, message.role])

  const accent = isUser ? undefined : subjectAccent(message.subjectId)

  return (
    <li ref={ref} className={cn('flex items-end gap-2', isUser && 'justify-end')}>
      {!isUser && <Avatar name="StudyOS Tutor" initials="AI" size="sm" decorative />}

      <div
        className={cn(
          'relative min-w-0 max-w-[86%] overflow-hidden rounded-tile px-3.5 py-2.5 shadow-card',
          isUser ? 'bg-brand' : 'border border-border bg-surface-muted',
        )}
      >
        {!isUser && <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', accent?.solid ?? 'bg-brand')} />}

        <div className={cn('flex items-center gap-2', !isUser && 'pl-2')}>
          <span
            className={cn(
              'text-[11px] font-semibold',
              isUser ? 'text-brand-fg/85' : accent ? accent.text : 'text-brand-soft-fg',
            )}
          >
            {isUser ? 'You' : 'Tutor'}
          </span>
          <span className={cn('tabular text-[11px]', isUser ? 'text-brand-fg/70' : 'text-faint')}>{message.time}</span>
          {!isUser && message.meta && <Badge variant="outline" size="sm">{message.meta.type.replace(/_/g, ' ')}</Badge>}
        </div>

        <div className={cn('mt-1 text-sm leading-relaxed', isUser ? 'break-words text-brand-fg' : 'pl-2 text-foreground')}>
          {isUser ? (
            <p className="break-words">{message.text}</p>
          ) : message.reply ? (
            <>
              <p className="break-words">{message.text}</p>
              <DemoReplyBody reply={message.reply} />
            </>
          ) : (
            <Markdown text={message.text} className="text-foreground" />
          )}
        </div>

        {!isUser && !message.reply && (
          <ToolStatus meta={message.meta ?? null} status={message.status ?? null} />
        )}

        {!isUser && !message.reply && message.meta && message.meta.sources.length > 0 && (
          <SourceCards sources={message.meta.sources} />
        )}

        {!isUser && message.quiz && message.quiz.length > 0 && <QuizCard items={message.quiz} />}
        {!isUser && message.flashcards && message.flashcards.length > 0 && (
          <FlashcardDeck cards={message.flashcards} />
        )}

        {!isUser && message.error && (
          <div className="mt-2 flex items-start gap-2 rounded-tile border border-danger/40 bg-danger-soft px-2.5 py-2 pl-2">
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-foreground">{message.error}</p>
            <Chip onClick={onRegenerate} className="min-h-9 shrink-0 text-[12px]">
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              Retry
            </Chip>
          </div>
        )}

        {!isUser && !message.pending && showFollowUps && (
          <ActionChips
            text={message.text}
            meta={message.meta ?? null}
            onAction={onAction}
            onFollowUp={onFollowUp}
            onRegenerate={onRegenerate}
            onSave={onSave}
          />
        )}
      </div>
    </li>
  )
}

/* -------------------------------- typing ---------------------------------- */

function TypingBubble({ status }: { status: string | null }) {
  const dotsRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const stopDots = typingDots(dotsRef.current)
    const stopCaret = caretBlink(caretRef.current)
    return () => {
      stopDots()
      stopCaret()
    }
  }, [])

  return (
    <li className="flex items-center gap-2">
      <Avatar name="StudyOS Tutor" initials="AI" size="sm" decorative />
      <div className="flex items-center gap-2 rounded-tile border border-border bg-surface-muted px-3.5 py-3">
        <span className="text-[13px] font-medium text-muted">{status ?? 'Tutor is thinking'}</span>
        <span ref={dotsRef} className="flex items-end gap-1" aria-hidden>
          <span data-dot className="h-1.5 w-1.5 rounded-full bg-brand" />
          <span data-dot className="h-1.5 w-1.5 rounded-full bg-brand" />
          <span data-dot className="h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
        <span ref={caretRef} aria-hidden className="h-3.5 w-0.5 rounded-full bg-brand" />
      </div>
    </li>
  )
}

/* ---------------------------------- page ---------------------------------- */

export default function AiTutorPage() {
  const { toast } = useToast()
  const reduced = useReducedMotion()
  const location = useLocation()

  const [booting, setBooting] = useState(true)
  const [mode, setMode] = useState<AIMode>('explain')
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [threadTitle, setThreadTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hintIndex, setHintIndex] = useState(0)
  const [uploading, setUploading] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamingRef = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastUserText = useRef<string>('')

  const activeMode = MODE_CATALOG[mode]
  const focus = useMemo(() => {
    const state = (location.state ?? {}) as { focus?: { subjectId?: string; chapterId?: string; subjectSlug?: string; chapterSlug?: string } }
    return buildFocus(state.focus ?? {})
  }, [location.state])

  /* Brief boot — the tutor "wakes up" before the first message. */
  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 380)
    return () => window.clearTimeout(timer)
  }, [])

  /* Load the student's own threads (RLS-scoped). */
  const refreshHistory = useCallback(async () => {
    if (!aiAvailable) return
    setHistoryLoading(true)
    try {
      setConversations(await listConversations())
    } catch {
      /* history is a convenience — the composer keeps working without it */
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  /* Never leak a stream when the page unmounts. */
  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  /* Keep the newest message in view. */
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [messages, status, reduced])

  const setBusy = (busy: boolean) => {
    streamingRef.current = busy
    if (!busy) setStatus(null)
  }

  const patchMessage = useCallback((id: string, patch: Partial<TutorMessage>) => {
    setMessages((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }, [])

  /* ------------------------------ demo mode ------------------------------ */

  const sendDemo = (text: string) => {
    const subjectId = detectSubject(text)
    window.setTimeout(() => {
      const reply = buildTutorReply(text, mode as DemoTutorMode)
      setMessages((prev) => [
        ...prev,
        { id: nextId('msg-tutor'), role: 'assistant', text: reply.text, time: timeNow(), reply, subjectId },
      ])
      setBusy(false)
    }, 650)
  }

  /* ------------------------------ live mode ------------------------------ */

  const runTurn = useCallback(
    async (options: { text: string; regenerate?: boolean; action?: AIAction; focusPatch?: ChatFocus }) => {
      const text = options.text.trim()
      if (!text) return

      const subjectId = detectSubject(text)
      const assistantId = nextId('msg-tutor')

      if (options.regenerate) {
        setMessages((prev) => {
          const next = [...prev]
          while (next.length && next[next.length - 1].role === 'assistant') next.pop()
          return next
        })
      } else {
        setMessages((prev) => [
          ...prev,
          { id: nextId('msg-user'), role: 'user', text, time: timeNow(), subjectId },
        ])
      }

      lastUserText.current = text
      setDraft('')
      setError(null)
      setBusy(true)
      setStatus('Reading your study context')

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          time: timeNow(),
          subjectId,
          pending: true,
          status: 'Reading your study context',
        },
      ])

      const controller = new AbortController()
      abortRef.current = controller

      const request: ChatRequest = {
        conversationId,
        message: buildModeMessage(text, mode),
        mode,
        regenerate: options.regenerate ?? false,
        focus: {
          ...focus,
          ...options.focusPatch,
          hintIndex: options.action === 'next_hint' || options.action === 'give_hint' ? hintIndex : 0,
          ...(options.action ? { action: options.action } : {}),
        },
      }

      let accumulated = ''

      try {
        const result = await streamChat(
          request,
          {
            onStatus: (label) => {
              setStatus(label)
              patchMessage(assistantId, { status: label })
            },
            onMeta: (meta) => {
              patchMessage(assistantId, { meta, quiz: meta.quiz, flashcards: meta.flashcards })
            },
            onDelta: (delta) => {
              accumulated += delta
              patchMessage(assistantId, { text: accumulated, status: null })
            },
          },
          controller.signal,
        )

        const finalText = result.text || accumulated
        const meta = result.meta

        patchMessage(assistantId, {
          text: finalText,
          pending: false,
          status: null,
          error: null,
          meta: meta ?? null,
          quiz: meta?.quiz,
          flashcards: meta?.flashcards,
        })

        if (result.payload?.conversationId) {
          setConversationId(result.payload.conversationId)
          if (messages.length === 0) setThreadTitle(finalText.slice(0, 60))
        }
        if (meta?.type === 'hint') setHintIndex((prev) => Math.min(prev + 1, 2))

        void refreshHistory()
      } catch (caught) {
        const aiError = caught instanceof AiError ? caught : null
        const aborted = aiError?.code === 'aborted' || controller.signal.aborted
        const message = aborted ? null : friendlyAiError(caught)

        if (aborted) {
          /* Student pressed Stop: keep whatever arrived, mark it interrupted. */
          patchMessage(assistantId, {
            pending: false,
            status: null,
            text: accumulated,
            error: accumulated ? null : 'Generation stopped.',
          })
        } else {
          patchMessage(assistantId, { pending: false, status: null, error: message ?? 'Something went wrong.' })
          setError(message ?? 'Something went wrong.')
        }
      } finally {
        setBusy(false)
        abortRef.current = null
      }
    },
    [conversationId, focus, hintIndex, messages.length, mode, patchMessage, refreshHistory],
  )

  /* --------------------------------- send -------------------------------- */

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text || streamingRef.current || booting) return

    if (!aiAvailable) {
      const subjectId = detectSubject(text)
      setMessages((prev) => [...prev, { id: nextId('msg-user'), role: 'user', text, time: timeNow(), subjectId }])
      setDraft('')
      setBusy(true)
      sendDemo(text)
      return
    }

    void runTurn({ text })
  }

  const runAction = (action: AIAction, message: string) => {
    if (streamingRef.current) return
    if (action === 'save') return

    if (action === 'next_hint' || action === 'give_hint') {
      void runTurn({ text: message, action, focusPatch: { action, hintIndex } })
      return
    }
    if (action === 'reveal_solution') {
      setHintIndex(0)
      void runTurn({ text: message, action, focusPatch: { action, hintIndex: 0 } })
      return
    }
    void runTurn({ text: message, action, focusPatch: { action } })
  }

  const regenerate = () => {
    if (streamingRef.current || !lastUserText.current) return
    void runTurn({ text: lastUserText.current, regenerate: true })
  }

  const stop = () => abortRef.current?.abort()

  /* ---------------------------- history actions -------------------------- */

  const startNewThread = async () => {
    stop()
    setMessages([])
    setConversationId(null)
    setThreadTitle(null)
    setHintIndex(0)
    setError(null)
    setDrawerOpen(false)
    setMode('explain')

    if (aiAvailable) {
      try {
        const created = await createConversation({ mode })
        if (created) {
          setConversationId(created.id)
          setConversations((prev) => [created, ...prev])
        }
      } catch {
        /* the first send creates the thread server-side anyway */
      }
    }
  }

  const openThread = async (conversation: ConversationSummary) => {
    if (streamingRef.current) return
    setDrawerOpen(false)
    setMessages([])
    setError(null)
    setConversationId(conversation.id)
    setThreadTitle(conversation.title)
    setHintIndex(0)
    if (conversation.mode) setMode(conversation.mode)
    setMessages([{ id: nextId('msg-loading'), role: 'assistant', text: '', time: '', pending: true, status: 'Loading this thread' }])

    try {
      const history = await getMessages(conversation.id)
      setMessages(
        history.map((entry) => {
          const meta = (entry.meta ?? null) as ResponseMeta | null
          return {
            id: entry.id,
            role: entry.role,
            text: entry.content,
            time: new Date(entry.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
            subjectId: detectSubject(entry.content),
            meta,
            quiz: meta?.quiz,
            flashcards: meta?.flashcards,
          } satisfies TutorMessage
        }),
      )
      const lastUser = [...history].reverse().find((entry) => entry.role === 'user')
      if (lastUser) lastUserText.current = lastUser.content
    } catch {
      setMessages([])
      setError('We could not load that thread. Please try again.')
    }
  }

  const renameThread = async (conversation: ConversationSummary, title: string) => {
    try {
      await renameConversation(conversation.id, title)
      setConversations((prev) => prev.map((entry) => (entry.id === conversation.id ? { ...entry, title } : entry)))
      if (conversationId === conversation.id) setThreadTitle(title)
      toast({ title: 'Chat renamed', description: title, variant: 'success' })
    } catch {
      toast({ title: 'Could not rename', description: 'Please try again.', variant: 'danger' })
    }
  }

  const removeThread = async (conversation: ConversationSummary) => {
    try {
      await deleteConversation(conversation.id)
      setConversations((prev) => prev.filter((entry) => entry.id !== conversation.id))
      if (conversationId === conversation.id) {
        setConversationId(null)
        setMessages([])
        setThreadTitle(null)
      }
      toast({ title: 'Chat deleted', description: 'The thread is gone for good.' })
    } catch {
      toast({ title: 'Could not delete', description: 'Please try again.', variant: 'danger' })
    }
  }

  /* ------------------------------ persistence ---------------------------- */

  const saveLastAnswer = async () => {
    const answer = [...messages].reverse().find((entry) => entry.role === 'assistant' && entry.text.trim())
    if (!answer) return
    try {
      await createMistake({
        questionText: lastUserText.current || answer.text.slice(0, 300),
        mistakeType: 'conceptual',
        explanation: answer.text.slice(0, 4000),
        notes: `Saved from AI Tutor (${MODE_CATALOG[mode].label} mode).`,
      })
      toast({ title: 'Saved to MistakeBook', description: 'Revise it in your next sprint.', variant: 'success' })
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'danger' })
    }
  }

  /* -------------------------------- images ------------------------------- */

  const attachImage = async (file: File | null) => {
    if (!file) return
    if (!aiAvailable) {
      toast({ title: 'Demo mode', description: 'Image solving needs a connected backend.' })
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Please use a photo under 4 MB.', variant: 'danger' })
      return
    }

    setUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('read failed'))
        reader.readAsDataURL(file)
      })

      setMessages((prev) => [
        ...prev,
        {
          id: nextId('msg-user'),
          role: 'user',
          text: `Photo of a question (${file.name})`,
          time: timeNow(),
          attachment: { kind: 'image', label: file.name },
        },
      ])
      setBusy(true)
      setStatus('Reading the photo')

      const assistantId = nextId('msg-tutor')
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', text: '', time: timeNow(), pending: true, status: 'Reading the photo' },
      ])

      const controller = new AbortController()
      abortRef.current = controller

      const result = await solveQuestion(
        {
          imageBase64: dataUrl,
          mimeType: file.type,
          conversationId,
          subjectId: focus?.subjectId ?? null,
          chapterId: focus?.chapterId ?? null,
        },
        controller.signal,
        {
          onMeta: (meta) => patchMessage(assistantId, { meta }),
          onDelta: (text) => patchMessage(assistantId, { text }),
        },
      )

      patchMessage(assistantId, {
        text: result.text,
        meta: result.meta,
        pending: false,
        status: null,
      })
      if (result.conversationId) setConversationId(result.conversationId)
      void refreshHistory()
    } catch (caught) {
      const message = friendlyAiError(caught)
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('msg-tutor'),
          role: 'assistant',
          text: '',
          time: timeNow(),
          error: message,
          pending: false,
        },
      ])
      setError(message)
    } finally {
      setUploading(false)
      setBusy(false)
      abortRef.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /* -------------------------------- render ------------------------------- */

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    send(draft)
  }

  let lastAssistantIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      lastAssistantIndex = index
      break
    }
  }

  const focusLabelled = focusLabel(focus)
  const hasMessages = messages.length > 0

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="AI Tutor"
        subtitle={
          aiAvailable
            ? 'Grounded in your StudyOS library: ask for a hint, an exam-length answer or a practice set.'
            : 'Demo mode — replies come from the bundled sample tutor until a backend is connected.'
        }
        actions={
          <>
            <IconButton
              label="Chat history"
              size="lg"
              variant="soft"
              onClick={() => setDrawerOpen(true)}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquare />
            </IconButton>
            <IconButton
              label="Clear chat"
              size="lg"
              variant="soft"
              disabled={!hasMessages}
              className="disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setMessages([])
                setConversationId(null)
                setThreadTitle(null)
                setError(null)
                toast({ title: 'Chat cleared', description: 'The tutor is ready for a fresh question.' })
              }}
            >
              <Trash2 />
            </IconButton>
          </>
        }
      />

      {/* ------------------------------ modes ------------------------------ */}
      <section aria-labelledby="tutor-mode-heading" className="space-y-3">
        <SectionHeader
          id="tutor-mode-heading"
          title="Tutor mode"
          subtitle={`${activeMode.label} — ${activeMode.hint}${focusLabelled ? ` · ${focusLabelled}` : ''}`}
        />
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Tutor modes">
          {MODE_LIST.map((entry) => (
            <Chip
              key={entry.id}
              selected={entry.id === mode}
              onClick={() => setMode(entry.id)}
              className="min-h-11 shrink-0"
            >
              {entry.label}
            </Chip>
          ))}
        </div>
      </section>

      {booting ? (
        <LoadingState label="Waking up your tutor" />
      ) : (
        <section
          aria-label="Tutor conversation"
          className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', aiAvailable ? 'bg-success' : 'bg-warning')} />
              <h2 className="truncate text-sm font-semibold text-foreground">
                {threadTitle ?? (focusLabelled ? `Tutor · ${focusLabelled}` : 'Tutor session')}
              </h2>
              <span className="tabular truncate text-[12px] text-faint">
                {messages.filter((entry) => !entry.pending).length} message
                {messages.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {conversationId && (
                <Button variant="ghost" size="sm" icon={<Bot />} onClick={() => setDrawerOpen(true)}>
                  History
                </Button>
              )}
              <Badge variant="brand">{activeMode.label}</Badge>
            </div>
          </header>

          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label="Tutor messages"
            className="h-[46vh] max-h-[520px] min-h-[300px] overflow-y-auto px-4 py-4 no-scrollbar"
          >
            {hasMessages ? (
              <ul role="list" className="space-y-4">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    showFollowUps={!streamingRef.current && index === lastAssistantIndex && !message.error}
                    onFollowUp={send}
                    onAction={runAction}
                    onRegenerate={regenerate}
                    onSave={() => void saveLastAnswer()}
                  />
                ))}
                {status && <TypingBubble status={status} />}
              </ul>
            ) : (
              <EmptyState
                title="What are we solving today?"
                description={
                  aiAvailable
                    ? `Pick a mode above, then ask anything from your Class 12 syllabus — ${activeMode.example.toLowerCase()} is a good start.`
                    : 'Demo mode: pick a mode and try a sample prompt below.'
                }
                icon={<BookOpenCheck />}
                action={
                  <div className="flex max-w-md flex-wrap justify-center gap-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <Chip key={prompt} onClick={() => send(prompt)} className="min-h-11 text-left">
                        {prompt}
                      </Chip>
                    ))}
                  </div>
                }
              />
            )}
          </div>

          {error && (
            <div className="border-t border-border px-4 py-3">
              <ErrorState
                title="The tutor hit a snag"
                description={error}
                compact
                onRetry={() => send(lastUserText.current)}
              />
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              send(draft)
            }}
            className="border-t border-border p-3"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void attachImage(event.target.files?.[0] ?? null)}
              aria-label="Attach a photo of a question"
            />

            <div className="flex items-end gap-2">
              <IconButton
                label="Attach a photo of a question"
                size="lg"
                variant="ghost"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="shrink-0"
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
              </IconButton>
              <IconButton
                label="Upload an image"
                size="lg"
                variant="ghost"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="hidden shrink-0 sm:inline-flex"
              >
                <ImagePlus />
              </IconButton>

              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={600}
                placeholder={activeMode.placeholder}
                aria-label="Message the AI Tutor"
                className="min-w-0 flex-1"
              />

              {streamingRef.current ? (
                <Button type="button" variant="danger" icon={<Square />} onClick={stop} className="shrink-0">
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  icon={<Send />}
                  disabled={!draft.trim() || booting || uploading}
                  className="shrink-0"
                >
                  Send
                </Button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] leading-snug text-faint">
                Enter to send · Shift + Enter for a new line ·{' '}
                <span className="font-semibold text-muted">{activeMode.label}</span>
                {hintIndex > 0 && mode === 'hint' ? ` · hint ${hintIndex + 1} of 3` : ''}
              </p>
              {!aiAvailable && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-warning">
                  <ChevronDown aria-hidden className="h-3 w-3" />
                  Demo tutor
                </span>
              )}
            </div>
          </form>
        </section>
      )}

      <ConversationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        loading={historyLoading}
        activeId={conversationId}
        onNew={() => void startNewThread()}
        onOpen={(conversation) => void openThread(conversation)}
        onRename={(conversation, title) => void renameThread(conversation, title)}
        onDelete={(conversation) => void removeThread(conversation)}
      />
    </div>
  )
}
