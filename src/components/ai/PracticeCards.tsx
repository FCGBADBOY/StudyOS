/**
 * Generated practice surfaces: an interactive quiz and a flip deck.
 *
 * Everything here is labelled **AI-GENERATED PRACTICE** — never presented as
 * a past-year question, because the model writes these (grounded in your
 * library, but written).
 */
import { useState } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { Badge, Button, Chip } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { FlashcardItem, QuizItem } from '@/ai/types'

function difficultyTone(difficulty: string): 'success' | 'warning' | 'danger' {
  if (difficulty === 'easy') return 'success'
  if (difficulty === 'hard') return 'danger'
  return 'warning'
}

/* --------------------------------- quiz ---------------------------------- */

export function QuizCard({ title, items }: { title?: string; items: QuizItem[] }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState<Record<string, number>>({})

  if (!items.length) return null

  return (
    <div className="mt-3 rounded-tile border border-border-strong bg-surface p-3 pl-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title ?? 'Practice quiz'}</p>
          <p className="text-[11px] text-faint">{items.length} question{items.length === 1 ? '' : 's'}</p>
        </div>
        <Badge variant="accent">AI-generated practice</Badge>
      </div>

      <ol role="list" className="mt-3 space-y-3">
        {items.map((item, index) => {
          const isRevealed = Boolean(revealed[item.id])
          const chosen = picked[item.id]

          return (
            <li key={item.id} className="rounded-tile border border-border bg-surface-muted p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[13px] font-medium leading-snug text-foreground">
                  <span className="tabular text-faint">Q{index + 1}. </span>
                  {item.question}
                </p>
                <Badge variant={difficultyTone(item.difficulty)} size="sm">{item.difficulty}</Badge>
              </div>

              {item.options && item.options.length > 0 && (
                <ul role="list" className="mt-2 space-y-1.5">
                  {item.options.map((option, optionIndex) => {
                    const isSelected = chosen === optionIndex
                    const correctIndex = item.options!.findIndex((entry) => entry.trim() === item.answer.trim())
                    const showCorrect = isRevealed && optionIndex === correctIndex
                    const showWrong = isRevealed && isSelected && optionIndex !== correctIndex

                    return (
                      <li key={optionIndex}>
                        <button
                          type="button"
                          disabled={isRevealed}
                          onClick={() => setPicked((prev) => ({ ...prev, [item.id]: optionIndex }))}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-tile border px-2 py-1.5 text-left text-[13px] transition-colors',
                            showCorrect && 'border-success bg-success-soft text-foreground',
                            showWrong && 'border-danger bg-danger-soft text-foreground',
                            !isRevealed && isSelected && 'border-brand bg-brand-soft',
                            !isRevealed && !isSelected && 'border-border bg-surface hover:border-border-strong',
                          )}
                        >
                          <span className="tabular text-faint">{String.fromCharCode(65 + optionIndex)}.</span>
                          <span className="min-w-0 flex-1 break-words">{option}</span>
                          {showCorrect && <Check aria-hidden className="h-4 w-4 shrink-0 text-success" />}
                          {showWrong && <X aria-hidden className="h-4 w-4 shrink-0 text-danger" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {isRevealed && (
                <div className="mt-2 space-y-1">
                  <p className="text-[12px] font-semibold text-success">Answer: {item.answer}</p>
                  {item.explanation && <p className="text-[12px] leading-snug text-muted">{item.explanation}</p>}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-faint">
                  {item.marks} mark{item.marks === 1 ? '' : 's'}
                  {item.source ? ` · ${item.source}` : ''}
                </span>
                <Chip
                  onClick={() => setRevealed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="min-h-9 text-[12px]"
                >
                  {isRevealed ? 'Hide answer' : item.options ? 'Check answer' : 'Show answer'}
                </Chip>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ------------------------------ flashcards -------------------------------- */

export function FlashcardDeck({ title, cards }: { title?: string; cards: FlashcardItem[] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!cards.length) return null
  const card = cards[Math.min(index, cards.length - 1)]

  const step = (delta: number) => {
    setFlipped(false)
    setIndex((prev) => (prev + delta + cards.length) % cards.length)
  }

  return (
    <div className="mt-3 rounded-tile border border-border-strong bg-surface p-3 pl-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title ?? 'Flashcards'}</p>
          <p className="text-[11px] text-faint">
            Card {index + 1} of {cards.length}
          </p>
        </div>
        <Badge variant="accent">AI-generated practice</Badge>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((prev) => !prev)}
        aria-pressed={flipped}
        className={cn(
          'mt-3 flex min-h-[120px] w-full flex-col items-center justify-center gap-1 rounded-tile border px-3 py-4 text-center transition-colors',
          flipped ? 'border-brand bg-brand-soft' : 'border-border bg-surface-muted',
        )}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {flipped ? 'Answer' : 'Question'}
        </span>
        <span className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
          {flipped ? card.answer : card.question}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[11px] text-brand-soft-fg">
          <RefreshCw aria-hidden className="h-3 w-3" />
          Tap to {flipped ? 'see the question' : 'flip'}
        </span>
      </button>

      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge variant={difficultyTone(card.difficulty)} size="sm">{card.difficulty}</Badge>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => step(-1)}>
            Previous
          </Button>
          <Button variant="soft" size="sm" onClick={() => step(1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
