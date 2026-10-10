/**
 * Admin feedback components: status badges, confirmation dialogs and the
 * destructive-action guard.
 *
 * Status colours are drawn from the existing semantic tokens (success /
 * warning / danger / brand) so the admin portal reads as the same product as
 * the student app while still communicating workflow state at a glance.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { Badge, Modal, Button } from '@/components/ui'
import type { BadgeVariant } from '@/components/ui'
import type { ResourceStatus, ReportStatus } from '../types/admin'
import { dangerShake } from '../animations/adminAnimations'

/* -------------------------------------------------------------------------- */
/* Status badges                                                              */
/* -------------------------------------------------------------------------- */

const RESOURCE_STATUS_VARIANT: Record<ResourceStatus, BadgeVariant> = {
  draft: 'neutral',
  pending_review: 'warning',
  approved: 'accent',
  published: 'success',
  rejected: 'danger',
  archived: 'outline',
}

const REPORT_STATUS_VARIANT: Record<ReportStatus, BadgeVariant> = {
  open: 'warning',
  investigating: 'accent',
  resolved: 'success',
  dismissed: 'neutral',
}

/** Workflow badge for a resource's publishing state. */
export function ResourceStatusBadge({ status }: { status: ResourceStatus }) {
  const labels: Record<ResourceStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    approved: 'Approved',
    published: 'Published',
    rejected: 'Rejected',
    archived: 'Archived',
  }
  return <Badge variant={RESOURCE_STATUS_VARIANT[status]}>{labels[status]}</Badge>
}

/** Moderation badge for a report's state. */
export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const labels: Record<ReportStatus, string> = {
    open: 'Open',
    investigating: 'Investigating',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
  }
  return <Badge variant={REPORT_STATUS_VARIANT[status]}>{labels[status]}</Badge>
}

/** Role badge — used in the user table and on the user detail page. */
export function RoleBadge({ role }: { role: string }) {
  const variant: BadgeVariant =
    role === 'super_admin' ? 'danger' : role === 'admin' ? 'accent' : role === 'student' ? 'neutral' : 'outline'
  const label = role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  return <Badge variant={variant}>{label}</Badge>
}

/** Account state for the user table. */
export function AccountStatusBadge({ suspended }: { suspended: boolean }) {
  return suspended ? <Badge variant="danger">Suspended</Badge> : <Badge variant="success">Active</Badge>
}

/* -------------------------------------------------------------------------- */
/* Inline notices                                                             */
/* -------------------------------------------------------------------------- */

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const NOTICE_STYLES: Record<NoticeTone, { className: string; Icon: typeof Info }> = {
  info: { className: 'border-border bg-surface-muted text-foreground', Icon: Info },
  success: { className: 'border-success/30 bg-success-soft text-foreground', Icon: CheckCircle2 },
  warning: { className: 'border-warning/30 bg-warning-soft text-foreground', Icon: AlertTriangle },
  danger: { className: 'border-danger/30 bg-danger-soft text-foreground', Icon: XCircle },
}

/** Inline message shown above forms or inside dialogs. */
export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: NoticeTone
  title?: string
  children?: ReactNode
}) {
  const { className, Icon } = NOTICE_STYLES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-card border px-4 py-3 text-sm ${className}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1 text-muted' : ''}>{children}</div>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Confirmation dialog                                                        */
/* -------------------------------------------------------------------------- */

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Spell out what will happen — "Delete Resource?" alone is not enough. */
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  /**
   * When set, the confirm button stays disabled until the admin types this
   * exact text. Reserve it for genuinely unrecoverable actions (spec §30).
   */
  typedConfirmation?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Destructive-action guard.
 *
 * Explains the consequence, requires an explicit click, and optionally
 * demands that the admin type a phrase — so nothing irreversible happens on a
 * mis-click or a stray Enter key.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  typedConfirmation,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const dangerRef = useRef<HTMLButtonElement>(null)

  /* Reset the typed phrase each time the dialog reopens. */
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  /* Nudge the confirm button when a dangerous dialog appears. */
  useEffect(() => {
    if (open && tone === 'danger') return dangerShake(dangerRef.current)
  }, [open, tone])

  const blockedByTyping = Boolean(typedConfirmation) && typed.trim() !== typedConfirmation
  const canConfirm = !loading && !blockedByTyping

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={typeof description === 'string' ? description : undefined}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            ref={dangerRef}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={!canConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {typeof description !== 'string' && <div className="text-sm text-muted">{description}</div>}

      {typedConfirmation && (
        <div className="mt-4">
          <label
            htmlFor="confirm-phrase"
            className="block text-sm font-medium text-foreground"
          >
            Type <span className="font-mono font-semibold">{typedConfirmation}</span> to confirm
          </label>
          <input
            id="confirm-phrase"
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-control border border-border bg-surface px-3 py-2
                       font-mono text-sm text-foreground
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          />
        </div>
      )}
    </Modal>
  )
}
