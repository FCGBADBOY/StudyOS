/**
 * Overlay motion: modals, bottom sheets, toasts, dropdowns and the
 * full-screen search surface. Every exit accepts an `onDone` callback so the
 * host component can unmount the overlay only after the animation finishes.
 */
import { animate } from 'animejs'
import type { TargetsParam } from 'animejs'
import {
  MOTION,
  canAnimate,
  dur,
  resolveTargets,
  stop,
  type AnimationCleanup,
} from './motion'

function first(target: TargetsParam | null | undefined): HTMLElement | null {
  return (resolveTargets(target)[0] as HTMLElement | undefined) ?? null
}

/* --------------------------------- modal ---------------------------------- */

export function modalIn(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    opacity: [0, 1],
    y: [MOTION.distance.sm, 0],
    scale: [0.955, 1],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function modalOut(
  target: TargetsParam | null | undefined,
  onDone?: () => void,
): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    opacity: [1, 0],
    y: [0, -MOTION.distance.xs],
    scale: [1, 0.97],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

export function overlayIn(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    opacity: [0, 1],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.soft,
  })
  return stop(instance)
}

export function overlayOut(
  target: TargetsParam | null | undefined,
  onDone?: () => void,
): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    opacity: [1, 0],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* ------------------------------ bottom sheet ------------------------------ */

export function sheetIn(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    y: ['100%', '0%'],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function sheetOut(
  target: TargetsParam | null | undefined,
  onDone?: () => void,
): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    y: ['0%', '100%'],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* --------------------------------- toast ---------------------------------- */

export function toastIn(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined
  if (!canAnimate()) return () => undefined
  const instance = animate(nodes, {
    opacity: [0, 1],
    y: [MOTION.distance.md, 0],
    scale: [0.97, 1],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function toastOut(
  target: TargetsParam | null | undefined,
  onDone?: () => void,
): void {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) {
    onDone?.()
    return
  }
  animate(nodes, {
    opacity: [1, 0],
    y: [0, MOTION.distance.sm],
    scale: [1, 0.98],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* -------------------------------- dropdown -------------------------------- */

export function dropdownIn(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    opacity: [0, 1],
    y: [-6, 0],
    scale: [0.98, 1],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function dropdownOut(
  target: TargetsParam | null | undefined,
  onDone?: () => void,
): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    opacity: [1, 0],
    y: [0, -4],
    scale: [1, 0.985],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* ----------------------------- global search ------------------------------ */

/** Full-screen search surface: expands from the top with a soft scale. */
export function searchIn(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    opacity: [0, 1],
    y: [-10, 0],
    scale: [0.99, 1],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.enter,
  })
  return stop(instance)
}

export function searchOut(
  target: TargetsParam | null | undefined,
  onDone?: () => void,
): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    opacity: [1, 0],
    y: [0, -8],
    scale: [1, 0.99],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}
