import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Breadcrumb trail. On narrow screens the middle entries collapse to an
 * ellipsis so the current page always fits on one line.
 */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  const visible = items.length > 2 ? [items[0], { label: '…' }, items[items.length - 1]] : items

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px]">
        {visible.map((item, index) => {
          const last = index === visible.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 && (
                <li aria-hidden className="text-faint">
                  <ChevronRight className="h-3.5 w-3.5" />
                </li>
              )}
              <li className="min-w-0">
                {item.to && !last ? (
                  <Link
                    to={item.to}
                    className="rounded px-1 py-0.5 font-medium text-muted transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={cn(
                      'truncate px-1 py-0.5',
                      last ? 'font-semibold text-foreground' : 'font-medium text-muted',
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
