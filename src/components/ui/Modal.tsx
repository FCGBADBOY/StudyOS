import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { modalIn, modalOut, overlayIn, overlayOut, sheetIn, sheetOut } from '@/animations/modalAnimations'
import { IconButton } from './Button'
import { cn } from '@/utils/cn'

interface BaseOverlayProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Hide the built-in close button (custom header layouts). */
  hideClose?: boolean
  className?: string
}

function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [mounted, onClose])

  return { mounted, setMounted }
}

/**
 * Centred dialog with Anime.js scale/fade entrance and reversed exit.
 * Rendered in a portal so page-level transforms never trap it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideClose,
  className,
}: BaseOverlayProps) {
  const { mounted, setMounted } = useOverlay(open, onClose)
  const panelRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!mounted) return
    const stopOverlay = overlayIn(overlayRef.current)
    const stopPanel = modalIn(panelRef.current)
    panelRef.current?.focus()
    return () => {
      stopOverlay()
      stopPanel()
    }
  }, [mounted])

  useEffect(() => {
    if (open || !mounted) return
    modalOut(panelRef.current, () => setMounted(false))
    overlayOut(overlayRef.current)
  }, [open, mounted, setMounted])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-lg rounded-t-2xl border border-border bg-surface shadow-pop outline-none',
          'max-h-[88dvh] overflow-y-auto sm:rounded-card',
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
              )}
              {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
            </div>
            {!hideClose && <IconButton label="Close dialog" size="sm" onClick={onClose}>
              <X />
            </IconButton>}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Android-style bottom sheet — slides up from the bottom edge with a grabber.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideClose,
  className,
}: BaseOverlayProps) {
  const { mounted, setMounted } = useOverlay(open, onClose)
  const panelRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!mounted) return
    const stopOverlay = overlayIn(overlayRef.current)
    const stopSheet = sheetIn(panelRef.current)
    panelRef.current?.focus()
    return () => {
      stopOverlay()
      stopSheet()
    }
  }, [mounted])

  useEffect(() => {
    if (open || !mounted) return
    sheetOut(panelRef.current, () => setMounted(false))
    overlayOut(overlayRef.current)
  }, [open, mounted, setMounted])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div ref={overlayRef} className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Sheet'}
        tabIndex={-1}
        className={cn(
          'relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-t border-border bg-surface shadow-pop outline-none',
          'safe-bottom',
          className,
        )}
      >
        <div className="sticky top-0 z-10 bg-surface pt-2">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-sunken" />
          {(title || !hideClose) && (
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 pb-3">
              <div className="min-w-0">
                {title && <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>}
                {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
              </div>
              {!hideClose && (
                <IconButton label="Close sheet" size="sm" onClick={onClose}>
                  <X />
                </IconButton>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
