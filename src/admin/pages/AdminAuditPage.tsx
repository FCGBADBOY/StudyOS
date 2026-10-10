/**
 * Admin → Audit log.
 *
 * Every privileged change — a role grant, a publish, an archive, a report
 * resolution — is written to `audit_logs` by `log_admin_action()`, a SECURITY
 * DEFINER function. Because clients have no INSERT policy on that table, the
 * trail cannot be forged from the browser: this screen is strictly read-only.
 *
 * Metadata is displayed as it was stored, but the writer already strips
 * anything credential-shaped (passwords, tokens, service keys) before it ever
 * reaches the row.
 */
import { useEffect, useMemo, useState } from 'react'
import { FileClock, RefreshCw, Search } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  SkeletonCard,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import { listAuditLog } from '../services/adminAudit.service'
import type { AuditLogRow } from '../types/admin'

/** Entity types seen in the log — used as a quick filter. */
const ENTITY_OPTIONS = [
  { id: '', label: 'Every entity' },
  { id: 'resource', label: 'Resource' },
  { id: 'pyq_question', label: 'PYQ question' },
  { id: 'profile', label: 'User account' },
  { id: 'report', label: 'Report' },
  { id: 'board', label: 'Board' },
  { id: 'class', label: 'Class' },
  { id: 'stream', label: 'Stream' },
  { id: 'subject', label: 'Subject' },
  { id: 'chapter', label: 'Chapter' },
  { id: 'settings', label: 'Settings' },
]

const LIMIT_OPTIONS = [
  { id: '50', label: 'Last 50 entries' },
  { id: '100', label: 'Last 100 entries' },
  { id: '250', label: 'Last 250 entries' },
]

/** Render `resource.published` as `Resource · published` for scanning. */
function describeAction(action: string): { entity: string; verb: string } {
  const [entity, verb = ''] = action.split('.')
  return { entity: entity.replace(/_/g, ' '), verb: verb.replace(/_/g, ' ') }
}

function timeOf(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminAuditPage() {
  const { role, loading: sessionLoading } = useAdminSession()

  const [action, setAction] = useState('')
  const [actionDraft, setActionDraft] = useState('')
  const [entityType, setEntityType] = useState('')
  const [limit, setLimit] = useState('100')

  const mayView = can(role, 'audit.view')

  /* Debounced so pasting a long action name does not query per keystroke. */
  useEffect(() => {
    const timer = window.setTimeout(() => setAction(actionDraft.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [actionDraft])

  const query = useMemo(
    () => ({ action: action || undefined, entityType: entityType || undefined, limit: Number(limit) }),
    [action, entityType, limit],
  )

  const { data, loading, error, refetch } = useQuery(
    `admin:audit:${JSON.stringify(query)}`,
    () => listAuditLog(query),
    { enabled: !sessionLoading && mayView },
  )

  const rows = data ?? []

  if (!sessionLoading && !mayView) {
    return (
      <Notice tone="warning" title="You don't have permission to read the audit log.">
        Ask a super admin to grant <code className="font-mono text-xs">audit.view</code> if you
        believe this is a mistake.
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        subtitle="Who changed what, and when. Append-only — this screen cannot edit or delete entries."
        actions={
          <Button variant="ghost" onClick={refetch} disabled={loading}>
            <RefreshCw className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Action"
            placeholder="resource.published"
            value={actionDraft}
            onChange={(event) => setActionDraft(event.target.value)}
            icon={<Search className="size-4" aria-hidden="true" />}
          />
          <Select
            label="Entity"
            value={entityType}
            onChange={setEntityType}
            options={ENTITY_OPTIONS}
            id="audit-entity"
          />
          <Select label="Range" value={limit} onChange={setLimit} options={LIMIT_OPTIONS} id="audit-limit" />
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() => {
                setActionDraft('')
                setAction('')
                setEntityType('')
                setLimit('100')
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {loading ? 'Loading entries…' : `${rows.length.toLocaleString('en-IN')} entries`}
        </p>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="We could not load the audit log." description={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileClock className="size-6" aria-hidden="true" />}
          title="No entries match those filters"
          description="Clear the action filter, or widen the range, to see more."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <AuditRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AuditRow({ row }: { row: AuditLogRow }) {
  const { entity, verb } = describeAction(row.action)
  const metadata = Object.entries(row.metadata ?? {})

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{entity}</Badge>
              <span className="text-sm font-medium text-foreground">{verb}</span>
              {row.entity_id && (
                <code className="max-w-[14rem] truncate font-mono text-[11px] text-muted">
                  {row.entity_id}
                </code>
              )}
            </div>

            {metadata.length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {metadata.map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-1">
                    <dt className="text-faint">{key}</dt>
                    <dd className="text-foreground">{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">{timeOf(row.created_at)}</p>
            <p className="mt-0.5 font-mono text-[11px] text-faint">
              {row.actor_id ? `${row.actor_id.slice(0, 8)}…` : 'system'}
            </p>
          </div>
        </div>
      </Card>
    </li>
  )
}

/** Keep metadata on one line — an audit row is not a JSON viewer. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') {
    const text = JSON.stringify(value)
    return text.length > 120 ? `${text.slice(0, 117)}…` : text
  }
  return String(value)
}
