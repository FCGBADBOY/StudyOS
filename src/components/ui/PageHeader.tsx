import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from './Button'
import { cn } from '@/utils/cn'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Small tracked uppercase label above the title — the editorial eyebrow. */
  eyebrow?: ReactNode
  /** Show a back affordance. */
  back?: boolean | string
  breadcrumb?: ReactNode
  className?: string
  /** Larger display type for flagship pages (PYQ Intelligence, MistakeBook). */
  size?: 'md' | 'lg'
  /** Optional decorative art on the trailing side of wide screens. */
  media?: ReactNode
}

/** Consistent page title block used across every route. */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  back,
  breadcrumb,
  className,
  size = 'md',
  media,
}: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {breadcrumb}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {back && (
            <IconButton
              label="Go back"
              variant="outline"
              size="sm"
              className="mt-0.5"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            >
              <ArrowLeft />
            </IconButton>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            <h1
              className={cn(
                'text-foreground',
                size === 'lg'
                  ? 'text-display text-[27px] sm:text-[34px]'
                  : 'text-xl font-bold tracking-tight leading-tight sm:text-2xl',
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted sm:text-[15px]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {media && <div className="mt-1">{media}</div>}
    </header>
  )
}

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  /** Tracked uppercase label above the heading. */
  eyebrow?: string
  action?: ReactNode
  className?: string
  /** Adds an id for aria-labelledby on the section. */
  id?: string
  /** Tighter bottom margin when the section has no visible gap. */
  tight?: boolean
}

/** Section heading with optional trailing action. */
export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
  id,
  tight = false,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-3',
        tight ? 'mb-2' : 'mb-3 sm:mb-4',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2
          id={id}
          className="text-[16px] font-bold tracking-tight text-foreground sm:text-lg"
        >
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
