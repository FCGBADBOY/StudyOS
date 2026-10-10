/**
 * Citation cards — the "where did that come from?" surface.
 *
 * Every source is a real row that retrieval actually matched (a StudyOS
 * resource chunk or a past-year question). Nothing here is generated:
 * `generated` marks AI-made practice material so it can never be mistaken for
 * a PYQ.
 */
import { Badge } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { Source } from '@/ai/types'

const KIND_LABEL: Record<string, string> = {
  notes: 'Notes',
  revision_notes: 'Revision notes',
  formula_sheet: 'Formula sheet',
  important_questions: 'Important questions',
  sample_paper: 'Sample paper',
  reference_material: 'Reference',
  diagram: 'Diagram',
  video: 'Video',
  other: 'Resource',
  pyq: 'Past year',
  chapter: 'Chapter',
  book: 'Book',
}

function kindTone(kind: Source['kind']): 'brand' | 'accent' | 'warning' | 'neutral' {
  if (kind === 'pyq') return 'warning'
  if (kind === 'formula_sheet') return 'accent'
  if (kind === 'revision_notes' || kind === 'notes') return 'brand'
  return 'neutral'
}

export function SourceCards({ sources, compact = false }: { sources: Source[]; compact?: boolean }) {
  if (!sources.length) return null

  return (
    <div className="mt-3 space-y-2 pl-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {sources.length} source{sources.length === 1 ? '' : 's'} used
      </p>
      <ul role="list" className="space-y-2">
        {sources.map((source, index) => {
          const meta = [
            source.subject,
            source.chapter,
            source.year ? `${source.year}` : null,
            source.marks ? `${source.marks} marks` : null,
            source.page ? `p. ${source.page}` : null,
          ].filter(Boolean)

          const body = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-[13px] font-semibold leading-snug text-foreground">
                  {source.title || 'Untitled source'}
                </span>
                <Badge variant={source.generated ? 'accent' : kindTone(source.kind)} size="sm">
                  {source.generated ? 'AI-generated' : KIND_LABEL[source.kind] ?? source.kind}
                </Badge>
              </div>

              {meta.length > 0 && (
                <p className="mt-0.5 text-[11px] text-faint">{meta.join(' · ')}</p>
              )}

              {!compact && source.excerpt && (
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted">{source.excerpt}</p>
              )}

              <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                {typeof source.score === 'number' && source.score > 0 && (
                  <span className="tabular">{Math.min(99, Math.round(source.score * 100))}% match</span>
                )}
                {source.section && <span className="truncate">{source.section}</span>}
              </div>
            </>
          )

          return (
            <li key={`${source.kind}-${source.id}-${index}`}>
              {source.href ? (
                <a
                  href={source.href}
                  className={cn(
                    'block rounded-tile border border-border bg-surface p-2.5 transition-colors',
                    'hover:border-brand-soft hover:bg-surface-muted',
                  )}
                >
                  {body}
                </a>
              ) : (
                <div className="rounded-tile border border-border bg-surface p-2.5">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
