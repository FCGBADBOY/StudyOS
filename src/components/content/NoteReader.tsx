/**
 * Structured note renderer.
 *
 * Generated notes are stored as `sections → items`, where every item carries a
 * type (spec §15). That is the point: a formula renders as a formula, a common
 * mistake renders as a warning, a comparison renders as a table — not one
 * undifferentiated blob of text.
 *
 * Shared by the admin review queue and the student chapter page so an editor
 * approves exactly what a student will see, at the same size and with the same
 * emphasis.
 *
 * No animation here on purpose: this is reading content, and it must render
 * instantly and be fully usable with motion disabled.
 */
import { Fragment, type ReactNode } from 'react'
import { AlertTriangle, Beaker, Lightbulb, PenLine } from 'lucide-react'
import type { NoteItemType } from '@/content-engine/types'
import { cn } from '@/utils/cn'

export interface ReaderItem {
  id?: string
  item_type: NoteItemType | string
  body: string
  meta?: Record<string, unknown>
}

export interface ReaderSection {
  id?: string
  heading: string
  summary?: string | null
  items: ReaderItem[]
}

/** `a | b | c` rows → a real table. Only used for `table` items. */
function parseTable(body: string): string[][] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length > 0)
}

export function NoteReader({
  sections,
  className,
  headingLevel = 'h3',
}: {
  sections: ReaderSection[]
  className?: string
  headingLevel?: 'h3' | 'h4'
}) {
  if (!sections.length) {
    return (
      <p className={cn('text-sm text-faint', className)}>This note has no content yet.</p>
    )
  }

  const Heading = headingLevel

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {sections.map((section, index) => (
        <section
          key={section.id ?? `${section.heading}-${index}`}
          aria-label={section.heading}
          className="min-w-0"
        >
          <Heading className="text-[15px] font-bold tracking-tight text-foreground">
            {section.heading}
          </Heading>
          {section.summary && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{section.summary}</p>
          )}

          <div className="mt-2.5 flex flex-col gap-2.5">
            {section.items.length === 0 ? (
              <p className="text-[13px] italic text-faint">Nothing was generated for this section.</p>
            ) : (
              section.items.map((item, itemIndex) => (
                <NoteItemView key={item.id ?? `${item.item_type}-${itemIndex}`} item={item} />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

/** One typed block. Every type has its own treatment — that is the contract. */
export function NoteItemView({ item }: { item: ReaderItem }) {
  const body = item.body ?? ''

  switch (item.item_type) {
    case 'heading':
      return (
        <p className="pt-1 text-[13.5px] font-bold uppercase tracking-wide text-foreground">{body}</p>
      )

    case 'definition':
      return (
        <div className="rounded-card border-l-2 border-brand bg-brand/5 px-3 py-2">
          <p className="text-[13.5px] leading-relaxed text-foreground">{body}</p>
        </div>
      )

    case 'formula':
      return (
        <p className="overflow-x-auto whitespace-pre-wrap rounded-control bg-surface-secondary px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground">
          {body}
        </p>
      )

    case 'derivation':
      return (
        <ol className="ml-4 flex list-decimal flex-col gap-1.5 marker:text-xs marker:text-faint">
          {body.split('\n').filter(Boolean).map((line, index) => (
            <li key={index} className="font-mono text-[13px] leading-relaxed text-foreground">
              {line.trim()}
            </li>
          ))}
        </ol>
      )

    case 'example':
      return (
        <div className="rounded-card border border-border bg-surface-secondary/70 p-3">
          <p className="eyebrow mb-1 flex items-center gap-1.5 text-faint">
            <PenLine aria-hidden className="size-3.5" />
            Worked example
          </p>
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{body}</p>
        </div>
      )

    case 'reaction':
      return (
        <p className="flex items-start gap-2 rounded-control bg-reaction/10 px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground">
          <Beaker aria-hidden className="mt-0.5 size-3.5 shrink-0 text-reaction" />
          <span className="min-w-0 whitespace-pre-wrap">{body}</span>
        </p>
      )

    case 'table': {
      const rows = parseTable(body)
      const [head, ...rest] = rows
      if (!head) return null
      return (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/70">
                {head.map((cell, cellIndex) => (
                  <th key={cellIndex} className="px-3 py-2 font-semibold text-foreground">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((cells, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border last:border-b-0">
                  {cells.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top text-muted">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case 'tip':
      return (
        <p className="flex items-start gap-2 rounded-control bg-success/10 px-3 py-2 text-[13px] leading-relaxed text-foreground">
          <Lightbulb aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
          <span className="min-w-0">{body}</span>
        </p>
      )

    case 'warning':
      return (
        <p className="flex items-start gap-2 rounded-control bg-warning/12 px-3 py-2 text-[13px] leading-relaxed text-foreground">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span className="min-w-0">{body}</span>
        </p>
      )

    case 'question':
      return <p className="text-[13.5px] font-medium leading-relaxed text-foreground">{body}</p>

    case 'answer':
      return <p className="ml-3 border-l border-border pl-3 text-[13px] leading-relaxed text-muted">{body}</p>

    case 'diagram':
      return (
        <figure className="rounded-card border border-dashed border-border px-3 py-2">
          <figcaption className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{body}</figcaption>
        </figure>
      )

    case 'paragraph':
    default:
      return <Paragraphs body={body} />
  }
}

/** Splits on blank lines so a paragraph block can hold more than one paragraph. */
function Paragraphs({ body }: { body: string }) {
  const parts = body.split(/\n{2,}/).filter((part) => part.trim())
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="sr-only"> </span>}
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">
            {part.trim()}
          </p>
        </Fragment>
      ))}
    </>
  )
}

/** Optional wrapper that renders a list of items outside a section. */
export function NoteItemsList({ items }: { items: ReaderItem[] }): ReactNode {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <NoteItemView key={item.id ?? `${item.item_type}-${index}`} item={item} />
      ))}
    </div>
  )
}
