/**
 * ---------------------------------------------------------------------------
 * Admin Portal motion — a professional, restrained subset of the StudyOS kit.
 * ---------------------------------------------------------------------------
 * The admin UI is dense with tables and forms, so motion here is deliberately
 * quieter than the student app: entrances are short, travel is small, and
 * tables animate their *rows* once rather than every cell.
 *
 * Everything reuses the shared `MOTION` tokens and honours
 * `prefers-reduced-motion` through `canAnimate()` / `dur()` — when motion is
 * reduced, every helper here is a no-op that leaves the DOM in its final state.
 *
 * Anime.js only. No CSS keyframes, no other animation library.
 */
import { animate } from 'animejs'
import type { TargetsParam } from 'animejs'
import {
  MOTION,
  canAnimate,
  clearMotionStyles,
  dur,
  del,
  primeHidden,
  resolveTargets,
  staggerDelay,
  stop,
  type AnimationCleanup,
} from '@/animations/motion'

/** Combine cleanups produced by several helpers. */
export function combine(...cleanups: AnimationCleanup[]): AnimationCleanup {
  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}

function first(target: TargetsParam | null | undefined): HTMLElement | null {
  return (resolveTargets(target)[0] as HTMLElement | undefined) ?? null
}

/* -------------------------------------------------------------------------- */
/* Page entrance                                                              */
/* -------------------------------------------------------------------------- */

export interface AdminPageOptions {
  delay?: number
}

/**
 * Entrance for an admin page: a short fade with a small upward settle.
 * Deliberately subtler than the student `pageEnter` — admins scan data, they
 * do not need the view performing for them.
 */
export function adminPageEnter(
  target: TargetsParam | null | undefined,
  options: AdminPageOptions = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined
  if (!canAnimate()) {
    clearMotionStyles(nodes)
    return () => undefined
  }

  primeHidden(nodes)
  const instance = animate(nodes, {
    opacity: [0, 1],
    y: [MOTION.distance.sm, 0],
    duration: dur(MOTION.duration.page),
    delay: del(options.delay ?? 0),
    ease: MOTION.ease.enter,
  })
  return stop(instance)
}

/* -------------------------------------------------------------------------- */
/* Admin sidebar                                                              */
/* -------------------------------------------------------------------------- */

/** Slide the mobile/collapsible sidebar in from the left. */
export function sidebarOpen(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    opacity: [0, 1],
    x: ['-100%', '0%'],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.enter,
  })
  return stop(instance)
}

/** Slide the sidebar out; calls `onDone` so the host can unmount it. */
export function sidebarClose(target: TargetsParam | null | undefined, onDone?: () => void): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    opacity: [1, 0],
    x: ['0%', '-100%'],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Stagger rows in after a fetch. Rows are the only thing that animates — the
 * header, toolbar and column widths stay put so the table never reflows while
 * an admin is reading it.
 */
export function tableRowEnter(
  target: TargetsParam | null | undefined,
  options: { step?: number; delay?: number } = {},
): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length) return () => undefined
  if (!canAnimate()) {
    clearMotionStyles(nodes)
    return () => undefined
  }

  const { step = MOTION.duration.instant + 25, delay = 0 } = options

  primeHidden(nodes)
  const instance = animate(nodes, {
    opacity: [0, 1],
    y: [MOTION.distance.xs, 0],
    duration: dur(MOTION.duration.base),
    /* A flat lead-in plus the per-row stagger, both collapse to 0 when the
       admin has reduced motion enabled. */
    delay: staggerDelay(step, { start: del(delay) }) as never,
    ease: MOTION.ease.soft,
  })
  return stop(instance)
}

/** Single-cell flash confirming a value just changed. */
export function cellConfirm(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    backgroundColor: ['var(--color-success-soft)', 'transparent'],
    duration: dur(MOTION.duration.epic),
    ease: MOTION.ease.soft,
  })
  return stop(instance)
}

/* -------------------------------------------------------------------------- */
/* Overlays                                                                   */
/* -------------------------------------------------------------------------- */

