/**
 * Admin → Reports: the moderation queue.
 *
 * Students file six kinds of report (wrong answer, broken resource, duplicate
 * content…). This screen is where a moderator works through them: filter by
 * status, open one to read the detail, then move it to Investigating,
 * Resolved or Dismissed with a note that is recorded against the report.
 *
 * Bulk actions are here too, because a spam wave can produce dozens of
 * identical reports at once — but they always go through a confirmation that
 * states the count, and every write is logged to the audit trail.
 *
 * The Content Quality panel at the bottom is the proactive half of the same
 * job: it surfaces content that *looks* wrong (missing thumbnails, no source,
 * unpublishable drafts) before a student has to report it.
 */
import { useEffect, useMemo, useState } from 'react'
import { Flag, RefreshCw, ShieldAlert } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  SkeletonCard,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { DataTable, type Column } from '../components/DataTable'
import { ConfirmDialog, Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import { getContentQualityIssues } from '../services/adminContent.service'
import {
  getReportCounts,
  listReports,
  resolveReport,
} from '../services/adminAudit.service'
import {
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type AdminReportRow,
  type QualityIssue,
  type ReportStatus,
} from '../types/admin'

const STATUS_TONE: Record<ReportStatus, 'warning' | 'brand' | 'success' | 'neutral'> = {
  open: 'warning',
  investigating: 'brand',
  resolved: 'success',
  dismissed: 'neutral',
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

/** A pending bulk/single action: which reports, and where they are heading. */
interface PendingAction {
  ids: string[]
  status: Extract<ReportStatus, 'investigating' | 'resolved' | 'dismissed'>
}

export default function AdminReportsPage() {
  const { toast } = useToast()
  const { role, loading: sessionLoading } = useAdminSession()

  const [status, setStatus] = useState<ReportStatus | 'all'>('all')
  const [type, setType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const mayView = can(role, 'reports.view')
  const mayResolve = can(role, 'reports.resolve')

  /* Debounced search — typing never fires a query per keystroke. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft)
      setSelected([])
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const query = useMemo(() => ({ status, type, search: search.trim() || undefined }), [status, type, search])

  const { data, loading, error, refetch } = useQuery(
    `admin:reports:${JSON.stringify(query)}`,
    () => listReports(query),
    { enabled: !sessionLoading && mayView },
  )

  const { data: counts } = useQuery('admin:reports:counts', getReportCounts, {
    enabled: !sessionLoading && mayView,
  })

  const { data: quality } = useQuery<QualityIssue[]>('admin:quality:issues', getContentQualityIssues, {
    enabled: !sessionLoading && mayView,
  })

  const rows = data ?? []

  const columns: Column<AdminReportRow>[] = [
    {
      key: 'report_type',
      header: 'Type',
      render: (row) => <Badge variant="outline">{REPORT_TYPE_LABELS[row.report_type]}</Badge>,
    },
    {
      key: 'item_title',
      header: 'Reported item',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.item_title}</p>
          <p className="truncate text-xs text-muted">
            {row.item_type}
            {row.description ? ` · ${row.description}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Filed',
      hideBelow: 'md',
      render: (row) => (
        <span className="text-sm text-muted">
          {new Date(row.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'resolution_note',
      header: 'Resolution',
      hideBelow: 'lg',
      render: (row) => <p className="line-clamp-2 max-w-xs text-sm text-muted">{row.resolution_note || '—'}</p>,
    },
  ]

  async function applyAction() {
    if (!pending) return
    setBusy(true)
    try {
      for (const id of pending.ids) {
        await resolveReport(id, { status: pending.status, note: note.trim() || undefined })
      }
      toast({
        title:
          pending.ids.length === 1
            ? `Report marked ${STATUS_LABEL[pending.status].toLowerCase()}`
            : `${pending.ids.length} reports marked ${STATUS_LABEL[pending.status].toLowerCase()}`,
        variant: pending.status === 'dismissed' ? 'default' : 'success',
      })
      setPending(null)
      setNote('')
      setSelected([])
      refetch()
    } catch (caught) {
      toast({
        title: 'Could not update the reports',
        description: caught instanceof Error ? caught.message : undefined,
        variant: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  function ask(status: PendingAction['status'], ids: string[]) {
    setNote('')
    setPending({ ids, status })
  }

  if (!sessionLoading && !mayView) {
    return (
      <Notice tone="warning" title="You don't have permission to review reports.">
        Ask a super admin to grant <code className="font-mono text-xs">reports.view</code> if you
        believe this is a mistake.
      </Notice>
    )
  }

  const statusFilters: { id: ReportStatus | 'all'; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: counts?.total },
    { id: 'open', label: 'Open', count: counts?.open },
    { id: 'investigating', label: 'Investigating', count: counts?.investigating },
    { id: 'resolved', label: 'Resolved', count: counts?.resolved },
    { id: 'dismissed', label: 'Dismissed', count: counts?.dismissed },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Review what students have flagged, and keep the content trustworthy."
        actions={
          <Button variant="ghost" onClick={refetch} disabled={loading}>
            <RefreshCw className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        }
      />

      {/* -------------------------------------------------- status filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reports by status">
        {statusFilters.map((filter) => {
          const active = status === filter.id
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatus(filter.id)
                setSelected([])
              }}
              className={`inline-flex items-center gap-2 rounded-control border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
                active
                  ? 'border-brand bg-brand-soft text-brand-soft-fg'
                  : 'border-border bg-surface text-muted hover:border-border-strong hover:text-foreground'
              }`}
            >
              {filter.label}
              {typeof filter.count === 'number' && (
                <span className="tabular text-xs opacity-80">{filter.count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* -------------------------------------------------------- filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Search"
            placeholder="Item title or description"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Select
            label="Report type"
            value={type}
            onChange={(value) => {
              setType(value)
              setSelected([])
            }}
            options={[
              { id: 'all', label: 'Every type' },
              ...REPORT_TYPES.map((value) => ({ id: value, label: REPORT_TYPE_LABELS[value] })),
            ]}
            id="report-type"
          />
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() => {
                setSearchDraft('')
                setSearch('')
                setType('all')
                setStatus('all')
                setSelected([])
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------- bulk actions */}
      {selected.length > 0 && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground" aria-live="polite">
            {selected.length} report{selected.length === 1 ? '' : 's'} selected
          </p>
          {mayResolve ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => ask('investigating', selected)}>
                Mark investigating
              </Button>
              <Button variant="secondary" size="sm" onClick={() => ask('resolved', selected)}>
                Resolve
              </Button>
              <Button variant="danger" size="sm" onClick={() => ask('dismissed', selected)}>
                Dismiss
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">Your role cannot change report status.</p>
          )}
        </Card>
      )}

      {/* ---------------------------------------------------------- list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="We could not load the reports." description={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Flag className="size-6" aria-hidden="true" />}
          title={status === 'open' ? 'Nothing waiting for review' : 'No reports match those filters'}
          description={
            status === 'open'
              ? 'Every report has been handled. Nice work.'
              : 'Try clearing the search or widening the status filter.'
          }
        />
      ) : (
        <DataTable
          caption="Reported content"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          selectedIds={selected}
          onSelectionChange={setSelected}
          renderActions={
            mayResolve
              ? (row) => (
                  <div className="flex items-center justify-end gap-1">
                    {row.status === 'open' && (
                      <Button variant="ghost" size="sm" onClick={() => ask('investigating', [row.id])}>
                        Investigate
                      </Button>
                    )}
                    {row.status !== 'resolved' && (
                      <Button variant="ghost" size="sm" onClick={() => ask('resolved', [row.id])}>
                        Resolve
                      </Button>
                    )}
                    {row.status !== 'dismissed' && (
                      <Button variant="ghost" size="sm" onClick={() => ask('dismissed', [row.id])}>
                        Dismiss
                      </Button>
                    )}
                  </div>
                )
              : undefined
          }
          empty={<p className="px-4 py-6 text-center text-sm text-muted">Nothing to show.</p>}
          loading={loading}
        />
      )}

      {/* ------------------------------------------------ content quality */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Content quality</h2>
        </div>
        <p className="text-sm text-muted">
          Content that looks incomplete or untrustworthy — found before a student has to report it.
        </p>

        {quality === undefined ? (
          <SkeletonCard />
        ) : quality.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-foreground">Everything looks healthy right now.</p>
            <p className="mt-1 text-sm text-muted">No missing thumbnails, orphaned files or stuck drafts.</p>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quality.map((issue) => (
              <li key={issue.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{issue.label}</p>
                    <p className="truncate text-xs text-muted">{issue.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular text-lg font-semibold text-foreground">{issue.count}</span>
                    <LinkButton to={issue.href} variant="outline" size="sm">
                      Fix
                    </LinkButton>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ dialog */}
      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.ids.length === 1
            ? `Mark this report ${pending ? STATUS_LABEL[pending.status].toLowerCase() : ''}?`
            : `Mark ${pending?.ids.length ?? 0} reports ${pending ? STATUS_LABEL[pending.status].toLowerCase() : ''}?`
        }
        tone={pending?.status === 'dismissed' ? 'danger' : 'default'}
        confirmLabel={pending ? STATUS_LABEL[pending.status] : 'Confirm'}
        loading={busy}
        description={
          <div className="space-y-3">
            <p>
              {pending?.ids.length === 1
                ? 'The report moves out of the open queue.'
                : `${pending?.ids.length ?? 0} reports will move together.`}{' '}
              Every change is written to the audit log with your account.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-muted">
                Resolution note (optional)
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Confirmed against the marking scheme; answer corrected."
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              />
            </label>
            <p className="text-xs text-muted">
              Students never see this note — it exists so the next moderator knows what happened.
            </p>
          </div>
        }
        onConfirm={() => void applyAction()}
        onCancel={() => {
          setPending(null)
          setNote('')
        }}
      />
    </div>
  )
}
