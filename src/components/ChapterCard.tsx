import { Link } from 'react-router-dom'
import { ChevronRight, Flame, Sparkles } from 'lucide-react'
import type { Chapter, Subject } from '@/types'
import { Badge, Card, ProgressBar } from './ui'
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

/** Library list card: index, title, progress, difficulty and counts. */
export function ChapterCard({ chapter, subject, to, showDescription = true, className }: ChapterCardProps) {
  const accent = subjectAccent(subject.id)

  return (
    <Card interactive padded={false} className={cn('overflow-hidden', className)}>
      <Link to={to} className="block p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-tile text-sm font-bold tabular',
              accent.soft,
              accent.text,
            )}
          >
            {String(chapter.index).padStart(2, '0')}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[15px] font-semibold leading-snug text-foreground">
                    {chapter.title}
                  </h3>
                  {chapter.weak && (
                    <Badge variant="danger" icon={<Flame />}>
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

            <div className="mt-3 flex items-center gap-3">
              <ProgressBar
                value={chapter.progress}
                size="sm"
                variant={chapter.progress === 100 ? 'success' : 'brand'}
                className="flex-1"
                valueText={`${chapter.progress}%`}
              />
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
            </div>
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
        'flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 transition-colors hover:border-border-strong sm:px-4',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-tile text-[13px] font-bold tabular',
          accent.soft,
          accent.text,
        )}
      >
        {String(chapter.index).padStart(2, '0')}
      </span>

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

      <div className="w-16 shrink-0 sm:w-24">
        <ProgressBar
          value={chapter.progress}
          size="xs"
          variant={chapter.progress === 100 ? 'success' : 'brand'}
        />
        <span className="tabular mt-1 block text-right text-[11px] font-semibold text-muted">
          {chapter.progress}%
        </span>
      </div>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
    </Link>
  )
}
