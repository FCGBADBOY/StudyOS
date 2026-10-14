import { Link } from 'react-router-dom'
import { ChevronRight, Flame, Sparkles } from 'lucide-react'
import type { Chapter, Subject } from '@/types'
import { Badge, Card, IconTile, ProgressBar } from './ui'
import { FavoriteButton } from './FavoriteButton'
import { difficultyTone, subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

export interface ChapterCardProps {
  chapter: Chapter
  subject: Subject
  /** Deep link target — usually `/library/:board/:class/:subject/:chapter`. */
  to: string
  /** Show the two-line description (default true). */
  showDescription?: boolean
  className?: string
}

/**
 * Library list card: index, title, progress, difficulty and counts.
 *
 * The whole card wears the subject's tint so a Chemistry chapter is instantly
 * distinguishable from a Physics one, and depth comes from the shadow rather
 * than an edge — hover lifts the card, the fill bar carries the subject hue.
 */
export function ChapterCard({ chapter, subject, to, showDescription = true, className }: ChapterCardProps) {
  const accent = subjectAccent(subject.id)

  return (
    <Card
      interactive
      padded={false}
      tone={accent.theme}
      className={cn('overflow-hidden', className)}
    >
      <Link
        to={to}
        className="group flex h-full items-start gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:-ring-inset sm:gap-4 sm:p-5"
      >
        <IconTile
          icon={
            <span className="tabular text-[13px] font-extrabold">
              {String(chapter.index).padStart(2, '0')}
            </span>
          }
          theme={accent.theme}
          variant="filled"
          size="md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                  {chapter.title}
                </h3>
                {chapter.weak && (
                  <Badge theme="danger" emphasis icon={<Flame />}>
                    Weak
                  </Badge>
                )}
              </div>
              {showDescription && (
                <p className="clamp-2 mt-1 text-[13px] leading-snug text-muted">
                  {chapter.description}
                </p>
              )}
            </div>
            <FavoriteButton
              id={`chapter:${subject.id}:${chapter.slug}`}
              label="Save chapter"
              size="sm"
              className="-mr-1 -mt-1"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
            <Badge variant={difficultyTone(chapter.difficulty)}>{chapter.difficulty}</Badge>
            <span className="tabular text-faint">{chapter.questionCount} questions</span>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <span className="tabular text-faint">{chapter.pyqCount} PYQs</span>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <span className="tabular text-faint">~{Math.round(chapter.estimatedMinutes / 60) || 1} hr</span>
          </div>

          {/* The fill inherits the subject colour from the wrapper. */}
          <div className={cn('mt-3.5 flex items-center gap-3', accent.text)}>
            <ProgressBar
              value={chapter.progress}
              size="sm"
              variant="current"
              className="min-w-0 flex-1"
              valueText={`${chapter.progress}%`}
            />
            <ChevronRight
              aria-hidden
              className="h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </div>
        </div>
      </Link>
    </Card>
  )
}

export interface ChapterRowProps {
  chapter: Chapter
  subject: Subject
  to: string
  className?: string
}

/** Dense row variant used on the subject overview page. */
export function ChapterRow({ chapter, subject, to, className }: ChapterRowProps) {
  const accent = subjectAccent(subject.id)

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 rounded-card bg-surface px-3.5 py-3 shadow-card outline-none',
        'transition-shadow duration-150 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring sm:px-4',
        className,
      )}
    >
      <IconTile
        icon={
          <span className="tabular text-[13px] font-extrabold">
            {String(chapter.index).padStart(2, '0')}
          </span>
        }
        theme={accent.theme}
        variant="soft"
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{chapter.title}</span>
          {chapter.weak && <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0 text-warning" />}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-faint">
          <Badge variant={difficultyTone(chapter.difficulty)}>{chapter.difficulty}</Badge>
          <span className="tabular">{chapter.questionCount} Q</span>
          <span aria-hidden>·</span>
          <span className="tabular">{chapter.pyqCount} PYQ</span>
        </div>
      </div>

      <div className={cn('w-16 shrink-0 sm:w-24', accent.text)}>
        <ProgressBar value={chapter.progress} size="xs" variant="current" />
        <span className="tabular mt-1 block text-right text-[11px] font-semibold text-muted">
          {chapter.progress}%
        </span>
      </div>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
    </Link>
  )
}
