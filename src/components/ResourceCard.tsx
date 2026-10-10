import { Link } from 'react-router-dom'
import type { ComponentType } from 'react'
import {
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
import { Badge, Card } from './ui'
import { FavoriteButton } from './FavoriteButton'
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

export interface ResourceCardProps {
  resource: Resource
  /** Subject used for the icon tint (falls back to the resource's subject). */
  subjectId?: string
  onOpen?: (resource: Resource) => void
  className?: string
  compact?: boolean
}

/** Row card for a single study resource (notes, PYQ pack, formula sheet…). */
export function ResourceCard({ resource, subjectId, onOpen, className, compact }: ResourceCardProps) {
  const Icon = RESOURCE_ICONS[resource.type]
  const accent = subjectAccent(subjectId ?? resource.subjectId)

  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-tile',
            accent.soft,
            accent.text,
            '[&_svg]:h-[18px] [&_svg]:w-[18px]',
          )}
        >
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{TYPE_LABELS[resource.type]}</Badge>
            {resource.downloaded && (
              <Badge variant="success" icon={<Download />}>
                Offline
              </Badge>
            )}
          </div>
          <h3 className="clamp-2 mt-1.5 text-sm font-semibold leading-snug text-foreground">
            {resource.title}
          </h3>
          {!compact && (
            <p className="clamp-2 mt-1 text-[13px] leading-snug text-muted">{resource.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
            <span className="font-medium text-muted">{resource.meta}</span>
            <span aria-hidden>·</span>
            <span>Updated {resource.updated}</span>
          </div>
        </div>
        <FavoriteButton id={resource.id} label="Save resource" size="sm" />
      </div>
    </>
  )

  const shared = cn(
    'group w-full text-left transition-colors hover:border-border-strong',
    className,
  )

  if (onOpen) {
    return (
      <Card interactive padded={false} className={shared}>
        <button
          type="button"
          onClick={() => onOpen(resource)}
          className="w-full rounded-card p-4 text-left sm:p-5"
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
  const accent = subjectAccent(resource.subjectId)

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong"
    >
      <span aria-hidden className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-tile', accent.soft, accent.text, '[&_svg]:h-4 [&_svg]:w-4')}>
        <Icon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{resource.title}</span>
        <span className="block text-[12px] text-faint">{resource.meta}</span>
      </span>
    </Link>
  )
}
