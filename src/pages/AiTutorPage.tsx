/**
 * AI Tutor — flagship chat experience.
 *
 * Replies are keyword-matched mocks from `@/data/tutor` and land after a
 * simulated ~700 ms delay so the typing indicator and message entrances read
 * like a real generation cycle. Every timeout and animation is cleaned up.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BookmarkPlus, Send, Sparkles, Trash2 } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Chip,
  EmptyState,
  IconButton,
  LoadingState,
  PageHeader,
  SectionHeader,
  Textarea,
} from '@/components/ui'
import { caretBlink, messageIn, typingDots } from '@/animations'
import { useReducedMotion } from '@/hooks'
import { useToast } from '@/context/AppProvider'
import { SUGGESTED_PROMPTS, TUTOR_MODES, buildTutorReply } from '@/data/tutor'
import type { ChatMessageData, TutorMode } from '@/data/tutor'
import type { SubjectId } from '@/types'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

/* --------------------------------- helpers -------------------------------- */

/** Chat messages carry an inferred subject so bubbles can pick up an accent. */
interface TutorMessage extends ChatMessageData {
  subjectId?: SubjectId
}

const SUBJECT_KEYWORDS: Array<[SubjectId, RegExp]> = [
  [
    'chemistry',
    /chem|reaction|nernst|organic|phenol|alcohol|amine|titration|electrochem|compound|molecule/i,
  ],
  [
    'physics',
    /physics|circuit|current|voltage|ohm|kirchhoff|capacitor|resistor|optics|lens|magnetic|drift/i,
  ],
  ['mathematics', /math|integral|derivat|algebra|probab|matrix|determinant|binomial|theorem/i],
  ['computer-science', /python|code|sql|program|function|algorithm|stack|queue|recursion/i],
  ['english', /essay|poem|letter|flamingo|vista|extract|english/i],
]

function detectSubject(text: string): SubjectId | undefined {
  for (const [id, pattern] of SUBJECT_KEYWORDS) {
    if (pattern.test(text)) return id
  }
  return undefined
}

