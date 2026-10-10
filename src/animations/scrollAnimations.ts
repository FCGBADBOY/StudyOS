/**
 * Scroll-triggered reveals built on IntersectionObserver + Anime.js.
 *
 * The observer fires once per element (by default), hands off to Anime.js and
 * then disconnects — no animation loops keep running while the user scrolls.
 */
import type { EasingParam, TargetsParam } from 'animejs'
import { MOTION, canAnimate, dur, resolveTargets, type AnimationCleanup } from './motion'
import { staggerIn, type StaggerOptions } from './staggerAnimations'

export interface RevealOptions extends StaggerOptions {
  /** Observe this container and animate its matching children when it enters. */
  selector?: string
  /** Intersection threshold (0–1). */
  threshold?: number
  /** Root margin — negative bottom % delays the trigger until well in view. */
  rootMargin?: string
  /** Keep observing and re-animate each time (default: reveal once). */
  once?: boolean
  /** Animate the container itself instead of its children. */
  self?: boolean
}

/**
 * Observe `container` and stagger-animate either its children or itself the
 * first time it enters the viewport. Returns a cleanup that disconnects the
 * observer and pauses any in-flight animation.
 *
 * ```ts
 * useEffect(() => revealOnScroll(sectionRef.current, { selector: '[data-card]' }), [])
 * ```
 */
export function revealOnScroll(
  container: HTMLElement | null | undefined,
  options: RevealOptions = {},
): AnimationCleanup {
  if (!container) return () => undefined

  const {
    selector,
    threshold = 0.15,
    rootMargin = '0px 0px -8% 0px',
    once = true,
    self = false,
    ...staggerOptions
  } = options

  if (!canAnimate() || typeof IntersectionObserver === 'undefined') {
    return () => undefined
  }

  let cleanup: AnimationCleanup = () => undefined

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue

        const nodes = self
          ? [container]
          : selector
            ? Array.from(container.querySelectorAll<HTMLElement>(selector))
            : Array.from(container.children).filter(
                (child): child is HTMLElement => child instanceof HTMLElement,
              )

        if (nodes.length) {
          cleanup = staggerIn(nodes, {
            step: staggerOptions.step ?? MOTION.stagger.base,
            distance: staggerOptions.distance ?? MOTION.distance.md,
            duration: staggerOptions.duration ?? MOTION.duration.slow,
            delay: staggerOptions.delay ?? 0,
            ease: staggerOptions.ease as EasingParam | undefined,
            from: staggerOptions.from,
            axis: staggerOptions.axis,
          })
        }

        if (once) {
          observer.disconnect()
          break
        }
      }
    },
    { threshold, rootMargin },
  )

  observer.observe(container)

  return () => {
    observer.disconnect()
    cleanup()
  }
}

/** Convenience: reveal a list of sibling nodes directly (no observer). */
export function revealNow(
  target: TargetsParam | null | undefined,
  options: StaggerOptions = {},
): AnimationCleanup {
  return staggerIn(target, {
    step: MOTION.stagger.base,
    distance: MOTION.distance.md,
    ...options,
  })
}
