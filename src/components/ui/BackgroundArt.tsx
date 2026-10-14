import { useLayoutEffect, useRef } from 'react'
import { floatingDecoration, spinDecoration } from '@/animations'
import { themeColors, type ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

export interface BackgroundArtProps {
  /** Which hues to wash in. Defaults to the brand blue + a warm counterpoint. */
  theme?: ThemeKey
  /** How much presence the art should have. */
  intensity?: 'faint' | 'subtle' | 'prominent'
  /** Adds a slow-rotating hairline geometry cluster in one corner. */
  geometry?: boolean
  className?: string
  /** Variant changes the composition without changing the palette. */
  variant?: 'hero' | 'band' | 'corner'
}

const OPACITY: Record<NonNullable<BackgroundArtProps['intensity']>, string> = {
  faint: 'opacity-40',
  subtle: 'opacity-70',
  prominent: 'opacity-100',
}

/**
 * Decorative depth for hero areas: large blurred colour fields, a warm
 * counterpoint glow and optional hairline geometry.
 *
 * It is `aria-hidden`, `pointer-events-none` and never sits above content —
 * its job is to stop a section reading as a flat rectangle, not to be looked
 * at. All motion is a slow `translateY` on the compositor.
 *
 * ```tsx
 * <div className="relative">
 *   <BackgroundArt theme="physics" geometry />
 *   <div className="relative">…content…</div>
 * </div>
 * ```
 */
export function BackgroundArt({
  theme = 'brand',
  intensity = 'subtle',
  geometry = false,
  variant = 'hero',
  className,
}: BackgroundArtProps) {
  const primaryRef = useRef<HTMLSpanElement>(null)
  const secondaryRef = useRef<HTMLSpanElement>(null)
  const tertiaryRef = useRef<HTMLSpanElement>(null)
  const geometryRef = useRef<HTMLSpanElement>(null)

  const c = themeColors(theme)
  const op = OPACITY[intensity]

  useLayoutEffect(() => {
    const cleanups = [
      floatingDecoration(primaryRef.current, { distance: 18, cycle: 7400 }),
      floatingDecoration(secondaryRef.current, { distance: 14, cycle: 6200, delay: 600 }),
      floatingDecoration(tertiaryRef.current, { distance: 10, cycle: 5400, delay: 1200 }),
      spinDecoration(geometryRef.current, { cycle: 48000 }),
    ]
    return () => cleanups.forEach((fn) => fn())
  }, [])

  const composition =
    variant === 'corner'
      ? {
          primary: '-right-16 -top-24 h-64 w-64',
          secondary: 'right-4 top-24 h-40 w-40',
          tertiary: '-left-12 bottom-0 h-48 w-48',
        }
      : variant === 'band'
        ? {
            primary: '-right-20 top-1/2 h-56 w-72 -translate-y-1/2',
            secondary: '-left-16 top-4 h-44 w-44',
            tertiary: 'right-1/3 -bottom-20 h-40 w-56',
          }
        : {
            primary: '-right-24 -top-28 h-80 w-80',
            secondary: 'right-16 top-40 h-48 w-48',
            tertiary: '-left-24 -bottom-24 h-72 w-72',
          }

  return (
    <span
      aria-hidden
      data-background-art
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        /* guarantee the art can never intercept a tap */
        'select-none [contain:strict]',
        className,
      )}
    >
      {/* primary hue — a big soft field in the dominant corner */}
      <span
        ref={primaryRef}
        className={cn(
          'absolute rounded-full blur-3xl',
          composition.primary,
          c.solid,
          op,
          'opacity-[0.16] dark:opacity-[0.22]',
        )}
      />
      {/* secondary — same hue, smaller and denser */}
      <span
        ref={secondaryRef}
        className={cn(
          'absolute rounded-full blur-2xl',
          composition.secondary,
          c.solid,
          'opacity-[0.14] dark:opacity-[0.2]',
        )}
      />
      {/* tertiary — a warm counterpoint so the field is never monochrome */}
      <span
        ref={tertiaryRef}
        className={cn(
          'absolute rounded-full blur-3xl',
          composition.tertiary,
          'bg-amber',
          'opacity-[0.12] dark:opacity-[0.16]',
        )}
      />

      {geometry && (
        <span
          ref={geometryRef}
          className={cn(
            'absolute -right-10 -top-10 h-56 w-56 rounded-full border border-dashed',
            'border-border-strong/60',
          )}
          style={{
            maskImage: 'radial-gradient(circle, transparent 44%, black 46%, black 62%, transparent 64%)',
            WebkitMaskImage:
              'radial-gradient(circle, transparent 44%, black 46%, black 62%, transparent 64%)',
          }}
        />
      )}
    </span>
  )
}
