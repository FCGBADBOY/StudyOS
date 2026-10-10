import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface SearchBarProps {
  onClick?: () => void
  placeholder?: string
  className?: string
  /** Show the ⌘K / hint pill on desktop. */
  hint?: string
  readOnlyValue?: string
}

/**
 * Global search trigger styled like an input. Tapping opens the full-screen
 * search surface (better for one-handed mobile use than an inline field).
 */
export function SearchBar({ onClick, placeholder = 'Search notes, PYQs, formulas, chapters…', className, hint }: SearchBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open search"
      className={cn(
        'group flex h-11 w-full items-center gap-2.5 rounded-control border border-border bg-surface px-3.5 text-left text-sm text-faint transition-colors hover:border-border-strong hover:text-muted',
        className,
      )}
    >
      <Search aria-hidden className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{placeholder}</span>
      {hint && (
        <kbd className="hidden shrink-0 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-faint sm:inline-block">
          {hint}
        </kbd>
      )}
    </button>
  )
}

/* --------------------------------- input ---------------------------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, trailing, className, id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-muted">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-11 items-center gap-2 rounded-control border bg-surface px-3.5 transition-colors',
          error ? 'border-danger' : 'border-border focus-within:border-brand',
        )}
      >
        {icon && <span aria-hidden className="shrink-0 text-faint [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
          aria-invalid={Boolean(error) || undefined}
          {...rest}
        />
        {trailing && <span className="shrink-0">{trailing}</span>}
      </div>
      {(hint || error) && (
        <p className={cn('mt-1.5 text-[12px]', error ? 'text-danger' : 'text-faint')}>{error ?? hint}</p>
      )}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, className, id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className="min-h-[96px] w-full resize-y rounded-control border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-brand"
        {...rest}
      />
    </div>
  )
})
