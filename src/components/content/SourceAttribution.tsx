/**
 * Student-facing source attribution (spec §51).
 *
 * Every piece of material that did not originate at StudyOS carries this
 * block. It is deliberately verbose about provenance and deliberately quiet
 * about everything else — a small expandable footer, not a banner.
 *
 * Two rules are enforced by construction here:
 *
 *   1. The rows come from `attributionRows()`, the same function the admin
 *      console uses, so an editor and a student always see identical
 *      "Source / Original URL / Retrieved / Official / Redistribution"
 *      wording.
 *   2. When redistribution was not allowed, no download affordance is
 *      rendered at all — only a "View original" link. The absence of the
 *      download button *is* the licence decision, made visible.
 *
 * Motion: a single height/opacity transition via Anime.js, skipped entirely
 * under `prefers-reduced-motion`.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { animate } from 'animejs'
import { ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react'
import { attributionRows, type AttributionFields } from '@/content-engine/license'
import { canAnimate, dur } from '@/animations/motion'
import { cn } from '@/utils/cn'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

export interface SourceAttributionProps extends AttributionFields {
  /** Optional download affordance — only pass it when redistribution is allowed. */
  storagePath?: string | null
  /** Short heading, e.g. "Question paper" or "Notes source". */
  title?: string
  className?: string
}

export function SourceAttribution({
  storagePath,
  title = 'Source',
  className,
  ...fields
}: SourceAttributionProps) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const chevronRef = useRef<SVGSVGElement>(null)

  const rows = attributionRows(fields)
  const canDownload = Boolean(storagePath) && fields.redistribution_allowed

  /* Measure on mount so the toggle has a real height to animate to. `height`
     is inline-`0px` at this point, so `scrollHeight` is the natural height. */
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return

    if (!canAnimate()) {
      body.style.height = open ? 'auto' : '0px'
      body.style.opacity = open ? '1' : '0'
      return
    }

    const frame = animate(body, {
      height: open ? body.scrollHeight : 0,
      opacity: open ? 1 : 0,
      duration: dur(220),
      ease: open ? 'out(2)' : 'in(2)',
      /* Release to `auto` once open, so a longer URL or a larger base font
         size can never clip the panel. Collapsed stays pinned at 0. */
      onComplete: () => {
        if (open) body.style.height = 'auto'
      },
    })

    if (chevronRef.current) {
      animate(chevronRef.current, {
        rotate: open ? 180 : 0,
        duration: dur(200),
        ease: 'out(2)',
      })
    }

    return () => {
      frame.pause()
    }
  }, [open])

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
      className={cn(
        'overflow-hidden rounded-card border border-border bg-surface-secondary/50',
        className,
      )}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-semibold',
          'text-muted transition-colors hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <ShieldCheck aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown ref={chevronRef} aria-hidden className="size-4 shrink-0 text-faint" />
      </summary>

      <div ref={bodyRef} className="px-3 pb-3" style={{ height: '0px', opacity: 0 }}>
        <dl className="flex flex-col gap-1">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="eyebrow shrink-0 text-faint">{row.label}</dt>
              <dd className="min-w-0 flex-1 break-words text-[13px] text-muted">
                {row.label === 'Original URL' ? (
                  <a
                    href={row.value}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={cn('break-all text-brand underline-offset-2 hover:underline', FOCUS_RING)}
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

        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          {fields.source_url && (
            <a
              href={fields.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5',
                'text-[13px] font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground',
                FOCUS_RING,
              )}
            >
              View original
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          {!fields.redistribution_allowed && (
            <p className="text-xs leading-relaxed text-faint">
              This source is not stored by StudyOS — the link above opens the original.
            </p>
          )}
        </div>
      </div>
    </details>
  )
}
