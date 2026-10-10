import { useLayoutEffect, useRef, type RefObject } from 'react'
import { animateCount, type CountOptions } from '@/animations/progressAnimations'

/**
 * Animate a number into an element's text content using Anime.js.
 * React does not re-render while the value ticks.
 *
 * ```tsx
 * const streak = useCountUp<HTMLSpanElement>(14)
 * return <span ref={streak} aria-label="14 day streak">0</span>
 * ```
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(
  to: number,
  options?: CountOptions,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const key = JSON.stringify({ to, ...options })

  useLayoutEffect(() => {
    return animateCount(ref.current, to, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return ref
}
