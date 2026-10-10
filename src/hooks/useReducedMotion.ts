import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '@/animations/motion'

/**
 * Live `prefers-reduced-motion` (system setting + in-app preference).
 * Components can use it to skip building decorative motion entirely.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => prefersReducedMotion())

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const list = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(prefersReducedMotion())
    sync()
    list.addEventListener('change', sync)

    // The in-app toggle changes module state; re-sync on custom events.
    window.addEventListener('studyos:motion-change', sync)
    return () => {
      list.removeEventListener('change', sync)
      window.removeEventListener('studyos:motion-change', sync)
    }
  }, [])

  return reduced
}
