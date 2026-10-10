import { useState } from 'react'
import { BookmarkPlus, CalendarDays, ChevronDown, Repeat } from 'lucide-react'
import type { PyqQuestion } from '@/types'
import { Badge, Card, Chip } from './ui'
import { difficultyTone, subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

export interface QuestionCardProps {
  question: PyqQuestion
  /** Show the chapter name (default true). */
  showChapter?: boolean
  index?: number
  onSave?: (question: PyqQuestion) => void
  className?: string
}

/**
 * Previous-year question card: metadata badges, the question itself,
 * concept tags and a collapsible solution outline.
 */
export function QuestionCard({ question, showChapter = true, onSave, className }: QuestionCardProps) {
  const [open, setOpen] = useState(false)
  const accent = subjectAccent(question.subjectId)

  return (
    <Card padded className={cn('relative overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="neutral" className="tabular">
          {question.year}
        </Badge>
        <Badge variant="neutral">{question.type}</Badge>
        <Badge variant={difficultyTone(question.difficulty)}>{question.difficulty}</Badge>
        <Badge variant="brand">{question.marks} marks</Badge>
        {question.repeated && (
          <Badge variant="warning" icon={<Repeat />}>
            Repeated
          </Badge>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground">{question.question}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {question.concepts.map((concept) => (
          <Chip key={concept} className="px-2.5 py-1 text-[12px]">
            {concept}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-[12px] text-faint">
        {showChapter && (
          <span className={cn('font-medium', accent.text)}>{question.chapter}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarDays aria-hidden className="h-3.5 w-3.5" />
          CBSE {question.year}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-control text-[13px] font-semibold text-brand hover:underline"
        >
          {open ? 'Hide solution outline' : 'View solution outline'}
          <ChevronDown
            aria-hidden
            className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>

        {onSave && (
          <button
            type="button"
            onClick={() => onSave(question)}
            className="inline-flex items-center gap-1.5 rounded-control border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <BookmarkPlus aria-hidden className="h-3.5 w-3.5" />
            Add to MistakeBook
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-tile border border-border bg-surface-muted p-3.5">
          <ol className="space-y-2 text-[13px] leading-relaxed text-muted">
            {question.concepts.map((concept, index) => (
              <li key={concept} className="flex gap-2.5">
                <span className="tabular mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-soft-fg">
                  {index + 1}
                </span>
                <span>
                  {index === 0
                    ? `Identify the underlying concept: ${concept}.`
                    : `Apply ${concept} with the given data and quote the result with units.`}
                </span>
              </li>
            ))}
            <li className="flex gap-2.5">
              <span className="tabular mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-soft-fg">
                {question.concepts.length + 1}
              </span>
              <span>State the final answer with the SI unit and a one-line interpretation.</span>
            </li>
          </ol>
        </div>
      )}
    </Card>
  )
}
