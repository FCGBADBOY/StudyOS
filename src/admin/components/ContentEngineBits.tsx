/**
 * Content Engine admin primitives.
 *
 * Small, presentational pieces shared by the engine's four screens:
 *
 *   StatusPill        one vocabulary for job / content / source state
 *   QualityMeter      the validation score, animated once per fetch
 *   JobProgressBar    queue progress, animated, reduced-motion safe
 *   ProvenanceBlock   the "Source / Original URL / Retrieved / Redistribution"
 *                     block that keeps licence decisions visible to an editor
 *   EngineNotice      the honest "this deployment has no backend" banner
 *
 * Motion is deliberately minimal — this is a dense operational tool, not a
 * study surface. Everything respects `prefers-reduced-motion` through the
 * shared `canAnimate()` / `dur()` helpers (Anime.js only, no CSS keyframes).
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate } from 'animejs'
import { AlertTriangle, Info } from 'lucide-react'
import { Badge, ProgressBar, type BadgeVariant } from '@/components/ui'
import { canAnimate, dur } from '@/animations/motion'
import {
  CONTENT_STATUS_LABELS,
  JOB_STATUS_LABELS,
  JOB_STAGE_LABELS,
  RETRIEVAL_LABELS,
  OFFICIAL_STATUS_LABELS,
  LICENSE_LABELS,
  type ContentStatus,
  type JobStage,
  type JobStatus,
  type OfficialStatus,
  type RetrievalStatus,
  type LicenseStatus,
} from '@/content-engine/types'
import { cn } from '@/utils/cn'

/* -------------------------------------------------------------------------- */
/* Status pills                                                               */
/* -------------------------------------------------------------------------- */

const JOB_STATUS_VARIANT: Record<JobStatus, BadgeVariant> = {
  queued: 'neutral',
  running: 'brand',
  paused: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  partial: 'warning',
}

const CONTENT_STATUS_VARIANT: Record<ContentStatus, BadgeVariant> = {
  discovered: 'neutral',
  processing: 'brand',
  generated: 'brand',
  validation_failed: 'danger',
  needs_review: 'warning',
  approved: 'accent',
  published: 'success',
  archived: 'neutral',
  blocked: 'danger',
}

const LICENSE_VARIANT: Record<LicenseStatus, BadgeVariant> = {
  official: 'success',
  open_license: 'success',
  public_domain: 'success',
  permission_granted: 'success',
  unknown: 'warning',
  restricted: 'danger',
}

const OFFICIAL_VARIANT: Record<OfficialStatus, BadgeVariant> = {
  verified_official: 'success',
  verified_source_archive: 'accent',
  third_party: 'warning',
  unverified: 'neutral',
}

const RETRIEVAL_VARIANT: Record<RetrievalStatus, BadgeVariant> = {
  discovered: 'neutral',
  stored: 'success',
  linked: 'outline',
  blocked: 'danger',
  failed: 'danger',
  archived: 'neutral',
}

/** Job state. */
export function JobStatusPill({ status }: { status: JobStatus }) {
  return (
    <Badge variant={JOB_STATUS_VARIANT[status] ?? 'neutral'}>{JOB_STATUS_LABELS[status] ?? status}</Badge>
  )
}

