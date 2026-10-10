import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from './Button'
import { cn } from '@/utils/cn'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Show a back affordance. */
  back?: boolean | string
  breadcrumb?: ReactNode
  className?: string
  /** Larger display type for flagship pages (PYQ Intelligence, MistakeBook…). */
  size?: 'md' | 'lg'
}

/** Consistent page title block used across every route. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  breadcrumb,
  className,
  size = 'md',
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
            <h1
              className={cn(
                'font-bold tracking-tight text-foreground',
                size === 'lg'
                  ? 'text-[26px] leading-tight sm:text-3xl'
                  : 'text-xl leading-tight sm:text-2xl',
              )}
            >
              {title}
            </h1>
            {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  /** Adds an id for aria-labelledby on the section. */
  id?: string
}

/** Section heading with optional trailing action. */
export function SectionHeader({ title, subtitle, action, className, id }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
