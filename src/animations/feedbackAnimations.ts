/**
 * Completion feedback: check-draw, bookmark pops, celebrations and skeleton
 * shimmer — all driven by Anime.js (no CSS keyframes anywhere in the app).
 */
import { animate } from 'animejs'
import type { TargetsParam } from 'animejs'
import {
  MOTION,
  canAnimate,
  dur,
  resolveTargets,
  staggerDelay,
  stop,
  type AnimationCleanup,
} from './motion'

/** Draw an SVG stroke (checkbox tick, ring) from 0 → full. */
export function drawStroke(
  target: SVGGeometryElement | null | undefined,
  options: { duration?: number; delay?: number } = {},
): AnimationCleanup {
  if (!target) return () => undefined
  const { duration = MOTION.duration.slow, delay = 0 } = options

  if (typeof target.getTotalLength !== 'function') return () => undefined
  const length = target.getTotalLength()

  target.style.strokeDasharray = `${length}`
  target.style.strokeDashoffset = `${length}`

  if (!canAnimate()) {
    target.style.strokeDashoffset = '0'
    return () => undefined
  }

  const state = { value: length }
  const instance = animate(state, {
    value: 0,
    duration: dur(duration),
    delay,
    ease: MOTION.ease.enter,
    onUpdate: () => {
      target.style.strokeDashoffset = `${state.value}`
    },
    onComplete: () => {
      target.style.strokeDashoffset = '0'
    },
  })
  return stop(instance)
}

/** Checkbox/tick completion: pop the control, then draw the tick. */
export function checkComplete(
  control: TargetsParam | null | undefined,
  tick?: SVGGeometryElement | null,
): AnimationCleanup {
  const nodes = resolveTargets(control)
  const cleanups: Array<() => void> = []

  if (nodes.length && canAnimate()) {
    const pop = animate(nodes, {
      keyframes: [
        { scale: 1.18, duration: 170, ease: MOTION.ease.soft },
        { scale: 1, duration: 380, ease: MOTION.ease.spring },
      ],
    })
    cleanups.push(stop(pop))
  }

  if (tick) cleanups.push(drawStroke(tick, { delay: 60 }))

  return () => cleanups.forEach((fn) => fn())
}

/** Bookmark / favourite bounce with a tiny rotation. */
export function bookmarkPop(target: TargetsParam | null | undefined, active: boolean): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const instance = animate(nodes, {
    keyframes: [
      { scale: active ? 1.3 : 0.86, rotate: active ? -12 : 8, duration: 180, ease: MOTION.ease.soft },
      { scale: 1, rotate: 0, duration: 460, ease: MOTION.ease.spring },
    ],
  })
  return stop(instance)
}

/**
 * Session-complete celebration: the check pops, two rings expand and fade,
 * and a handful of particles burst outward. All optional — pass whatever
 * `[data-celebrate-*]` children exist inside the celebration container.
 */
export function celebrate(target: TargetsParam | null | undefined): AnimationCleanup {
  const container = resolveTargets(target)[0] as HTMLElement | undefined
  if (!container || !canAnimate()) return () => undefined

  const cleanups: Array<() => void> = []

  const icon = container.querySelector<HTMLElement>('[data-celebrate-icon]')
  if (icon) {
    cleanups.push(
      stop(
        animate(icon, {
          keyframes: [
            { scale: 0.4, opacity: 0, duration: 1, ease: 'linear' },
            { scale: 1.25, opacity: 1, duration: 340, ease: MOTION.ease.spring },
            { scale: 1, duration: 360, ease: MOTION.ease.elastic },
          ],
        }),
      ),
    )
  }

  const rings = container.querySelectorAll<HTMLElement>('[data-celebrate-ring]')
  if (rings.length) {
    cleanups.push(
      stop(
        animate(rings, {
          scale: [0.6, 1.9],
          opacity: [0.55, 0],
          duration: dur(MOTION.duration.epic + 240),
          delay: staggerDelay(140),
          ease: MOTION.ease.enter,
        }),
      ),
    )
  }

  const particles = container.querySelectorAll<HTMLElement>('[data-celebrate-particle]')
  const particleList = Array.from(particles)
  particleList.forEach((particle, index) => {
    const angle = (index / Math.max(1, particleList.length)) * Math.PI * 2
    const burstX = Math.round(Math.cos(angle) * 54)
    const burstY = Math.round(Math.sin(angle) * 54)
    cleanups.push(
      stop(
        animate(particle, {
          keyframes: [
            { x: burstX, y: burstY, opacity: 1, scale: 1, duration: 420, ease: MOTION.ease.enter },
            { x: 0, y: 0, opacity: 0, scale: 0.3, duration: 520, ease: MOTION.ease.exit },
          ],
        }),
      ),
    )
  })

  if (!cleanups.length) {
    cleanups.push(
      stop(
        animate(container, {
          keyframes: [
            { scale: 1.06, duration: 200, ease: MOTION.ease.soft },
            { scale: 1, duration: 420, ease: MOTION.ease.spring },
          ],
        }),
      ),
    )
  }

  return () => cleanups.forEach((fn) => fn())
}

/** Skeleton shimmer — looping opacity, paused automatically on unmount. */
export function skeletonPulse(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    opacity: [0.5, 0.95],
    duration: dur(MOTION.duration.epic + 240),
    ease: 'inOutQuad',
    loop: true,
    alternate: true,
  })
  return stop(instance)
}

/** Spinner for retry / sync actions. */
export function spin(target: TargetsParam | null | undefined, full = false): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    rotate: 360,
    duration: dur(760),
    ease: 'linear',
    ...(full ? { loop: true } : {}),
  })
  return stop(instance)
}
