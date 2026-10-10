import { cn } from '@/utils/cn'

export interface AvatarProps {
  name: string
  src?: string
  initials?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Decorative when the name is already in nearby text. */
  decorative?: boolean
}

const SIZES = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Photo avatar with an initials fallback and a subtle brand ring. */
export function Avatar({ name, src, initials, size = 'md', className, decorative }: AvatarProps) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand-soft-fg ring-2 ring-surface',
        SIZES[size],
        className,
      )}
      title={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
    >
      {src ? (
        <img src={src} alt={decorative ? '' : name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initials ?? initialsOf(name)}</span>
      )}
    </span>
  )
}
