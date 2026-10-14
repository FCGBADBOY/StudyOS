/**
 * Action chips under an answer.
 *
 * Two groups:
 *   • suggested follow-ups from the server (`relatedQuestions`) — derived from
 *     real PYQ rows and the student's own weak chapters, never invented;
 *   • response actions (next hint, reveal solution, quiz me, copy, save…).
 *
 * Chips emit either a follow-up message or a typed action.
 */
import { useRef, useState, useLayoutEffect } from 'react'
import { Check, Copy, RotateCcw, Save } from 'lucide-react'
import { Chip } from '@/components/ui'
import { buttonPress, cardHover } from '@/animations'
import type { AIAction, ResponseMeta } from '@/ai/types'

export interface AnswerAction {
  id: AIAction
  label: string
}

/** Message the chip sends (keeps the server's intent detection obvious). */
export const ACTION_MESSAGES: Record<AIAction, string> = {
  explain_simpler: 'Explain that again, more simply.',
  give_example: 'Give me a worked example of this.',
  give_hint: 'Give me a hint without solving it.',
  show_pyqs: 'Show me past-year questions on this topic.',
  quiz_me: 'Quiz me on this topic.',
  make_flashcards: 'Turn this into flashcards.',
  next_hint: 'Give me the next hint.',
  reveal_solution: 'Now show me the full solution.',
  save: 'Save this to my revision list.',
}

const STANDARD_ACTIONS: AnswerAction[] = [
  { id: 'give_example', label: 'Give an example' },
  { id: 'explain_simpler', label: 'Explain simpler' },
  { id: 'show_pyqs', label: 'Past-year questions' },
  { id: 'quiz_me', label: 'Quiz me' },
  { id: 'make_flashcards', label: 'Make flashcards' },
]

function hintActions(meta: ResponseMeta): AnswerAction[] {
  if (meta.type !== 'hint') return []
  const actions: AnswerAction[] = []
  if (meta.hint?.hasMore) actions.push({ id: 'next_hint', label: 'Next hint' })
  actions.push({ id: 'reveal_solution', label: 'Show the solution' })
  return actions
}

export function ActionChips({
  text,
  meta,
  onAction,
  onFollowUp,
  onRegenerate,
  onSave,
}: {
  /** Full answer text (copy / save use it). */
  text: string
  meta: ResponseMeta | null
  onAction: (action: AIAction, message: string) => void
  onFollowUp?: (question: string) => void
  onRegenerate?: () => void
  onSave?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const responseActions = meta ? hintActions(meta) : []
  const standard = meta && meta.type === 'hint' ? [] : STANDARD_ACTIONS
  const suggestions = meta?.relatedQuestions ?? []
  const showSave = Boolean(onSave)

  /* Re-attach the tactile handlers whenever the chip set changes shape. */
  const signature = [
    suggestions.length,
    responseActions.map((entry) => entry.id).join(','),
    showSave ? 'save' : '',
    onRegenerate ? 'regen' : '',
  ].join('|')

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cleanups = Array.from(root.querySelectorAll('button')).map((chip) => {
      const press = buttonPress(chip)
      const hover = cardHover(chip)
      return () => {
        press()
        hover()
      }
    })
    return () => cleanups.forEach((fn) => fn())
  }, [signature])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — the answer is still on screen, nothing breaks */
    }
  }

  const save = () => {
    onSave?.()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const hasAnything = responseActions.length || standard.length || suggestions.length || onRegenerate || showSave
  if (!hasAnything) return null

  return (
    <div ref={rootRef} className="mt-3 space-y-2">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((question) => (
            <Chip
              key={question}
              onClick={() => onFollowUp?.(question)}
              className="min-h-11 max-w-full text-left text-[12.5px] shadow-card"
            >
              <span className="min-w-0 break-words">{question}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[...responseActions, ...standard].map((action) => (
          <Chip
            key={action.id}
            onClick={() => onAction(action.id, ACTION_MESSAGES[action.id])}
            className="min-h-11 text-[12px]"
          >
            {action.label}
          </Chip>
        ))}

        <Chip onClick={() => void copy()} className="min-h-11 text-[12px]" ariaLabel="Copy answer">
          {copied ? (
            <Check aria-hidden className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy aria-hidden className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Chip>

        {onRegenerate && (
          <Chip onClick={onRegenerate} className="min-h-11 text-[12px]" ariaLabel="Regenerate answer">
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            Regenerate
          </Chip>
        )}

        {showSave && (
          <Chip onClick={save} className="min-h-11 text-[12px]" ariaLabel="Save to MistakeBook">
            <Save aria-hidden className="h-3.5 w-3.5" />
            {saved ? 'Saved' : 'Save to MistakeBook'}
          </Chip>
        )}
      </div>
    </div>
  )
}