/** Admin modal entrance — a touch tighter than the student modal. */
export function modalOpen(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    opacity: [0, 1],
    y: [MOTION.distance.xs, 0],
    scale: [0.975, 1],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function modalClose(target: TargetsParam | null | undefined, onDone?: () => void): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    opacity: [1, 0],
    y: [0, -MOTION.distance.xs],
    scale: [1, 0.985],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                     */
/* -------------------------------------------------------------------------- */

export function toastEnter(target: TargetsParam | null | undefined): AnimationCleanup {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) return () => undefined
  const instance = animate(nodes, {
    opacity: [0, 1],
    y: [MOTION.distance.sm, 0],
    scale: [0.98, 1],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function toastExit(target: TargetsParam | null | undefined, onDone?: () => void): void {
  const nodes = resolveTargets(target)
  if (!nodes.length || !canAnimate()) {
    onDone?.()
    return
  }
  animate(nodes, {
    opacity: [1, 0],
    y: [0, -MOTION.distance.xs],
    scale: [1, 0.985],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* -------------------------------------------------------------------------- */
/* Numbers & progress                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Count a statistic up to its final value.
 *
 * The element's `textContent` is written on every frame, so the caller only
 * needs to hand over the node and the target number:
 *
 * ```tsx
 * <span ref={ref}>0</span>
 * …
 * statCounter(ref.current, 12482)
 * ```
 *
 * Writes are skipped entirely when motion is reduced (the final value is set
 * immediately instead), and the tween is paused on cleanup.
 */
export function statCounter(
  target: HTMLElement | null | undefined,
  to: number,
  options: { duration?: number; prefix?: string; suffix?: string } = {},
): AnimationCleanup {
  if (!target) return () => undefined

  const { duration = MOTION.duration.epic, prefix = '', suffix = '' } = options
  const format = (value: number) => `${prefix}${Math.round(value).toLocaleString('en-IN')}${suffix}`

  if (!canAnimate()) {
    target.textContent = format(to)
    return () => undefined
  }

  const counter = { value: 0 }
  target.textContent = format(0)

  const instance = animate(counter, {
    value: [0, to],
    duration: dur(duration),
    ease: MOTION.ease.soft,
    onUpdate: () => {
      target.textContent = format(counter.value)
    },
  })
  return stop(instance)
}

/** Animate a determinate bar's fill to `percent` (0–100). */
export function progressAnimation(
  target: TargetsParam | null | undefined,
  percent: number,
  options: { duration?: number; delay?: number } = {},
): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) {
    if (node) node.style.width = `${Math.max(0, Math.min(100, percent))}%`
    return () => undefined
  }

  const clamped = Math.max(0, Math.min(100, percent))
  node.style.width = '0%'

  const instance = animate(node, {
    width: [`0%`, `${clamped}%`],
    duration: dur(options.duration ?? MOTION.duration.slow),
    delay: del(options.delay ?? 0),
    ease: MOTION.ease.soft,
  })
  return stop(instance)
}

/* -------------------------------------------------------------------------- */
/* Menus                                                                      */
/* -------------------------------------------------------------------------- */

export function dropdownOpen(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    opacity: [0, 1],
    y: [-5, 0],
    scale: [0.985, 1],
    duration: dur(MOTION.duration.base),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

export function dropdownClose(target: TargetsParam | null | undefined, onDone?: () => void): void {
  const node = first(target)
  if (!node || !canAnimate()) {
    onDone?.()
    return
  }
  animate(node, {
    opacity: [1, 0],
    y: [0, -3],
    scale: [1, 0.99],
    duration: dur(MOTION.duration.fast),
    ease: MOTION.ease.exit,
    onComplete: () => onDone?.(),
  })
}

/* -------------------------------------------------------------------------- */
/* Uploads & confirmations                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Drive an upload bar from real progress events.
 *
 * Returns a function the upload code calls with each 0–100 value, plus the
 * standard cleanup. Continuous updates are cheap because only `width` changes.
 */
export function uploadProgress(
  target: TargetsParam | null | undefined,
): { set: (percent: number) => void; cleanup: AnimationCleanup } {
  const node = first(target)

  return {
    set(percent: number) {
      if (!node) return
      const clamped = Math.max(0, Math.min(100, percent))
      if (canAnimate()) {
        animate(node, {
          width: [`${node.style.width || '0%'}`, `${clamped}%`],
          duration: dur(MOTION.duration.fast),
          ease: MOTION.ease.linear,
        })
      } else {
        node.style.width = `${clamped}%`
      }
    },
    cleanup: () => {
      if (node) node.style.willChange = ''
    },
  }
}

/**
 * Success flourish: a small scale pop plus a colour flash.
 * Used after publishing, importing or saving — the moments worth acknowledging.
 */
export function successAnimation(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    scale: [1, MOTION.scale.pop, 1],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.spring,
  })
  return stop(instance)
}

/** Danger confirmation: two quick shakes, nothing cartoonish. */
export function dangerShake(target: TargetsParam | null | undefined): AnimationCleanup {
  const node = first(target)
  if (!node || !canAnimate()) return () => undefined
  const instance = animate(node, {
    x: [0, -6, 6, -4, 4, 0],
    duration: dur(MOTION.duration.slow),
    ease: MOTION.ease.soft,
  })
  return stop(instance)
}
