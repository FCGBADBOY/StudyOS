import { forwardRef, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { pressable, spin } from '@/animations'
import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  /* Primary reads as a solid object: a lit top edge and a wide, tinted bloom
     rather than a drop shadow. */
  primary:
    'bg-brand text-brand-fg shadow-[0_1px_2px_rgba(64,52,34,0.12),0_10px_22px_-12px_var(--brand-ring),inset_0_1px_0_rgba(255,255,255,0.24)] hover:bg-brand-hover active:bg-brand-hover disabled:bg-brand/45 disabled:shadow-none',
  /* No hairline by default — separation comes from tone and space. */
  secondary:
    'bg-surface-muted text-foreground hover:bg-surface-sunken active:bg-surface-sunken',
  outline:
    'bg-surface/70 text-foreground border border-border-strong hover:bg-surface-muted active:bg-surface-muted',
  ghost:
    'bg-transparent text-muted hover:text-foreground hover:bg-surface-muted active:bg-surface-muted',
  danger:
    'bg-danger text-white shadow-[0_1px_2px_rgba(64,52,34,0.10),0_10px_22px_-12px_var(--danger)] hover:opacity-90 active:opacity-90',
  soft: 'bg-brand-soft text-brand-soft-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:brightness-[0.98] dark:shadow-none',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-control',
  md: 'h-11 px-4 text-sm gap-2 rounded-control',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-control',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLButtonElement | null>(null)
  const loaderRef = useRef<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    return pressable(localRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!loading) return
    return spin(loaderRef.current, true)
  }, [loading])

  const setRefs = (node: HTMLButtonElement | null) => {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  return (
    <button
      ref={setRefs}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          ref={loaderRef}
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon && <span aria-hidden className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      )}
      {children}
      {iconRight && !loading && (
        <span aria-hidden className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{iconRight}</span>
      )}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only controls must expose an accessible name. */
  label: string
  variant?: 'ghost' | 'outline' | 'soft' | 'brand'
  size?: 'sm' | 'md' | 'lg'
  badge?: number
}

const ICON_VARIANTS: Record<string, string> = {
  ghost: 'bg-transparent text-muted hover:bg-surface-muted hover:text-foreground',
  outline: 'border border-border bg-surface text-muted hover:text-foreground hover:border-border-strong',
  soft: 'bg-surface-muted text-muted hover:text-foreground',
  brand: 'bg-brand-soft text-brand-soft-fg hover:brightness-105',
}

const ICON_SIZES = { sm: 'h-9 w-9', md: 'h-10 w-10', lg: 'h-12 w-12' }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', badge, className, children, type = 'button', ...rest },
  forwardedRef,
) {
  const localRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    return pressable(localRef.current)
  }, [])

  const setRefs = (node: HTMLButtonElement | null) => {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  return (
    <button
      ref={setRefs}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-control transition-colors duration-150',
        ICON_VARIANTS[variant],
        ICON_SIZES[size],
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.8]">
        {children}
      </span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="pointer-events-none absolute right-1 top-1 min-w-[16px] rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
})

export interface LinkButtonProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
  icon?: ReactNode
  iconRight?: ReactNode
  children: ReactNode
}

/** Router link that looks and behaves like a Button. */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  icon,
  iconRight,
  children,
  ...rest
}: LinkButtonProps) {
  const ref = useRef<HTMLAnchorElement | null>(null)

  useLayoutEffect(() => {
    return pressable(ref.current)
  }, [])

  return (
    <Link
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition-colors duration-150',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon && (
        <span aria-hidden className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
      )}
      {children}
      {iconRight && (
        <span aria-hidden className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">
          {iconRight}
        </span>
      )}
    </Link>
  )
}
