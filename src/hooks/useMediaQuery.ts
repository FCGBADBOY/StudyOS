import { useEffect, useState } from 'react'

/** Reactive `window.matchMedia` query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True on phones (used to switch between bottom nav and sidebar). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}

/** Tablet and up — where the sidebar takes over from the bottom bar. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
