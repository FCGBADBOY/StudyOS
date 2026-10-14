/**
 * Citation cards — the "where did that come from?" surface.
 *
 * Every source is a real row that retrieval actually matched (a StudyOS
 * resource chunk or a past-year question). Nothing here is generated:
 * `generated` marks AI-made practice material so it can never be mistaken for
 * a PYQ.
 *
 * Visual treatment: each citation reads like a reference slip — a themed
 * resource tile, the title, its metadata, and the excerpt shown in a quiet
 * cream strip so the student can see *why* this row was trusted.
 */
import { BookOpen, FileText, Image as ImageIcon, Play, Sigma } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, IconTile } from '@/components/ui'
import { resourceTheme, type ThemeKey } from '@/config/visual'
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

const KIND_ICONS: Record<string, LucideIcon> = {
  notes: FileText,
  revision_notes: FileText,
  formula_sheet: Sigma,
  important_questions: BookOpen,
  sample_paper: FileText,
  reference_material: BookOpen,
  diagram: ImageIcon,
  video: Play,
  pyq: BookOpen,
  chapter: BookOpen,
  book: BookOpen,
}

export function SourceCards({ sources, compact = false }: { sources: Source[]; compact?: boolean }) {
  if (!sources.length) return null

  return (
    <div className="mt-3 space-y-2">
      <p className="eyebrow">
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

          const theme: ThemeKey = resourceTheme(source.kind)
          const Icon = KIND_ICONS[source.kind] ?? FileText

          const body = (
            <div className="flex items-start gap-3">
              <IconTile icon={<Icon />} theme={theme} variant="outlined" size="sm" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <span className="clamp-2 min-w-0 basis-40 text-[13px] font-semibold leading-snug text-foreground">
                    {source.title || 'Untitled source'}
                  </span>
                  <Badge theme={source.generated ? 'ai' : theme} size="sm">
                    {source.generated ? 'AI-generated' : KIND_LABEL[source.kind] ?? source.kind}
                  </Badge>
                </div>

                {meta.length > 0 && <p className="mt-1 text-[11px] text-faint">{meta.join(' · ')}</p>}

                {!compact && source.excerpt && (
                  <p className="mt-1.5 rounded-tile bg-cream px-2.5 py-2 text-[12px] leading-snug text-muted">
                    {source.excerpt}
                  </p>
                )}

                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-faint">
                  {typeof source.score === 'number' && source.score > 0 && (
                    <span className="tabular font-semibold">
                      {Math.min(99, Math.round(source.score * 100))}% match
                    </span>
                  )}
                  {source.section && <span className="truncate">{source.section}</span>}
                </div>
              </div>
            </div>
          )

          return (
            <li key={`${source.kind}-${source.id}-${index}`}>
              {source.href ? (
                <a
                  href={source.href}
                  className={cn(
                    'block rounded-tile bg-surface p-3 shadow-card transition-shadow duration-150',
                    'outline-none hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring',
                  )}
                >
                  {body}
                </a>
              ) : (
                <div className="rounded-tile bg-surface p-3 shadow-card">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
