import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { animate } from 'animejs'
import { MOTION, canAnimate, drawStroke, stop } from '@/animations'
import { dropdownIn, dropdownOut } from '@/animations/modalAnimations'
import { cn } from '@/utils/cn'

/* --------------------------------- switch ---------------------------------- */

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

/** Preference toggle with an Anime.js-animated knob. */
export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const knobRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const knob = knobRef.current
    if (!knob) return
    if (!canAnimate()) {
      knob.style.transform = checked ? 'translate3d(20px, 0, 0)' : 'translate3d(0, 0, 0)'
      return
    }
    const instance = animate(knob, {
      x: checked ? 20 : 0,
      duration: MOTION.duration.slow,
      ease: MOTION.ease.spring,
    })
    return stop(instance)
  }, [checked])

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-brand bg-brand' : 'border-border-strong bg-surface-sunken',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          ref={knobRef}
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-card',
            checked ? 'bg-white' : 'bg-faint',
          )}
          style={{ transform: 'translate3d(0,0,0)' }}
        />
      </button>
    </div>
  )
}

/* -------------------------------- checkbox --------------------------------- */

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: string
  disabled?: boolean
  className?: string
}

/** Completion checkbox — the tick draws itself with Anime.js. */
export function Checkbox({ checked, onChange, label, description, disabled, className }: CheckboxProps) {
  const tickRef = useRef<SVGPathElement>(null)
  const boxRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (!checked) {
      if (tickRef.current) {
        tickRef.current.style.strokeDasharray = ''
        tickRef.current.style.strokeDashoffset = ''
      }
      return
    }
    return drawStroke(tickRef.current, { duration: MOTION.duration.base })
  }, [checked])

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 select-none',
        disabled && 'cursor-not-allowed opacity-55',
        className,
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150',
          checked ? 'border-brand bg-brand' : 'border-border-strong bg-surface',
        )}
      >
        <span ref={boxRef} className="grid place-items-center">
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="var(--brand-fg)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ visibility: checked ? 'visible' : 'hidden' }}
          >
            <path ref={tickRef} d="M3 8.5l3.2 3.2L13 5" />
          </svg>
        </span>
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
    </label>
  )
}

/* --------------------------- segmented control ----------------------------- */

export interface SegmentedOption<T extends string> {
  id: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

/** iOS/Android-style segmented control with a sliding indicator. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const indicator = indicatorRef.current
    const active = container?.querySelector<HTMLElement>('[data-active="true"]')
    if (!container || !indicator || !active) return

    const x = active.offsetLeft
    const width = active.offsetWidth

    if (!canAnimate()) {
      indicator.style.transform = `translate3d(${x}px, 0, 0)`
      indicator.style.width = `${width}px`
      return
    }

    const instance = animate(indicator, {
      x,
      width,
      duration: MOTION.duration.base,
      ease: MOTION.ease.smooth,
    })
    return stop(instance)
  }, [value, options])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={label}
      className={cn(
        'relative flex items-center gap-1 rounded-control border border-border bg-surface-muted p-1',
        className,
      )}
    >
      <span
        ref={indicatorRef}
        aria-hidden
        className="absolute left-0 top-1 h-[calc(100%-0.5rem)] rounded-[6px] bg-surface shadow-card"
        style={{ width: 0 }}
      />
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'relative z-10 flex-1 rounded-[6px] px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150',
              active ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------------- select ---------------------------------- */

export interface SelectOption {
  id: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  className?: string
  id?: string
}

/** Custom dropdown with an Anime.js open/close transition. */
export function Select({ options, value, onChange, label, placeholder = 'Select…', className, id }: SelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.id === value)

  useLayoutEffect(() => {
    if (open) return dropdownIn(menuRef.current)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const close = () => dropdownOut(menuRef.current, () => setOpen(false))

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      )}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-control border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
      >
        <span className={cn('truncate', !selected && 'text-faint')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 shrink-0 text-faint transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={label ?? placeholder}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-60 overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-raised"
        >
          {options.map((option) => {
            const active = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.id)
                  close()
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-[6px] px-3 py-2 text-left text-sm transition-colors',
                  active ? 'bg-brand-soft font-semibold text-brand-soft-fg' : 'text-muted hover:bg-surface-muted hover:text-foreground',
                )}
              >
                {option.label}
                {active && <Check aria-hidden className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* --------------------------------- slider ---------------------------------- */

export interface SliderProps {
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (value: number) => void
  label: string
  valueText?: string
  className?: string
}

/** Native range input styled to match the design system. */
export function Slider({ min = 0, max = 100, step = 1, value, onChange, label, valueText, className }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <label className={cn('block', className)}>
      <span className="mb-2 flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-muted">{label}</span>
        <span className="tabular font-semibold text-foreground">{valueText ?? value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-brand"
        style={{
          background: `linear-gradient(to right, var(--brand) ${percent}%, var(--surface-sunken) ${percent}%)`,
        }}
      />
    </label>
  )
}
