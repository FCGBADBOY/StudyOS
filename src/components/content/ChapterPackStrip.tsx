/**
 * Chapter pack completeness (spec §67/§68).
 *
 * Answers a student's first question honestly: *what is actually here?*
 *
 * Everything on this strip is counted from rows — `resources` for the
 * material and `pyq_questions` for past questions. Nothing is inferred and
 * nothing is seeded: in a deployment with no backend the counts are 0 and the
 * strip says so, rather than showing a plausible-looking tick it cannot back
 * up.
 *
 * Deliberately static. It is a status line above a page of content, and an
 * animated "loading" for a count that is already known would only delay
 * reading. `prefers-reduced-motion` is therefore irrelevant here by
 * construction.
 */
import { Check, Minus } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { Resource, ResourceType } from '@/types'
import { cn } from '@/utils/cn'

/** The six pieces a complete chapter pack should contain. */
const PACK: Array<{ type: ResourceType; label: string }> = [
  { type: 'notes', label: 'Notes' },
  { type: 'revision', label: 'Revision' },
  { type: 'formula-sheet', label: 'Formulas' },
  { type: 'important-questions', label: 'Important Qs' },
  { type: 'pyq', label: 'PYQs' },
  { type: 'sample-paper', label: 'Sample papers' },
]

export interface ChapterPackStripProps {
  resources: Resource[]
  /** Number of PYQ questions mapped to this chapter (0 when there are none). */
  pyqCount?: number
  className?: string
}

export function ChapterPackStrip({ resources, pyqCount, className }: ChapterPackStripProps) {
  const counts = new Map<ResourceType, number>()
  for (const resource of resources) {
    counts.set(resource.type, (counts.get(resource.type) ?? 0) + 1)
  }

  const present = PACK.filter((entry) => countFor(entry.type, counts, pyqCount) > 0).length
  const total = PACK.length

  return (
    <section
      aria-label="What this chapter pack contains"
      className={cn('rounded-card border border-border bg-surface', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="text-[13px] font-semibold text-foreground">Chapter pack</p>
        <Badge variant={present === total ? 'success' : present >= 3 ? 'brand' : 'warning'}>
          {present} of {total} ready
        </Badge>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3">
        {PACK.map((entry) => {
          const count = countFor(entry.type, counts, pyqCount)
          const ready = count > 0
          return (
            <li key={entry.type} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'grid h-4.5 w-4.5 place-items-center rounded-full',
                  ready ? 'bg-success-soft text-success' : 'bg-surface-muted text-faint',
                )}
              >
                {ready ? <Check className="size-3" strokeWidth={3} /> : <Minus className="size-3" />}
              </span>
              <span className={cn('text-[13px]', ready ? 'text-foreground' : 'text-faint')}>
                {entry.label}
              </span>
              <span className="sr-only">
                {ready ? `${count} available` : 'not available yet'}
              </span>
              {ready && (
                <span aria-hidden className="text-[12px] tabular-nums text-faint">
                  {count}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {present < total && (
        <p className="border-t border-border px-4 py-2.5 text-[13px] leading-relaxed text-muted">
          The remaining {total - present} piece{total - present === 1 ? ' is' : 's are'} not published yet.
          Generated material is validated and reviewed by a person before it appears here.
        </p>
      )}
    </section>
  )
}

function countFor(
  type: ResourceType,
  counts: Map<ResourceType, number>,
  pyqCount?: number,
): number {
  /* PYQ questions live in `pyq_questions`, not `resources` — counting only
     resources would under-report a chapter that has a healthy question bank. */
  if (type === 'pyq' && typeof pyqCount === 'number' && pyqCount > 0) return pyqCount
  return counts.get(type) ?? 0
}
