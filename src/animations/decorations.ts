/**
 * ---------------------------------------------------------------------------
 * StudyOS decorative + micro-interaction motion.
 * ---------------------------------------------------------------------------
 * The pieces that make the interface feel *alive* rather than merely animated:
 * slow floating background art, the press of a button, the lift of a card, the
 * bounce of a bookmark, the tick of a counter.
 *
 * Rules honoured here:
 *  - transform + opacity only (no layout, no repaints)
 *  - every loop is cancelled on unmount
 *  - reduced motion collapses to a no-op
 */
import { animate } from 'animejs'
import {
  MOTION,
  canAnimate,
  del,
  dur,
  resolveTargets,
  stop,
  type AnimationCleanup,
} from './motion'
import type { TargetsParam } from 'animejs'

/* ------------------------------ press / lift ------------------------------ */

/**
 * Tiny scale-down on pointer-down, spring back on release.
 * The universal "this is tappable" signal — used by Button and interactive cards.
 */
export function buttonPress(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const enter = () =>
    animate(nodes, {
      scale: [{ to: MOTION.scale.press, duration: dur(MOTION.duration.fast) }],
      duration: dur(MOTION.duration.fast),
      ease: MOTION.ease.soft,
    })

  const leave = () =>
    animate(nodes, {
      scale: [{ to: 1, duration: dur(MOTION.duration.base) }],
      duration: dur(MOTION.duration.base),
      ease: MOTION.ease.spring,
    })

  const node = nodes[0]
  if (!(node instanceof HTMLElement)) return () => undefined

  node.addEventListener('pointerdown', enter)
  node.addEventListener('pointerup', leave)
  node.addEventListener('pointerleave', leave)
  node.addEventListener('pointercancel', leave)

  return () => {
    node.removeEventListener('pointerdown', enter)
    node.removeEventListener('pointerup', leave)
    node.removeEventListener('pointerleave', leave)
    node.removeEventListener('pointercancel', leave)
    animate(nodes, { scale: 1, duration: dur(MOTION.duration.fast) })
  }
}

/**
 * Hover lift — a soft rise plus a deeper shadow, only on devices that can hover.
 * Returns immediately on touch so phones never get a sticky hover state.
 */
export function cardHover(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches) return () => undefined

  const enter = () =>
    animate(nodes, {
      translateY: -4,
      scale: 1.012,
      duration: dur(MOTION.duration.base),
      ease: MOTION.ease.soft,
    })
  const leave = () =>
    animate(nodes, {
      translateY: 0,
      scale: 1,
      duration: dur(MOTION.duration.base),
      ease: MOTION.ease.soft,
    })

  const cleanups: Array<() => void> = []
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue
    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointerleave', leave)
    cleanups.push(() => {
      node.removeEventListener('pointerenter', enter)
      node.removeEventListener('pointerleave', leave)
    })
  }

  return () => {
    for (const fn of cleanups) fn()
    animate(nodes, { translateY: 0, scale: 1, duration: dur(MOTION.duration.fast) })
  }
}

/* ------------------------------ decoration ------------------------------- */

export type FloatOptions = {
  /** Vertical travel in px. Keep it small — this is texture, not a show. */
  distance?: number
  /** One full cycle. Long durations read as calm. */
  cycle?: number
  /** Phase offset so a group of shapes never marches in lockstep. */
  delay?: number
}

/**
 * Slow, endless vertical drift for background shapes.
 *
 * Decorative only: the target must be `aria-hidden`, must never contain text
 * that has to stay readable, and must animate `translateY` alone so the
 * compositor can keep it on the GPU.
 */
export function floatingDecoration(
  target: TargetsParam | null | undefined,
  { distance = 14, cycle = 5200, delay = 0 }: FloatOptions = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const instance = animate(nodes, {
    translateY: [
      { to: -distance, duration: dur(cycle / 2) },
      { to: 0, duration: dur(cycle / 2) },
    ],
    duration: dur(cycle),
    delay: del(delay),
    ease: 'inOutSine',
    loop: true,
    alternate: true,
  })

  return stop(instance)
}

/** Rotate a decorative ring/star slowly. Pairs with `floatingDecoration`. */
export function spinDecoration(
  target: TargetsParam | null | undefined,
  { cycle = 26000, delay = 0 }: { cycle?: number; delay?: number } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const instance = animate(nodes, {
    rotate: '1turn',
    duration: dur(cycle),
    delay: del(delay),
    ease: 'linear',
    loop: true,
  })

  return stop(instance)
}

/**
 * Soft glow breathing for the "active" halo behind a hero icon tile or the
 * featured study panel. Two-frame scale — cheap, and it never touches layout.
 */
