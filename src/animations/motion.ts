/**
 * ---------------------------------------------------------------------------
 * StudyOS motion system — the single source of truth for animation behaviour.
 * ---------------------------------------------------------------------------
 * Every duration, easing curve, stagger step and travel distance used anywhere
 * in the app is declared here. Tune the product's feel from this file only.
 *
 * All motion runs on Anime.js. Nothing here triggers layout beyond the element
 * being animated, and every animation returns a cleanup function so React can
 * stop work on unmount.
 */
import { stagger as animeStagger } from 'animejs'
import type { DOMTarget, FunctionValue, StaggerParams, TargetsParam } from 'animejs'

/** Global motion tokens. Change these to re-tune the entire app. */
export const MOTION = {
  duration: {
    instant: 1,
    fast: 160,
    base: 260,
    slow: 380,
    page: 400,
    epic: 560,
  },
  delay: {
    none: 0,
    quick: 60,
    short: 120,
    base: 200,
    long: 320,
  },
  stagger: {
    tight: 35,
    base: 60,
    relaxed: 90,
    loose: 130,
  },
  distance: {
    xs: 6,
    sm: 12,
    md: 20,
    lg: 32,
    xl: 44,
  },
  scale: {
    press: 0.97,
    card: 0.985,
    pop: 1.06,
    hidden: 0.97,
  },
  ease: {
    /** Default entrance: fast out, long settle. */
    enter: 'outExpo',
    /** Exits feel quicker and heavier. */
    exit: 'inQuad',
    /** Gentle, non-attention-grabbing motion. */
    soft: 'outQuad',
    /** Smooth back-and-forth (tabs, indicators). */
    smooth: 'inOutQuart',
    /** Slight overshoot for playful pops. */
    spring: 'outBack(1.5)',
    /** Celebrations only. */
    elastic: 'outElastic(1, .65)',
    linear: 'linear',
  },
} as const

export type AnimationCleanup = () => void

const noopCleanup: AnimationCleanup = () => undefined

/* --------------------------- reduced motion support ----------------------- */

let systemReduced = false
let preferenceReduced = false
let initialised = false

function ensureMotionEnv(): void {
  if (initialised || typeof window === 'undefined') return
  initialised = true
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  systemReduced = query.matches
  const onChange = (event: MediaQueryListEvent) => {
    systemReduced = event.matches
  }
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onChange)
  }
}

/** Driven by the OS setting *and* the in-app "Reduce motion" preference. */
export function prefersReducedMotion(): boolean {
  ensureMotionEnv()
  return systemReduced || preferenceReduced
}

/** Called by the settings screen / AppProvider. */
export function setReducedMotion(value: boolean): void {
  ensureMotionEnv()
  preferenceReduced = value
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyos:motion-change'))
  }
}

/** True when motion should actually run. */
export function canAnimate(): boolean {
  return !prefersReducedMotion()
}

/** Scale a duration (0ms when motion is reduced). */
export function dur(ms: number): number {
  return prefersReducedMotion() ? MOTION.duration.instant : ms
}

/** Scale a delay (0ms when motion is reduced). */
export function del(ms: number): number {
  return prefersReducedMotion() ? 0 : ms
}

/** Anime.js stagger that collapses to a flat 0 delay under reduced motion. */
export function staggerDelay(step: number, params?: StaggerParams): number | FunctionValue {
  if (prefersReducedMotion()) return 0
  // `stagger()` returns a 5-argument function; Anime accepts it anywhere a
  // function value is valid, so we widen the type once here instead of at
  // every call site.
  return animeStagger(step, params) as unknown as FunctionValue
}

/* ------------------------------- helpers ---------------------------------- */

/** Normalise any accepted Anime.js target into a flat DOM node list. */
export function resolveTargets(target: TargetsParam | null | undefined): DOMTarget[] {
  if (!target) return []
  if (typeof target === 'string') {
    return Array.from(document.querySelectorAll<HTMLElement>(target))
  }
  if (typeof NodeList !== 'undefined' && target instanceof NodeList) {
    return Array.from(target) as DOMTarget[]
  }
  if (Array.isArray(target)) {
    return (target as TargetsParam[]).flatMap((entry) => resolveTargets(entry))
  }
  return [target as DOMTarget]
}

/** Hide elements before an entrance animation paints (avoids a flash). */
export function primeHidden(targets: DOMTarget[]): void {
  for (const node of targets) {
    if (node instanceof HTMLElement) {
      node.style.opacity = '0'
    }
  }
}

/** Clear inline motion styles so CSS owns the element again. */
export function clearMotionStyles(targets: DOMTarget[]): void {
  for (const node of targets) {
    if (node instanceof HTMLElement) {
      node.style.opacity = ''
      node.style.transform = ''
      node.style.willChange = ''
    }
  }
}

/**
 * Animation instances are paused on cleanup instead of reverted:
 *  - React StrictMode remounts effects in dev; a revert would visually restart
 *    every entrance animation from zero.
 *  - Pausing stops the engine's work while keeping the element's last state.
 */
export function stop(instance?: { pause: () => unknown } | null): AnimationCleanup {
  return () => {
    try {
      instance?.pause()
    } catch {
      /* animation already finished / GC'd */
    }
  }
}

/** Combine several cleanups into one. */
export function composeCleanup(...cleanups: AnimationCleanup[]): AnimationCleanup {
  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}

export { noopCleanup }
