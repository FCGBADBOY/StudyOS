/**
 * Navigation motion: the animated indicator under the active bottom-nav item,
 * drawer/sidebar entrances and small icon activations.
 */
import { animate } from 'animejs'
import type { TargetsParam } from 'animejs'
import { MOTION, canAnimate, dur, resolveTargets, stop, type AnimationCleanup } from './motion'

/**
 * Slide + resize the bottom navigation indicator onto the active item.
 * `indicator` is an absolutely positioned element inside `container`;
 * `target` is the newly active item.
 */
export function moveNavIndicator(
  indicator: HTMLElement | null | undefined,
  container: HTMLElement | null | undefined,
  target: HTMLElement | null | undefined,
): AnimationCleanup {
  if (!indicator || !container || !target) return () => undefined

  const containerBox = container.getBoundingClientRect()
  const box = target.getBoundingClientRect()
  const x = box.left - containerBox.left + container.scrollLeft
  const width = box.width

  if (!canAnimate()) {
    indicator.style.transform = `translate3d(${x}px, 0, 0)`
    indicator.style.width = `${width}px`
    indicator.style.opacity = '1'
    return () => undefined
  }

  indicator.style.opacity = '1'
  const instance = animate(indicator, {
    x,
    width,
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

/** Bounce the icon of a nav item when it becomes active. */
export function navIconActivate(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    keyframes: [
      { y: -5, scale: 1.14, duration: 170, ease: MOTION.ease.soft },
      { y: 0, scale: 1, duration: 360, ease: MOTION.ease.spring },
    ],
  })
  return stop(instance)
}

/* ------------------------------- drawer ----------------------------------- */

/** Slide-in sidebar drawer (tablet/compact desktop breakpoints). */
export function drawerIn(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    x: ['-100%', '0%'],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function drawerOut(
  target: TargetsParam | null | undefined,
  onDone?: () => void,
): void {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) {
    onDone?.()
    return
  }
  animate(nodes, {
    x: ['0%', '-100%'],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/** Active row highlight inside the sidebar (subtle left-edge sweep). */
export function sidebarRowActivate(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    opacity: [0.4, 1],
    x: [-6, 0],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.enter,
  })
  return stop(instance)
}

/** Small "success" pulse used after completing something from a nav item. */
export function navPulse(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    keyframes: [
      { scale: 1.16, duration: 220, ease: MOTION.ease.soft },
      { scale: 1, duration: 520, ease: MOTION.ease.elastic },
    ],
  })
  return stop(instance)
}