export function glowPulse(
  target: TargetsParam | null | undefined,
  { cycle = 3600, delay = 0 }: { cycle?: number; delay?: number } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const instance = animate(nodes, {
    opacity: [
      { to: 0.55, duration: dur(cycle / 2) },
      { to: 1, duration: dur(cycle / 2) },
    ],
    scale: [
      { to: 1.06, duration: dur(cycle / 2) },
      { to: 1, duration: dur(cycle / 2) },
    ],
    delay: del(delay),
    ease: 'inOutSine',
    loop: true,
    alternate: true,
  })

  return stop(instance)
}

/**
 * A handful of particles drifting up and out — used by the StudyOS AI identity
 * and by the "session complete" celebration. Absolutely positioned, removed by
 * the caller after the animation ends.
 */
export function sparkleBurst(
  target: TargetsParam | null | undefined,
  { spread = 46, count = 6 }: { spread?: number; count?: number } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  /* Each particle gets its own vector. Animating per-node (rather than with a
     function value) keeps the direction maths out of the render path and lets
     every spark ease on its own frame. */
  const instances = nodes.map((node, i) => {
    const angle = (i / Math.max(count, nodes.length)) * Math.PI * 2
    return animate(node, {
      translateX: Math.cos(angle) * spread,
      translateY: Math.sin(angle) * spread - 8,
      opacity: [{ to: 0, duration: dur(MOTION.duration.slow) }],
      scale: [
        { to: 1.4, duration: dur(MOTION.duration.fast) },
        { to: 0.4, duration: dur(MOTION.duration.slow) },
      ],
      duration: dur(MOTION.duration.slow * 1.4),
      delay: del(i * 30),
      ease: MOTION.ease.enter,
    })
  })

  return () => instances.forEach((instance) => stop(instance)())
}

/* --------------------------- micro-interactions -------------------------- */

/**
 * The "it worked" flourish: a quick overshoot pop with a slight rotation so a
 * completed planner task, a saved bookmark or a submitted quiz feels physical.
 */
export function successPop(
  target: TargetsParam | null | undefined,
  { intensity = 1 }: { intensity?: number } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const instance = animate(nodes, {
    scale: [
      { to: 1 + 0.16 * intensity, duration: dur(MOTION.duration.fast) },
      { to: 1, duration: dur(MOTION.duration.slow) },
    ],
    rotate: [
      { to: -5 * intensity, duration: dur(MOTION.duration.fast) },
      { to: 0, duration: dur(MOTION.duration.slow) },
    ],
    duration: dur(MOTION.duration.base + MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })

  return stop(instance)
}

/**
 * Attention nudge — a short horizontal shake for a wrong answer or an invalid
 * field. Deliberately restrained; it must read as "check this", never as alarm.
 */
export function nudge(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  const instance = animate(nodes, {
    translateX: [
      { to: -6, duration: dur(70) },
      { to: 6, duration: dur(70) },
      { to: -4, duration: dur(70) },
      { to: 0, duration: dur(70) },
    ],
    duration: dur(280),
    ease: 'inOutQuad',
  })

  return stop(instance)
}

/**
 * Draw an SVG stroke from 0 → 1 along its own path length. Used for the
 * ascending "study journey" path, field-line decoration and chart lines.
 */
export function drawPath(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined

  for (const node of nodes) {
    if (!(node instanceof SVGGeometryElement)) continue
    const length = node.getTotalLength()
    node.style.strokeDasharray = `${length}`
    node.style.strokeDashoffset = `${length}`
  }

  const instance = animate(nodes, {
    strokeDashoffset: [0],
    duration: dur(1400),
    delay: del(MOTION.delay.base),
    ease: MOTION.ease.enter,
  })

  return () => {
    stop(instance)()
    for (const node of nodes) {
      if (!(node instanceof SVGGeometryElement)) continue
      node.style.strokeDasharray = ''
      node.style.strokeDashoffset = ''
    }
  }
}

/**
 * Parallax for large background art: the shape trails the scroll by a small
 * amount. Uses a passive listener and a rAF-coalesced write, so it costs one
 * transform per frame at worst.
 */
export function parallax(
  target: TargetsParam | null | undefined,
  { strength = 0.14 }: { strength?: number } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target).filter((n): n is HTMLElement => n instanceof HTMLElement)
  if (!nodes.length || !canAnimate()) return () => undefined

  let frame = 0
  const write = () => {
    frame = 0
    const offset = window.scrollY * strength
    for (const node of nodes) node.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`
  }
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(write)
  }

  write()
  window.addEventListener('scroll', onScroll, { passive: true })

  return () => {
    window.removeEventListener('scroll', onScroll)
    if (frame) cancelAnimationFrame(frame)
    for (const node of nodes) node.style.transform = ''
  }
}
