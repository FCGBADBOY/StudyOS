/**
 * Progress motion: animated counters, progress bars and progress rings.
 *
 * Values are written straight to the DOM from inside Anime.js callbacks, so
 * React never re-renders while a number is ticking.
 */
import { animate } from 'animejs'
import type { EasingParam, TargetsParam } from 'animejs'
import { MOTION, canAnimate, dur, resolveTargets, stop, type AnimationCleanup } from './motion'

export interface CountOptions {
  duration?: number
  delay?: number
  decimals?: number
  prefix?: string
  suffix?: string
  /** Thousands separator (Indian locale default). */
  separator?: boolean
  ease?: EasingParam
  /** Called with the final value when the count finishes. */
  onDone?: (value: number) => void
}

function group(value: number, decimals: number, separator: boolean): string {
  const negative = value < 0
  const fixed = Math.abs(value).toFixed(decimals)
  const sign = negative ? '-' : ''
  if (!separator) return `${sign}${fixed}`
  const [int, frac] = fixed.split('.')
  const last3 = int.slice(-3)
  const rest = int.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
  return `${sign}${grouped}${frac ? `.${frac}` : ''}`
}

/**
 * Tick a number from 0 to `to`, writing into `target`'s text content.
 * Reduced motion snaps straight to the final value.
 */
export function animateCount(
  target: TargetsParam | null | undefined,
  to: number,
  options: CountOptions = {},
): AnimationCleanup {
  const node = resolveTargets(target)[0] as HTMLElement | undefined
  if (!node) return () => undefined

  const {
    duration = MOTION.duration.epic,
    delay = 0,
    decimals = 0,
    prefix = '',
    suffix = '',
    separator = true,
    ease = MOTION.ease.enter,
    onDone,
  } = options

  const render = (value: number) => {
    node.textContent = `${prefix}${group(value, decimals, separator)}${suffix}`
  }

  if (!canAnimate()) {
    render(to)
    onDone?.(to)
    return () => undefined
  }

  const state = { value: 0 }
  const instance = animate(state, {
    value: to,
    duration: dur(duration),
    delay,
    ease,
    onUpdate: () => render(state.value),
    onComplete: () => {
      render(to)
      onDone?.(to)
    },
  })
  return stop(instance)
}

export interface BarOptions {
  duration?: number
  delay?: number
  ease?: EasingParam
}

/**
 * Animate a horizontal bar to `percent` (0–100).
 * The element should be the *fill* — width is written directly.
 */
export function animateBar(
  target: TargetsParam | null | undefined,
  percent: number,
  options: BarOptions = {},
): AnimationCleanup {
  const node = resolveTargets(target)[0] as HTMLElement | undefined
  if (!node) return () => undefined

  const { duration = MOTION.duration.epic, delay = 0, ease = MOTION.ease.enter } = options
  const clamped = Math.max(0, Math.min(100, percent))

  if (!canAnimate()) {
    node.style.width = `${clamped}%`
    return () => undefined
  }

  node.style.width = '0%'
  const state = { value: 0 }
  const instance = animate(state, {
    value: clamped,
    duration: dur(duration),
    delay,
    ease,
    onUpdate: () => {
      node.style.width = `${state.value}%`
    },
    onComplete: () => {
      node.style.width = `${clamped}%`
    },
  })
  return stop(instance)
}

export interface RingOptions extends BarOptions {
  /** Stroke colour override (CSS variable or colour). */
  color?: string
}

/**
 * Animate an SVG `<circle>` progress ring from 0 to `percent`.
 * The circle must declare its `stroke-dasharray` via the ProgressRing component.
 */
export function animateRing(
  target: SVGGeometryElement | null | undefined,
  percent: number,
  options: RingOptions = {},
): AnimationCleanup {
  if (!target) return () => undefined

  const { duration = MOTION.duration.epic, delay = 0, ease = MOTION.ease.enter, color } = options
  const clamped = Math.max(0, Math.min(100, percent))
  const length = typeof target.getTotalLength === 'function' ? target.getTotalLength() : 0

  if (!length) return () => undefined

  target.style.strokeDasharray = `${length}`
  target.style.strokeDashoffset = `${length}`
  if (color) target.style.stroke = color

  if (!canAnimate()) {
    target.style.strokeDashoffset = `${length * (1 - clamped / 100)}`
    return () => undefined
  }

  const state = { value: 0 }
  const instance = animate(state, {
    value: clamped,
    duration: dur(duration),
    delay,
    ease,
    onUpdate: () => {
      target.style.strokeDashoffset = `${length * (1 - state.value / 100)}`
    },
    onComplete: () => {
      target.style.strokeDashoffset = `${length * (1 - clamped / 100)}`
    },
  })
  return stop(instance)
}
