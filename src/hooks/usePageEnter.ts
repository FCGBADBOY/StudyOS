import { useLayoutEffect, useRef, type RefObject } from 'react'
import { pageEnter, type PageEnterOptions } from '@/animations/pageTransitions'

/**
 * Entrance animation for a page/root container.
 * Run in a layout effect so nothing flashes before the animation starts.
 */
export function usePageEnter<T extends HTMLElement = HTMLDivElement>(
  options?: PageEnterOptions,
): RefObject<T | null> {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    return pageEnter(ref.current, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ref
}
