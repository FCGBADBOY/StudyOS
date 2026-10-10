/**
 * Staggered entrances for lists, grids and stacked sections.
 * Items enter sequentially rather than simultaneously.
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
  staggerDelay,
  stop,
  type AnimationCleanup,
} from './motion'

export interface StaggerOptions {
  /** Delay between each item (ms). */
  step?: number
  /** Travel distance in px (positive = from below). */
  distance?: number
  /** Per-item duration. */
  duration?: number
  /** Delay before the first item (ms). */
  delay?: number
  ease?: EasingParam
  /** Also scale items in (use sparingly). */
  scale?: boolean
  /** Enter from the side instead of below. */
  axis?: 'x' | 'y'
  /** Ordering of the stagger. */
  from?: 'first' | 'last' | 'center' | 'random' | number[]
}

/**
 * Fade + slide a set of elements in sequentially. Returns a cleanup function.
 *
 * ```ts
 * useEffect(() => staggerIn(ref.current?.querySelectorAll('[data-card]')), [])
 * ```
 */
export function staggerIn(
  target: TargetsParam | null | undefined,
  options: StaggerOptions = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined

  if (!canAnimate()) {
    clearMotionStyles(nodes)
    return () => undefined
  }

  const {
    step = MOTION.stagger.base,
    distance = MOTION.distance.md,
    duration = MOTION.duration.slow,
    delay = 0,
    ease = MOTION.ease.enter,
    scale = false,
    axis = 'y',
    from = 'first',
  } = options

  primeHidden(nodes)
  for (const node of nodes) {
    ;(node as HTMLElement).style.willChange = 'transform, opacity'
  }

  const instance = animate(nodes, {
    opacity: [0, 1],
    ...(axis === 'y' ? { y: [distance, 0] } : { x: [distance, 0] }),
    ...(scale ? { scale: [MOTION.scale.hidden, 1] } : {}),
    duration: dur(duration),
    delay: staggerDelay(step, { from, start: delay }),
    ease,
    onComplete: () => {
      for (const node of nodes) {
        ;(node as HTMLElement).style.willChange = ''
      }
    },
  })

  return stop(instance)
}

/**
 * Fade + slide a single container (section headers, cards, sheets).
 */
export function fadeUp(
  target: TargetsParam | null | undefined,
  options: { distance?: number; duration?: number; delay?: number; ease?: EasingParam } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined
  if (!canAnimate()) {
    clearMotionStyles(nodes)
    return () => undefined
  }

  const { distance = MOTION.distance.md, duration = MOTION.duration.slow, delay = 0, ease = MOTION.ease.enter } =
    options

  primeHidden(nodes)
  const instance = animate(nodes, {
    opacity: [0, 1],
    y: [distance, 0],
    duration: dur(duration),
    delay: del(delay),
    ease,
  })
  return stop(instance)
}

/** Looping "breathing" fade — used by skeletons and typing indicators. */
export function softPulse(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const instance = animate(nodes, {
    opacity: [0.4, 0.85],
    duration: MOTION.duration.epic,
    ease: 'inOutQuad',
    loop: true,
    alternate: true,
  })
  return stop(instance)
}
