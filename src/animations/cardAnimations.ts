/**
 * Card-level motion: entrance and tactile press feedback.
 */
import { animate } from 'animejs'
import type { EasingParam, TargetsParam } from 'animejs'
import {
  MOTION,
  canAnimate,
  clearMotionStyles,
  dur,
  primeHidden,
  resolveTargets,
  stop,
  type AnimationCleanup,
} from './motion'

export interface CardEntranceOptions {
  delay?: number
  distance?: number
  duration?: number
  ease?: EasingParam
  scale?: boolean
}

/** Single card entering the viewport / appearing on load. */
export function cardEntrance(
  target: TargetsParam | null | undefined,
  options: CardEntranceOptions = {},
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
    duration = MOTION.duration.slow,
    ease = MOTION.ease.enter,
    scale = true,
  } = options

  primeHidden(nodes)
  const instance = animate(nodes, {
    opacity: [0, 1],
    y: [distance, 0],
    ...(scale ? { scale: [MOTION.scale.hidden, 1] } : {}),
    duration: dur(duration),
    delay,
    ease,
  })
  return stop(instance)
}

/**
 * Android-style press feedback for cards and tiles.
 * Adds pointer + keyboard listeners and returns a cleanup that detaches them.
 *
 * ```ts
 * useEffect(() => pressable(cardRef.current), [ ])
 * ```
 */
export function pressable(
  element: HTMLElement | null | undefined,
  options: { scale?: number } = {},
): AnimationCleanup {
  if (!element || !canAnimate()) return () => undefined

  const { scale = MOTION.scale.card } = options
  let instance: ReturnType<typeof animate> | null = null

  const press = () => {
    instance?.pause()
    instance = animate(element, {
      scale,
      duration: MOTION.duration.fast,
      ease: MOTION.ease.soft,
    })
  }

  const release = () => {
    instance?.pause()
    instance = animate(element, {
      scale: 1,
      duration: MOTION.duration.base,
      ease: MOTION.ease.spring,
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') press()
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') release()
  }

  element.addEventListener('pointerdown', press)
  element.addEventListener('pointerup', release)
  element.addEventListener('pointerleave', release)
  element.addEventListener('pointercancel', release)
  element.addEventListener('keydown', onKeyDown)
  element.addEventListener('keyup', onKeyUp)

  return () => {
    instance?.pause()
    element.removeEventListener('pointerdown', press)
    element.removeEventListener('pointerup', release)
    element.removeEventListener('pointerleave', release)
    element.removeEventListener('pointercancel', release)
    element.removeEventListener('keydown', onKeyDown)
    element.removeEventListener('keyup', onKeyUp)
    element.style.transform = ''
  }
}

/** Hover/focus lift used on desktop pointer devices only. */
export function hoverLift(
  element: HTMLElement | null | undefined,
  active: boolean,
): void {
  if (!element || !canAnimate()) return
  animate(element, {
    y: active ? -3 : 0,
    duration: active ? MOTION.duration.base : MOTION.duration.slow,
    ease: active ? MOTION.ease.spring : MOTION.ease.soft,
  })
}
