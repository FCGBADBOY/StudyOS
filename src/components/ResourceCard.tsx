import { Link } from 'react-router-dom'
import type { ComponentType } from 'react'
import {
  ArrowRight,
  BookOpen,
  Download,
  FileText,
  HelpCircle,
  PenLine,
  PlayCircle,
  ScrollText,
  Sigma,
  Spline,
  Library,
} from 'lucide-react'
import type { Resource, ResourceType } from '@/types'
import { Badge, Card, IconTile } from './ui'
import { FavoriteButton } from './FavoriteButton'
import { resourceTheme } from '@/config/visual'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

export const RESOURCE_ICONS: Record<ResourceType, ComponentType<{ className?: string }>> = {
  notes: BookOpen,
  pyq: FileText,
  'sample-paper': ScrollText,
  'important-questions': HelpCircle,
  'formula-sheet': Sigma,
  diagram: Spline,
  revision: PenLine,
  video: PlayCircle,
  reference: Library,
}

const TYPE_LABELS: Record<ResourceType, string> = {
  notes: 'Notes',
  pyq: 'PYQs',
  'sample-paper': 'Sample Paper',
  'important-questions': 'Important Questions',
  'formula-sheet': 'Formula Sheet',
  diagram: 'Diagrams',
  revision: 'Revision',
  video: 'Video',
  reference: 'Reference',
}

/**
 * Provenance stamp shown above the title. The API only tells us what *kind* of
 * material a resource is, so the label states exactly what that kind guarantees
 * — an individual pack never claims a source it was not given.
 */
const PROVENANCE: Record<ResourceType, string> = {
  notes: 'Textbook notes',
  pyq: 'Verified PYQ',
  'sample-paper': 'Board format',
  'important-questions': 'High yield',
  'formula-sheet': 'Exam formulae',
  diagram: 'Marking points',
  revision: 'Quick review',
  video: 'Video lesson',
  reference: 'Reference set',
}

export interface ResourceCardProps {
  resource: Resource
  /** Subject used for the card's accent rail (falls back to the resource's subject). */
  subjectId?: string
  onOpen?: (resource: Resource) => void
  className?: string
  compact?: boolean
}

/**
 * Card for a single study resource (notes, PYQ pack, formula sheet…).
 *
 * The resource *type* owns the identity — a gradient icon tile in the type's
 * theme plus a provenance stamp — while the subject shows as a thin rail down
 * the left edge, so two packs from the same subject still read as different
 * kinds of material.
 */
export function ResourceCard({ resource, subjectId, onOpen, className, compact }: ResourceCardProps) {
  const Icon = RESOURCE_ICONS[resource.type]
  const theme = resourceTheme(resource.type)
  const accent = subjectAccent(subjectId ?? resource.subjectId)

  const content = (
    <>
      {/* Subject rail — ties the pack back to its subject at a glance. */}
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', accent.solid)} />
      <div className="flex items-start gap-3 sm:gap-4">
        <IconTile icon={<Icon />} theme={theme} variant="gradient" size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge theme={theme} uppercase dot>
              {PROVENANCE[resource.type]}
            </Badge>
            {resource.downloaded && (
              <Badge variant="success" icon={<Download />}>
                Offline
              </Badge>
            )}
          </div>

          <h3 className="clamp-2 mt-2 text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
            {resource.title}
          </h3>
          {!compact && (
            <p className="clamp-2 mt-1 text-[13px] leading-snug text-muted">{resource.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5 text-[12px] text-faint">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-muted">{TYPE_LABELS[resource.type]}</span>
              <span aria-hidden>·</span>
              <span className="font-medium text-muted">{resource.meta}</span>
              <span aria-hidden>·</span>
              <span>Updated {resource.updated}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand transition-transform duration-150 group-hover:translate-x-0.5">
              Open
              <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
        <FavoriteButton id={resource.id} label="Save resource" size="sm" className="-mr-1 -mt-1" />
      </div>
    </>
  )

  const shared = cn('group relative w-full overflow-hidden text-left', className)

  if (onOpen) {
    return (
      <Card interactive padded={false} className={shared}>
        <button
          type="button"
          onClick={() => onOpen(resource)}
          className="w-full rounded-card p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:p-5"
        >
          {content}
        </button>
      </Card>
    )
  }

  return (
    <Card interactive padded className={shared}>
      {content}
    </Card>
  )
}

/** Small link-styled resource row used inside dense lists. */
export function ResourceRow({ resource, to }: { resource: Resource; to: string }) {
  const Icon = RESOURCE_ICONS[resource.type]
  const theme = resourceTheme(resource.type)

  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-tile px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      <IconTile icon={<Icon />} theme={theme} variant="soft" size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{resource.title}</span>
        <span className="block text-[12px] text-faint">{resource.meta}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </Link>
  )
}
