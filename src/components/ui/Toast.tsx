import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { toastIn, toastOut } from '@/animations/modalAnimations'
import { useApp } from '@/context/AppProvider'
import type { ToastItem, ToastVariant } from '@/types'
import { cn } from '@/utils/cn'

const ICONS: Record<ToastVariant, ReactNode> = {
  default: <Info aria-hidden />,
  success: <CheckCircle2 aria-hidden />,
  warning: <AlertTriangle aria-hidden />,
  danger: <XCircle aria-hidden />,
}

const ACCENTS: Record<ToastVariant, string> = {
  default: 'text-brand',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

type RenderedToast = ToastItem & { leaving?: boolean }

/**
 * Toast viewport: fixed above the bottom navigation on phones, bottom-right on
 * desktop. Entrance *and* exit are handled by Anime.js.
 */
export function ToastViewport() {
  const { toasts, dismissToast } = useApp()
  const [items, setItems] = useState<RenderedToast[]>([])
  const animating = useRef<Set<string>>(new Set())

  /* Reconcile the local mirror with the context list. */
  useEffect(() => {
    setItems((prev) => {
      const added = toasts.filter((toast) => !prev.some((item) => item.id === toast.id))
      const removedIds = prev
        .filter((item) => !item.leaving && !toasts.some((toast) => toast.id === item.id))
        .map((item) => item.id)
      const marked = prev.map((item) =>
        removedIds.includes(item.id) ? { ...item, leaving: true } : item,
      )
      if (!added.length && !removedIds.length) return prev
      return [...marked, ...added.map((toast) => ({ ...toast, leaving: false }))]
    })
  }, [toasts])

  /* Animate leaving toasts out, then unmount them. */
  useEffect(() => {
    for (const item of items) {
      if (!item.leaving || animating.current.has(item.id)) continue
      animating.current.add(item.id)
      const node = document.getElementById(`toast-${item.id}`)
      toastOut(node, () => {
        animating.current.delete(item.id)
        setItems((prev) => prev.filter((entry) => entry.id !== item.id))
      })
    }
  }, [items])

  if (!items.length) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] z-[90] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={() => {
            setItems((prev) =>
              prev.map((entry) => (entry.id === item.id ? { ...entry, leaving: true } : entry)),
            )
            const node = document.getElementById(`toast-${item.id}`)
            toastOut(node, () => {
              setItems((prev) => prev.filter((entry) => entry.id !== item.id))
              dismissToast(item.id)
            })
          }}
        />
      ))}
    </div>,
    document.body,
  )
}

function ToastCard({ item, onDismiss }: { item: RenderedToast; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return toastIn(ref.current)
  }, [])

  return (
    <div
      ref={ref}
      id={`toast-${item.id}`}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-raised',
      )}
    >
      <span className={cn('mt-0.5 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]', ACCENTS[item.variant])}>
        {ICONS[item.variant]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-control p-1 text-faint transition-colors hover:text-foreground"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
