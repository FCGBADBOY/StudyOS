import { useLayoutEffect, useRef } from 'react'
import { Bookmark } from 'lucide-react'
import { bookmarkPop } from '@/animations'
import { useApp } from '@/context/AppProvider'
import { useToast } from '@/context/AppProvider'
import { cn } from '@/utils/cn'

export interface FavoriteButtonProps {
  /** Stable id — usually `chapter:<subject>:<slug>` or a resource id. */
  id: string
  label?: string
  size?: 'sm' | 'md'
  className?: string
  /** Announce a friendly toast on toggle (default true). */
  notify?: boolean
}

/**
 * Bookmark/favourite control with an Anime.js pop.
 * State lives in AppProvider (local today, API-backed later).
 */
export function FavoriteButton({
  id,
  label = 'Save',
  size = 'md',
  className,
  notify = true,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useApp()
  const { toast } = useToast()
  const ref = useRef<HTMLButtonElement>(null)
  const active = isFavorite(id)

  useLayoutEffect(() => {
    if (!ref.current) return
    return bookmarkPop(ref.current, active)
    // Only replay the pop when the active state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${label.toLowerCase()}` : label}
      title={active ? `Remove ${label}` : label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const added = toggleFavorite(id)
        if (notify) {
          toast({
            title: added ? 'Saved to your library' : 'Removed from saved',
            description: added ? 'Find it under Saved Resources.' : undefined,
            variant: added ? 'success' : 'default',
          })
        }
      }}
      className={cn(
        'grid shrink-0 place-items-center rounded-control transition-colors duration-150',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        active ? 'text-brand' : 'text-faint hover:text-foreground hover:bg-surface-muted',
        className,
      )}
    >
      <Bookmark
        aria-hidden
        className={cn(size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]')}
        fill={active ? 'currentColor' : 'none'}
        strokeWidth={1.8}
      />
    </button>
  )
}
