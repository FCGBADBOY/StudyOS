/**
 * AI Tutor motion: message entrances, the typing indicator and the
 * word-by-word reveal that makes mock answers feel "generated".
 */
import { animate } from 'animejs'
import type { TargetsParam } from 'animejs'
import {
  MOTION,
  canAnimate,
  del,
  dur,
  primeHidden,
  resolveTargets,
  staggerDelay,
  stop,
  type AnimationCleanup,
} from './motion'

/** A chat bubble sliding into the conversation. */
export function messageIn(
  target: TargetsParam | null | undefined,
  side: 'user' | 'assistant' = 'assistant',
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined
  if (!canAnimate()) return () => undefined

  const instance = animate(nodes, {
    opacity: [0, 1],
    x: [side === 'user' ? 18 : -18, 0],
    y: [MOTION.distance.sm, 0],
    scale: [MOTION.scale.hidden, 1],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

/**
 * The three-dot "StudyOS is thinking" indicator.
 * Target the container; dots are its `[data-dot]` children.
 */
export function typingDots(target: TargetsParam | null | undefined): AnimationCleanup {
  const container = resolveTargets(target)[0] as HTMLElement | undefined
  if (!container) return () => undefined

  const dots = Array.from(container.querySelectorAll<HTMLElement>('[data-dot]'))
  const nodes = dots.length ? dots : [container]
  if (!canAnimate()) return () => undefined

  const instance = animate(nodes, {
    opacity: [0.25, 1],
    duration: dur(MOTION.duration.slow),
    delay: staggerDelay(150),
    ease: 'inOutQuad',
    loop: true,
    alternate: true,
  })
  return stop(instance)
}

/**
 * Word-by-word reveal for an AI answer.
 * Wrap rendered words in `<span data-word>` and pass the container.
 */
export function wordReveal(
  target: TargetsParam | null | undefined,
  options: { step?: number; duration?: number; delay?: number } = {},
): AnimationCleanup {
  const container = resolveTargets(target)[0] as HTMLElement | undefined
  if (!container) return () => undefined

  const words = Array.from(container.querySelectorAll<HTMLElement>('[data-word]'))
  if (!words.length) return () => undefined
  if (!canAnimate()) return () => undefined

  const { step = 26, duration = MOTION.duration.base, delay = 0 } = options

  primeHidden(words)
  const instance = animate(words, {
    opacity: [0, 1],
    y: [MOTION.distance.xs, 0],
    duration: dur(duration),
    delay: staggerDelay(step, { start: del(delay) }),
    ease: MOTION.ease.soft,
  })
  return stop(instance)
}

/** Caret that blinks while the tutor is composing a reply. */
export function caretBlink(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    opacity: [1, 0],
    duration: dur(MOTION.duration.base),
    ease: 'linear',
    loop: true,
    alternate: true,
  })
  return stop(instance)
}
