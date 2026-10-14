import { useId } from 'react'
import { cn } from '@/utils/cn'

export interface LogoMarkProps {
  /** Overall size in px. */
  size?: number
  className?: string
  /** Drop the rounded plate and render just the glyph (used on tinted tiles). */
  bare?: boolean
}

/**
 * The StudyOS mark: an open book with a learning spark rising off its corner.
 *
 * Drawn as one gradient plate so it stays legible at 24px in a nav bar and at
 * 64px on the landing hero. Colours come from the design tokens, so it
 * re-tints with the theme instead of shipping a second asset.
 *
 * ```tsx
 * <LogoMark size={40} />
 * ```
 */
export function LogoMark({ size = 36, className, bare = false }: LogoMarkProps) {
  const uid = useId().replace(/:/g, '')
  const plate = `plate-${uid}`
  const sheen = `sheen-${uid}`

  return (
    <span
      aria-hidden
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} className="block">
        <defs>
          <linearGradient id={plate} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--brand)" />
            <stop offset="0.55" stopColor="var(--sky)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
          <linearGradient id={sheen} x1="8" y1="4" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {!bare && (
          <rect width="40" height="40" rx="12.5" fill={`url(#${plate})`} />
        )}
        {!bare && <rect width="40" height="40" rx="12.5" fill={`url(#${sheen})`} />}

        {/* open book — the left leaf sits slightly proud of the right */}
        <path
          d="M20 14.4c-2.5-2-6.4-3-10.2-2.6v14.6c3.8-.4 7.7.6 10.2 2.6V14.4z"
          fill={bare ? 'var(--brand)' : '#fff'}
          opacity={bare ? 1 : 0.97}
        />
        <path
          d="M20 14.4c2.5-2 6.4-3 10.2-2.6v14.6c-3.8-.4-7.7.6-10.2 2.6V14.4z"
          fill={bare ? 'var(--sky)' : '#fff'}
          opacity={bare ? 0.55 : 0.78}
        />
        <path
          d="M20 14.4v14.6"
          stroke={bare ? 'var(--foreground)' : 'rgba(20,32,72,0.18)'}
          strokeWidth="1.3"
          strokeLinecap="round"
        />

        {/* learning spark */}
        <path
          d="M31.6 6.4l1.35 3.55 3.55 1.35-3.55 1.35-1.35 3.55-1.35-3.55L26.7 11.3l3.55-1.35z"
          fill={bare ? 'var(--amber)' : '#fff'}
        />
      </svg>
    </span>
  )
}

/**
 * Wordmark: the mark plus "StudyOS" and its descriptor line. Used at the top
 * of the sidebar, the top bar on phones and the plain (chrome-free) layout.
 */
export function Logo({
  size = 36,
  className,
  compact = false,
  descriptor = 'Class 12 · CBSE',
}: {
  size?: number
  className?: string
  /** Hide the descriptor — tight spaces only. */
  compact?: boolean
  descriptor?: string
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
            Study<span className="text-brand">OS</span>
          </span>
          <span className="block truncate text-[10.5px] font-medium leading-tight tracking-[0.06em] text-faint uppercase">
            {descriptor}
          </span>
        </span>
      )}
    </span>
  )
}
