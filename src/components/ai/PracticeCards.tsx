/**
 * Generated practice surfaces: an interactive quiz and a flip deck.
 *
 * Everything here is labelled **AI-GENERATED PRACTICE** — never presented as
 * a past-year question, because the model writes these (grounded in your
 * library, but written).
 *
 * Visual treatment: a warm cream lab panel inside the answer, with white
 * question cards on top of it. Answer states move with Anime.js — a small
 * success pop when the answer is revealed, a restrained nudge when the pick
 * was wrong.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { Badge, Button, Card, Chip } from '@/components/ui'
import { nudge, successPop } from '@/animations'
import { cn } from '@/utils/cn'
import type { FlashcardItem, QuizItem } from '@/ai/types'

function difficultyTone(difficulty: string): 'success' | 'warning' | 'danger' {
  if (difficulty === 'easy') return 'success'
  if (difficulty === 'hard') return 'danger'
  return 'warning'
}

/** Label shared by both practice surfaces — the honesty marker. */
function PracticeLabel({ label }: { label: string }) {
  return <Badge theme="ai" uppercase>{label}</Badge>
}

/* --------------------------------- quiz ---------------------------------- */

function QuizQuestion({ item, index }: { item: QuizItem; index: number }) {
  const [revealed, setRevealed] = useState(false)
  const [chosen, setChosen] = useState<number | undefined>(undefined)
  const rowRef = useRef<HTMLLIElement>(null)

  /* Reveal pops the answer panel; a wrong pick gets a quiet nudge. */
  useLayoutEffect(() => {
    if (!revealed) return
    const row = rowRef.current
    const cleanups = [successPop(row?.querySelector<HTMLElement>('[data-reveal]'))]
    const wrong = row?.querySelector<HTMLElement>('[data-wrong]')
    if (wrong) cleanups.push(nudge(wrong))
    return () => cleanups.forEach((fn) => fn())
  }, [revealed])

  const correctIndex = item.options
    ? item.options.findIndex((entry) => entry.trim() === item.answer.trim())
    : -1

  return (
    <li ref={rowRef} className="rounded-tile bg-surface p-3 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 basis-48 text-[13px] font-medium leading-snug text-foreground">
          <span className="tabular text-faint">Q{index + 1}. </span>
          {item.question}
        </p>
        <Badge variant={difficultyTone(item.difficulty)} size="sm">
          {item.difficulty}
        </Badge>
      </div>

      {item.options && item.options.length > 0 && (
        <ul role="list" className="mt-2.5 space-y-1.5">
          {item.options.map((option, optionIndex) => {
            const isSelected = chosen === optionIndex
            const showCorrect = revealed && optionIndex === correctIndex
            const showWrong = revealed && isSelected && optionIndex !== correctIndex

            return (
              <li key={optionIndex}>
                <button
                  type="button"
                  disabled={revealed}
                  data-wrong={showWrong ? '' : undefined}
                  onClick={() => setChosen(optionIndex)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-tile px-2.5 py-2 text-left text-[13px] leading-snug transition-colors duration-150',
                    'outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
                    showCorrect && 'bg-success-soft text-foreground ring-1 ring-inset ring-success/40',
                    showWrong && 'bg-danger-soft text-foreground ring-1 ring-inset ring-danger/40',
                    !revealed && isSelected && 'bg-brand-soft text-foreground ring-1 ring-inset ring-brand-ring',
                    !revealed && !isSelected && 'bg-surface-muted hover:bg-surface-sunken',
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

      {revealed && (
        <div data-reveal className="mt-2.5 rounded-tile bg-cream px-3 py-2.5">
          <p className="text-[12.5px] font-bold text-success">Answer: {item.answer}</p>
          {item.explanation && (
            <p className="mt-1 text-[12.5px] leading-snug text-muted">{item.explanation}</p>
          )}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-faint">
          {item.marks} mark{item.marks === 1 ? '' : 's'}
          {item.source ? ` · ${item.source}` : ''}
        </span>
        <Chip
          onClick={() => setRevealed((prev) => !prev)}
          className="min-h-11 text-[12px]"
        >
          {revealed ? 'Hide answer' : item.options ? 'Check answer' : 'Show answer'}
        </Chip>
      </div>
    </li>
  )
}

export function QuizCard({ title, items }: { title?: string; items: QuizItem[] }) {
  if (!items.length) return null

  return (
    <Card tone="cream" elevation="card" className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold tracking-tight text-foreground">
            {title ?? 'Practice quiz'}
          </p>
          <p className="mt-0.5 text-[11px] text-faint">
            {items.length} question{items.length === 1 ? '' : 's'}
          </p>
        </div>
        <PracticeLabel label="AI-generated practice" />
      </div>

      <ol role="list" className="mt-3 space-y-3">
        {items.map((item, index) => (
          <QuizQuestion key={item.id} item={item} index={index} />
        ))}
      </ol>
    </Card>
  )
}

/* ------------------------------ flashcards -------------------------------- */

export function FlashcardDeck({ title, cards }: { title?: string; cards: FlashcardItem[] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const faceRef = useRef<HTMLButtonElement>(null)
  const firstFlip = useRef(true)

  /* The flip gets the "it worked" pop — but never on the very first paint. */
  useLayoutEffect(() => {
    if (firstFlip.current) {
      firstFlip.current = false
      return
    }
    return successPop(faceRef.current)
  }, [flipped])

  if (!cards.length) return null
  const card = cards[Math.min(index, cards.length - 1)]

  const step = (delta: number) => {
    setFlipped(false)
    setIndex((prev) => (prev + delta + cards.length) % cards.length)
  }

  return (
    <Card tone="cream" elevation="card" className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2">
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold tracking-tight text-foreground">{title ?? 'Flashcards'}</p>
          <p className="tabular mt-0.5 text-[11px] text-faint">
            Card {index + 1} of {cards.length}
          </p>
        </div>
        <PracticeLabel label="AI-generated practice" />
      </div>

      <button
        ref={faceRef}
        type="button"
        onClick={() => setFlipped((prev) => !prev)}
        aria-pressed={flipped}
        className={cn(
          'mt-3 flex min-h-[128px] w-full flex-col items-center justify-center gap-1.5 rounded-tile px-3.5 py-4 text-center transition-colors duration-150',
          'outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
          flipped ? 'bg-brand-soft' : 'bg-surface shadow-card',
        )}
      >
        <span className={cn('text-[10.5px] font-bold uppercase tracking-[0.14em]', flipped ? 'text-brand-soft-fg' : 'text-faint')}>
          {flipped ? 'Answer' : 'Question'}
        </span>
        <span className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
          {flipped ? card.answer : card.question}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-brand-soft-fg">
          <RefreshCw aria-hidden className="h-3 w-3" />
          Tap to {flipped ? 'see the question' : 'flip'}
        </span>
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Badge variant={difficultyTone(card.difficulty)} size="sm">
          {card.difficulty}
        </Badge>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => step(-1)}>
            Previous
          </Button>
          <Button variant="soft" size="sm" onClick={() => step(1)}>
            Next
          </Button>
        </div>
      </div>
    </Card>
  )
}
