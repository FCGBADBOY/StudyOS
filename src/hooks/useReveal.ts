import { useLayoutEffect, useRef, type RefObject } from 'react'
import { revealOnScroll, type RevealOptions } from '@/animations/scrollAnimations'

/**
 * Reveal a section (and its children) the first time it scrolls into view.
 * Built on IntersectionObserver + Anime.js; the observer disconnects after
 * the reveal so no animation work keeps running while idle.
 *
 * ```tsx
 * const ref = useReveal<HTMLElement>({ selector: '[data-card]' })
 * return <section ref={ref}>…</section>
 * ```
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: RevealOptions,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const key = JSON.stringify(options ?? {})

  useLayoutEffect(() => {
    return revealOnScroll(ref.current, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return ref
}
