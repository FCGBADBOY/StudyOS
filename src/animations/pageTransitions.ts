/**
 * Page and step transitions.
 *
 * Layouts wrap routed content in a keyed container and call `pageEnter`, so
 * every route transition fades + slides the incoming view as one unit.
 */
import { animate } from 'animejs'
import type { EasingParam, TargetsParam } from 'animejs'
import {
  MOTION,
  canAnimate,
  clearMotionStyles,
  del,
  dur,
  primeHidden,
  resolveTargets,
  stop,
  type AnimationCleanup,
} from './motion'

export interface PageEnterOptions {
  /** Extra delay before the page appears (ms). */
  delay?: number
  distance?: number
  duration?: number
  /** Set false for "no transform" entrances (modals keep their own motion). */
  scale?: boolean
}

/** Fade + translate + subtle scale for a page container. */
export function pageEnter(
  target: TargetsParam | null | undefined,
  options: PageEnterOptions = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined
  if (!canAnimate()) {
    clearMotionStyles(nodes)
    return () => undefined
  }

  const {
    delay = 0,
    distance = MOTION.distance.md,
    duration = MOTION.duration.page,
    scale = true,
  } = options

  primeHidden(nodes)
  const instance = animate(nodes, {
    opacity: [0, 1],
    y: [distance, 0],
    ...(scale ? { scale: [MOTION.scale.hidden, 1] } : {}),
    duration: dur(duration),
    delay: del(delay),
    ease: MOTION.ease.enter,
  })
  return stop(instance)
}

export type TransitionDirection = 'forward' | 'back'

/**
 * Multi-step flows (onboarding): animate the outgoing step away, then hand
 * control back so React can swap the content.
 *
 * ```ts
 * exitStep(currentRef.current, 'forward', () => setStep(step + 1))
 * ```
 */
export function exitStep(
  target: HTMLElement | null | undefined,
  direction: TransitionDirection = 'forward',
  onDone?: () => void,
  options: { distance?: number; duration?: number } = {},
): void {
  if (!target) {
    onDone?.()
    return
  }
  if (!canAnimate()) {
    onDone?.()
    return
  }

  const { distance = MOTION.distance.sm, duration = MOTION.duration.fast } = options
  const offset = direction === 'forward' ? -distance : distance

  animate(target, {
    opacity: [1, 0],
    x: [0, offset],
    duration: dur(duration),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/** Entrance for the incoming step of a multi-step flow. */
export function enterStep(
  target: TargetsParam | null | undefined,
  direction: TransitionDirection = 'forward',
  options: { distance?: number; duration?: number; delay?: number; ease?: EasingParam } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined
  if (!canAnimate()) {
    clearMotionStyles(nodes)
    return () => undefined
  }

  const {
    distance = MOTION.distance.md,
    duration = MOTION.duration.slow,
    delay = 0,
    ease = MOTION.ease.enter,
  } = options
  const offset = direction === 'forward' ? distance : -distance

  primeHidden(nodes)
  const instance = animate(nodes, {
    opacity: [0, 1],
    x: [offset, 0],
    duration: dur(duration),
    delay: del(delay),
    ease,
  })
  return stop(instance)
}

/**
 * Scroll to the top when the route changes (layout use).
 */
export function resetScroll(): void {
  if (typeof window === 'undefined') return
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  } catch {
    window.scrollTo(0, 0)
  }
}