function timeNow(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/* ------------------------------ conversation ------------------------------ */

function MessageBubble({
  message,
  showFollowUps,
  onFollowUp,
}: {
  message: TutorMessage
  showFollowUps: boolean
  onFollowUp: (prompt: string) => void
}) {
  const ref = useRef<HTMLLIElement>(null)

  useLayoutEffect(() => messageIn(ref.current, message.role), [message.id, message.role])

  const isUser = message.role === 'user'
  const accent = isUser ? undefined : subjectAccent(message.subjectId)
  const reply = message.reply

  return (
    <li ref={ref} className={cn('flex items-end gap-2', isUser && 'justify-end')}>
      {!isUser && <Avatar name="StudyOS Tutor" initials="AI" size="sm" decorative />}

      <div
        className={cn(
          'relative min-w-0 max-w-[86%] overflow-hidden rounded-tile px-3.5 py-2.5 shadow-card',
          isUser ? 'bg-brand' : 'border border-border bg-surface-muted',
        )}
      >
        {!isUser && (
          <span
            aria-hidden
            className={cn('absolute inset-y-0 left-0 w-1', accent?.solid ?? 'bg-brand')}
          />
        )}

        <div className={cn('flex items-center gap-2', !isUser && 'pl-2')}>
          <span
            className={cn(
              'text-[11px] font-semibold',
              isUser ? 'text-brand-fg/85' : accent ? accent.text : 'text-brand-soft-fg',
            )}
          >
            {isUser ? 'You' : 'Tutor'}
          </span>
          <span className={cn('tabular text-[11px]', isUser ? 'text-brand-fg/70' : 'text-faint')}>
            {message.time}
          </span>
        </div>

        <p
          className={cn(
            'mt-1 text-sm leading-relaxed',
            isUser ? 'break-words text-brand-fg' : 'break-words pl-2 text-foreground',
          )}
        >
          {message.text}
        </p>

        {reply?.equation && (
          <p className="formula mt-2 break-words rounded-tile bg-surface-sunken px-3 py-2 text-[13px] font-semibold text-foreground">
            {reply.equation}
          </p>
        )}

        {reply?.steps && reply.steps.length > 0 && (
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

        {reply?.code && (
          <div className="mt-2 pl-2">
            <Badge variant="neutral">{reply.code.language}</Badge>
            <pre className="formula mt-1.5 overflow-x-auto rounded-tile bg-surface-sunken p-3 text-[12px] leading-relaxed text-foreground no-scrollbar">
              {reply.code.content}
            </pre>
          </div>
        )}

        {reply?.question && (
          <div className="mt-2 rounded-tile border border-border-strong bg-surface p-3 pl-2">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[12px] font-semibold text-foreground">
                {reply.question.title}
              </p>
              <Badge variant="warning">{reply.question.marks} marks</Badge>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-muted">{reply.question.body}</p>
          </div>
        )}

        {showFollowUps && reply?.followUps && reply.followUps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 pl-2">
            {reply.followUps.map((followUp) => (
              <Chip
                key={followUp}
                onClick={() => onFollowUp(followUp)}
                className="min-h-11 bg-surface"
              >
                {followUp}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function TypingBubble() {
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
        <span className="text-[13px] font-medium text-muted">Tutor is thinking</span>
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

function TutorHero({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        title="What are we solving today?"
        description="Pick a mode above, then ask anything from your Class 12 syllabus — a concept, a numerical or a full exam answer."
        icon={<Sparkles />}
        action={
          <div className="flex max-w-md flex-wrap justify-center gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Chip key={prompt} onClick={() => onPick(prompt)} className="min-h-11 text-left">
                {prompt}
              </Chip>
            ))}
          </div>
        }
      />
    </div>
  )
}

/* --------------------------------- page ----------------------------------- */

export default function AiTutorPage() {
  const { toast } = useToast()
  const reduced = useReducedMotion()

  const [booting, setBooting] = useState(true)
  const [mode, setMode] = useState<TutorMode>('explain')
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const replyTimer = useRef<number | null>(null)

  const activeMode = TUTOR_MODES.find((entry) => entry.id === mode) ?? TUTOR_MODES[0]
  const hasSavedAnswer = messages.some((entry) => entry.role === 'assistant' && entry.reply)

  /* Brief boot skeleton — the tutor "wakes up" before the first message. */
  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 420)
    return () => window.clearTimeout(timer)
  }, [])

  /* Never leak a pending mock reply. */
  useEffect(
    () => () => {
      if (replyTimer.current !== null) window.clearTimeout(replyTimer.current)
    },
    [],
  )

  /* Keep the newest message in view. */
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [messages, thinking, reduced])

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text || thinking || booting) return

    const subjectId = detectSubject(text)
    setMessages((prev) => [
      ...prev,
      { id: `msg-user-${Date.now()}`, role: 'user', text, time: timeNow(), subjectId },
    ])
    setDraft('')
    setThinking(true)

    if (replyTimer.current !== null) window.clearTimeout(replyTimer.current)
    replyTimer.current = window.setTimeout(() => {
      const reply = buildTutorReply(text, mode)
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-tutor-${Date.now()}`,
          role: 'assistant',
          text: reply.text,
          time: timeNow(),
          reply,
          subjectId,
        },
      ])
      setThinking(false)
      replyTimer.current = null
    }, 700)
  }

  const clearChat = () => {
    if (replyTimer.current !== null) {
      window.clearTimeout(replyTimer.current)
      replyTimer.current = null
    }
    setThinking(false)
    setMessages([])
    toast({
      title: 'Chat cleared',
      description: 'The tutor is ready for a fresh question.',
    })
  }

  const saveToMistakeBook = () => {
    const last = [...messages].reverse().find((entry) => entry.role === 'assistant' && entry.reply)
    if (!last?.reply) return
    const stepCount = last.reply.steps?.length ?? 0
    toast({
      title: 'Saved to MistakeBook',
      description: stepCount
        ? `${stepCount} steps queued for your next revision sprint.`
        : 'The answer is queued for your next revision sprint.',
      variant: 'success',
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    send(draft)
  }

  /* Follow-up chips only hang off the latest tutor answer. */
  let lastAssistantIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      lastAssistantIndex = index
      break
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="AI Tutor"
        subtitle="Ask a doubt, get a nudge instead of the answer, or generate a full exam-length response in the mode you choose."
        actions={
          <>
            <IconButton
              label="Save last answer to MistakeBook"
              size="lg"
              variant="soft"
              disabled={!hasSavedAnswer}
              className="disabled:cursor-not-allowed disabled:opacity-50"
              onClick={saveToMistakeBook}
            >
              <BookmarkPlus />
            </IconButton>
            <IconButton
              label="Clear chat"
              size="lg"
              variant="soft"
              disabled={messages.length === 0}
              className="disabled:cursor-not-allowed disabled:opacity-50"
              onClick={clearChat}
            >
              <Trash2 />
            </IconButton>
          </>
        }
      />

      <section aria-labelledby="tutor-mode-heading" className="space-y-3">
        <SectionHeader
          id="tutor-mode-heading"
          title="Tutor mode"
          subtitle={`${activeMode.label} — ${activeMode.hint}`}
        />
        <div
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
          role="group"
          aria-label="Tutor modes"
        >
          {TUTOR_MODES.map((entry) => (
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
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-success" />
              <h2 className="text-sm font-semibold text-foreground">Tutor session</h2>
              <span className="tabular truncate text-[12px] text-faint">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            </div>
            <Badge variant="brand">{activeMode.label}</Badge>
          </header>

          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label="Tutor messages"
            className="h-[46vh] max-h-[480px] min-h-[300px] overflow-y-auto px-4 py-4 no-scrollbar"
          >
            {messages.length === 0 ? (
              <TutorHero onPick={send} />
            ) : (
              <ul role="list" className="space-y-4">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    showFollowUps={!thinking && index === lastAssistantIndex}
                    onFollowUp={send}
                  />
                ))}
                {thinking && <TypingBubble />}
              </ul>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              send(draft)
            }}
            className="border-t border-border p-3"
          >
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={600}
                placeholder="Ask a doubt, paste a numerical…"
                aria-label="Message the AI Tutor"
                className="min-w-0 flex-1"
              />
              <Button
                type="submit"
                icon={<Send />}
                disabled={!draft.trim() || thinking}
                className="shrink-0"
              >
                Send
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-faint">
              Enter to send · Shift + Enter for a new line · Replying in{' '}
              <span className="font-semibold text-muted">{activeMode.label}</span> mode
            </p>
          </form>
        </section>
      )}
    </div>
  )
}
