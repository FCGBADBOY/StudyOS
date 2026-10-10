import { useLayoutEffect, useRef, type RefObject } from 'react'
import { staggerIn, type StaggerOptions } from '@/animations/staggerAnimations'

export interface UseStaggerOptions extends StaggerOptions {
  /** CSS selector for the children to stagger (default: direct children). */
  selector?: string
}

/**
 * Stagger a container's children in when it mounts.
 *
 * ```tsx
 * const ref = useStagger<HTMLDivElement>()
 * return <div ref={ref} className="grid">…cards…</div>
 * ```
 */
export function useStagger<T extends HTMLElement = HTMLDivElement>(
  options?: UseStaggerOptions,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const key = JSON.stringify(options ?? {})

  useLayoutEffect(() => {
    const container = ref.current
    if (!container) return

    const nodes = options?.selector
      ? container.querySelectorAll<HTMLElement>(options.selector)
      : Array.from(container.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement,
        )

    return staggerIn(nodes, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return ref
}