/** Generated-content lifecycle. */
export function ContentStatusPill({ status }: { status: ContentStatus }) {
  return (
    <Badge variant={CONTENT_STATUS_VARIANT[status] ?? 'neutral'}>
      {CONTENT_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

/** Pipeline stage, shown next to the progress bar. */
export function StageLabel({ stage }: { stage: JobStage }) {
  return <span className="text-xs text-muted">{JOB_STAGE_LABELS[stage] ?? stage}</span>
}

/** Licence state — the badge an editor must never miss. */
export function LicensePill({ license }: { license: LicenseStatus }) {
  return (
    <Badge variant={LICENSE_VARIANT[license] ?? 'neutral'}>{LICENSE_LABELS[license] ?? license}</Badge>
  )
}

/** Authenticity tier. `unverified` is never dressed up as official. */
export function OfficialnessPill({ status }: { status: OfficialStatus }) {
  return (
    <Badge variant={OFFICIAL_VARIANT[status] ?? 'neutral'}>
      {OFFICIAL_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

/** Whether StudyOS holds the file or only a link. */
export function RetrievalPill({ status }: { status: RetrievalStatus }) {
  return (
    <Badge variant={RETRIEVAL_VARIANT[status] ?? 'neutral'}>{RETRIEVAL_LABELS[status] ?? status}</Badge>
  )
}

/* -------------------------------------------------------------------------- */
/* Quality meter                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Validation score as a labelled bar.
 *
 * The score is *structural* quality from `validateNote()` — it is not a claim
 * that the content is factually correct, so the grade is always shown beside a
 * short explanation rather than presented as a verdict.
 */
export function QualityMeter({
  score,
  grade,
  className,
}: {
  score: number | null
  grade: string | null
  className?: string
}) {
  const trackRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const node = trackRef.current
    if (!node || !canAnimate()) return
    const target = Math.max(0, Math.min(100, score ?? 0))
    animate(node, { width: `${target}%`, duration: dur(420), ease: 'out(2)' })
  }, [score])

  if (score === null || score === undefined) {
    return <span className={cn('text-xs text-faint', className)}>Not validated yet</span>
  }

  const tone =
    grade === 'A' ? 'bg-success' : grade === 'B' ? 'bg-brand' : grade === 'C' ? 'bg-warning' : 'bg-danger'

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          {score}
          <span className="text-faint">/100</span>
        </span>
        {grade && (
          <Badge variant={grade === 'A' ? 'success' : grade === 'B' ? 'brand' : grade === 'C' ? 'warning' : 'danger'}>
            Grade {grade}
          </Badge>
        )}
      </div>
      <span
        aria-hidden
        className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-border"
      >
        <span
          ref={trackRef}
          className={cn('block h-full rounded-full transition-none', tone)}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Job progress                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Indeterminate-free progress: derived from real step counters in the queue
 * (`steps_done / steps_total`), never a decorative animation.
 */
export function JobProgressBar({
  progress,
  variant = 'brand',
  className,
}: {
  progress: number
  variant?: 'brand' | 'accent' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const value = Math.max(0, Math.min(100, Math.round(progress)))
  return <ProgressBar value={value} variant={variant} size="sm" className={className} />
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The attribution block (spec §51).
 *
 * Shown to admins everywhere and to students wherever material came from
 * somewhere other than StudyOS. Rendering it from ordered rows means the
 * "Source / Original URL / Retrieved / Official / Redistribution" wording is
 * identical in both places.
 */
export function ProvenanceBlock({
  rows,
  compact = false,
  className,
}: {
  rows: Array<{ label: string; value: string }>
  compact?: boolean
  className?: string
}) {
  if (!rows.length) return null

  return (
    <dl
      className={cn(
        'rounded-card border border-border bg-surface-secondary/60',
        compact ? 'p-2.5' : 'p-3',
        className,
      )}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            'flex flex-wrap items-baseline gap-x-2',
            compact ? 'py-0.5' : 'py-1',
          )}
        >
          <dt className="eyebrow shrink-0 text-faint">{row.label}</dt>
          <dd
            className={cn(
              'min-w-0 flex-1 break-words text-muted',
              compact ? 'text-xs' : 'text-[13px]',
            )}
          >
            {row.label === 'Original URL' ? (
              <a
                href={row.value}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-brand underline-offset-2 hover:underline"
              >
                {row.value}
              </a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* -------------------------------------------------------------------------- */
/* Notices                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Explains an empty engine screen honestly.
 *
 * In demo mode (no Supabase project) every engine query returns an empty
 * structure on purpose — the app never displays invented counts, so the only
 * correct thing to show is why there is nothing.
 */
export function EngineNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-card border border-warning/35 bg-warning/10 p-3',
        className,
      )}
      role="note"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="text-[13px] leading-relaxed text-muted">
        The content engine needs a connected Supabase project to run. With no backend
        configured, every figure here is <strong className="font-semibold text-foreground">0</strong> —
        StudyOS never displays placeholder statistics.
      </p>
    </div>
  )
}

/** Inline warning row for a single failed or blocked item. */
export function WarningRow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>{children}</span>
    </p>
  )
}
