import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { glowPulse } from '@/animations'
import { themeColors, type ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

export type IconTileVariant =
  /** Tinted wash + coloured icon. The everyday treatment. */
  | 'soft'
  /** Layered gradient with an inner highlight. The hero treatment. */
  | 'gradient'
  /** Hairline ring on a tinted wash — quieter, for dense lists. */
  | 'outlined'
  /** Fully saturated tile with a knocked-out icon. High contrast, used sparingly. */
  | 'filled'
  /** Soft tile with a decorative orbit ring behind it — illustration-adjacent. */
  | 'illustrated'

export type IconTileSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface IconTileProps {
  /** The glyph. Lucide icons at stroke 1.9 read best at these sizes. */
  icon: ReactNode
  /** Semantic theme — determines colour, never pass a raw colour class. */
  theme?: ThemeKey
  variant?: IconTileVariant
  size?: IconTileSize
  className?: string
  /** Adds a slow breathing glow. Decorative hero surfaces only. */
  glow?: boolean
  /** Screen-reader text. Omit when the tile sits next to a visible label. */
  label?: string
}

const SIZES: Record<IconTileSize, { box: string; icon: string; radius: string }> = {
  xs: { box: 'h-8 w-8', icon: 'h-4 w-4', radius: 'rounded-[10px]' },
  sm: { box: 'h-10 w-10', icon: 'h-[18px] w-[18px]', radius: 'rounded-[11px]' },
  md: { box: 'h-12 w-12', icon: 'h-5 w-5', radius: 'rounded-tile' },
  lg: { box: 'h-14 w-14', icon: 'h-6 w-6', radius: 'rounded-[16px]' },
  xl: { box: 'h-20 w-20', icon: 'h-9 w-9', radius: 'rounded-card' },
}

/**
 * A glyph presented as a *designed object* rather than a bare outline: tinted
 * ground, matching foreground, a touch of depth, and an optional glow.
 *
 * This is the single icon container for the whole app — action tiles, resource
 * cards, list rows, empty states and stat blocks all route through it so that
 * "an icon with a background" always looks the same way.
 *
 * ```tsx
 * <IconTile icon={<Sparkles />} theme="ai" variant="gradient" size="lg" />
 * ```
 */
export function IconTile({
  icon,
  theme = 'brand',
  variant = 'soft',
  size = 'md',
  className,
  glow = false,
  label,
}: IconTileProps) {
  const tileRef = useRef<HTMLSpanElement>(null)
  const glowRef = useRef<HTMLSpanElement>(null)
  const c = themeColors(theme)
  const s = SIZES[size]

  useLayoutEffect(() => {
    if (!glow) return
    return glowPulse(glowRef.current, { cycle: 4200 })
  }, [glow])

  const shell = variant === 'filled' ? c.solid : c.soft

  /* A filled tile is always a knocked-out glyph; every other variant keeps the
     theme's readable-on-tint foreground. */
  const glyph = variant === 'filled' ? 'text-white' : c.onSoft

  return (
    <span
      ref={tileRef}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-icon-tile
      className={cn(
        'relative isolate grid shrink-0 place-items-center overflow-hidden',
        s.box,
        s.radius,
        shell,
        /* depth: a hairline inner highlight on top, a soft drop below */
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_2px_rgba(64,52,34,0.06)]',
        'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_1px_2px_rgba(0,0,0,0.3)]',
        variant === 'outlined' && 'ring-1 ring-inset ring-current/15',
        className,
      )}
    >
      {/* Gradient variants get a top-left specular wash for real perceived depth. */}
      {variant === 'gradient' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/85 via-white/25 to-transparent dark:from-white/25 dark:via-white/5 dark:to-transparent"
        />
      )}
      {glow && (
        <span
          ref={glowRef}
          aria-hidden
          className={cn('pointer-events-none absolute -inset-2 -z-10 blur-xl', c.soft, 'opacity-70')}
        />
      )}

      {variant === 'illustrated' && (
        <>
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute -right-2 -top-2 h-6 w-6 rounded-full opacity-60 blur-[2px]',
              c.soft,
            )}
          />
          <span
            aria-hidden
            className={cn('pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset', c.onSoft, 'opacity-15 ring-current')}
          />
        </>
      )}

      <span className={cn('relative grid place-items-center', glyph, '[&_svg]:h-full [&_svg]:w-full')}>
        <span className={cn(s.icon, 'grid place-items-center')}>
          {icon}
        </span>
      </span>
    </span>
  )
}
