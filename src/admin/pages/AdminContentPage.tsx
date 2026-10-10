/**
 * Admin → Content: the resource library.
 *
 * One screen for every study resource the student app can ever see — notes,
 * PDFs, formula sheets, sample papers — with the workflow tabs, server-side
 * filtering and pagination on top of `listResources`, plus row selection and
 * bulk status/subject changes that report their outcome per row.
 *
 * Permissions here only hide controls the caller could not successfully use;
 * Row Level Security remains the real gate (see `src/admin/lib/permissions.ts`).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Check, Plus, Send } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  Select,
  TabPanel,
  Tabs,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { DataTable, Pagination, type Column } from '../components/DataTable'
import { ConfirmDialog, ResourceStatusBadge } from '../components/AdminFeedback'
import { ResourceFilters } from '../components/ResourceFilters'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import { listBoards, listClasses, listSubjects } from '../services/adminAcademic.service'
import {
  bulkSetStatus,
  bulkSetSubject,
  DEFAULT_PAGE_SIZE,
  listResources,
  type ResourceFilter,
  type ResourcePage,
} from '../services/adminContent.service'
import { RESOURCE_TYPE_LABELS } from '../types/admin'
import type { AdminResourceRow, ResourceStatus } from '../types/admin'

/* ------------------------------- workflow tabs ---------------------------- */

const STATUS_TABS: TabItem[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
]

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The update failed. Please try again.'
}

/* ---------------------------------- page ---------------------------------- */

export default function AdminContentPage() {
  const { role } = useAdminSession()
  const { toast } = useToast()

  const [filter, setFilter] = useState<ResourceFilter>({})
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ResourceStatus | null>(null)
  const [bulkSubjectId, setBulkSubjectId] = useState('')

  const canCreate = can(role, 'content.create')
  const canPublish = can(role, 'content.publish')

  /* A new filter always means "back to page one" — and a stale selection
     would otherwise act on rows nobody can see. */
  useEffect(() => {
    setPage(1)
  }, [filter])

  useEffect(() => {
    setSelectedIds([])
  }, [filter, page])

  const listKey = `admin:resources:${page}:${filter.status ?? ''}:${filter.resourceType ?? ''}:${
    filter.subjectId ?? ''
  }:${filter.boardId ?? ''}:${filter.classId ?? ''}:${filter.search ?? ''}`

  const listQuery = useQuery<ResourcePage>(listKey, () =>
    listResources(filter, page, DEFAULT_PAGE_SIZE),
  )

  const subjectsQuery = useQuery('admin:subjects', () => listSubjects())
  const boardsQuery = useQuery('admin:boards', () => listBoards())
  const classesQuery = useQuery('admin:classes', () => listClasses())

  const subjects = subjectsQuery.data ?? []
  const boards = boardsQuery.data ?? []
  const classes = classesQuery.data ?? []

  const subjectName = (id: string | null): string => {
    if (!id) return ''
    return subjects.find((subject) => subject.id === id)?.name ?? ''
  }

  const tab = filter.status ?? 'all'

  function selectTab(id: string) {
    setFilter((current) => ({
      ...current,
      status: id === 'all' ? undefined : (id as ResourceStatus),
    }))
  }

  /* ------------------------------ bulk actions ---------------------------- */

  /** One toast for either bulk action: the outcome is always spelled out. */
  function reportOutcome(updated: number, failed: number, outcome: string) {
    if (failed > 0) {
      toast({
        title: `${updated} updated, ${failed} failed`,
        description: `${failed} resource${failed === 1 ? '' : 's'} could not be ${outcome}.`,
        variant: 'warning',
      })
      return
    }
    toast({
      title: `${updated} resource${updated === 1 ? '' : 's'} ${outcome}`,
      variant: 'success',
    })
  }

  async function runBulkStatus(status: ResourceStatus) {
    if (selectedIds.length === 0) return
    setBulkBusy(true)
    try {
      const result = await bulkSetStatus(selectedIds, status)
      const outcomes: Record<ResourceStatus, string> = {
        draft: 'moved to draft',
        pending_review: 'submitted for review',
        approved: 'approved',
        published: 'published',
        rejected: 'rejected',
        archived: 'archived',
      }
      reportOutcome(result.updated, result.failed.length, outcomes[status])
      setSelectedIds([])
      setPendingStatus(null)
      listQuery.refetch()
    } catch (error) {
      toast({ title: 'Bulk update failed', description: messageOf(error), variant: 'danger' })
    } finally {
      setBulkBusy(false)
    }
  }

  async function runBulkSubject(subjectId: string) {
    if (!subjectId || selectedIds.length === 0) return
    setBulkBusy(true)
    try {
      const result = await bulkSetSubject(selectedIds, subjectId)
      const subjectLabel = subjects.find((entry) => entry.id === subjectId)?.name ?? 'the subject'
      reportOutcome(result.updated, result.failed.length, `re-assigned to ${subjectLabel}`)
      setBulkSubjectId('')
      listQuery.refetch()
    } catch (error) {
      toast({ title: 'Bulk update failed', description: messageOf(error), variant: 'danger' })
    } finally {
      setBulkBusy(false)
    }
  }

  /* --------------------------------- table -------------------------------- */

  const columns: Column<AdminResourceRow>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {RESOURCE_TYPE_LABELS[row.resource_type]}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ResourceStatusBadge status={row.status} />,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => subjectName(row.subject_id) || <span className="text-faint">—</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge variant="outline">{RESOURCE_TYPE_LABELS[row.resource_type]}</Badge>,
    },
    {
      key: 'updated',
      header: 'Updated',
      hideBelow: 'md',
      render: (row) => <span className="tabular text-muted">{formatDate(row.updated_at)}</span>,
    },
  ]

  const rows = listQuery.data?.items ?? []
  const hasFilters = Boolean(
    filter.search?.trim() ||
      (filter.status && filter.status !== 'all') ||
      (filter.resourceType && filter.resourceType !== 'all') ||
      (filter.subjectId && filter.subjectId !== 'all') ||
      (filter.boardId && filter.boardId !== 'all') ||
      (filter.classId && filter.classId !== 'all'),
  )
  const loading = listQuery.loading
  const showTable = !loading && !listQuery.error

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        subtitle="Manage notes, PDFs, formula sheets and every study resource."
        actions={
          canCreate ? (
            <LinkButton to="/admin/content/resources/new" icon={<Plus />}>
              New resource
            </LinkButton>
          ) : undefined
        }
      />

      <Tabs items={STATUS_TABS} value={tab} onChange={selectTab} label="Resource status" />

      <TabPanel id={tab} className="space-y-4">
        <ResourceFilters
          value={filter}
          onChange={setFilter}
          subjects={subjects}
          boards={boards}
          classes={classes}
        />

        {selectedIds.length > 0 && (
          <Card padded={false} className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <p aria-live="polite" className="text-sm font-medium text-foreground">
                <span className="tabular font-semibold">{selectedIds.length}</span> selected
              </p>

              <div className="flex flex-wrap items-end gap-2">
                {canPublish && (
                  <Button
                    size="sm"
                    icon={<Check />}
                    disabled={bulkBusy}
                    onClick={() => setPendingStatus('published')}
                  >
                    Publish
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  icon={<Archive />}
                  disabled={bulkBusy}
                  onClick={() => setPendingStatus('archived')}
                >
                  Archive
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Send />}
                  disabled={bulkBusy}
                  onClick={() => void runBulkStatus('pending_review')}
                >
                  Submit for review
                </Button>

                <div className="w-full sm:w-56">
                  <Select
                    label="Change subject"
                    options={[
                      { id: '', label: 'Choose a subject…' },
                      ...subjects.map((subject) => ({ id: subject.id, label: subject.name })),
                    ]}
                    value={bulkSubjectId}
                    onChange={(next) => {
                      setBulkSubjectId(next)
                      void runBulkSubject(next)
                    }}
                    placeholder="Choose a subject…"
                  />
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={bulkBusy}
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        )}

        {loading && <LoadingState label="Loading resources" />}

        {!loading && listQuery.error && (
          <ErrorState
            title="Could not load resources"
            description={listQuery.error}
            onRetry={listQuery.refetch}
          />
        )}

        {showTable && (
          <>
            <DataTable
              caption="Study resources"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={listQuery.isFetching}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              renderActions={(row) => (
                <Link
                  to={`/admin/content/resources/${row.id}`}
                  className="rounded-control px-2 py-1 text-sm font-semibold text-brand transition-colors hover:bg-surface-muted
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  Edit
                </Link>
              )}
              empty={
                <EmptyState
                  title="No resources found"
                  description={
                    hasFilters
                      ? 'Nothing matches these filters. Clear them to see the full library.'
                      : 'Create your first note, PDF or formula sheet and it will appear here.'
                  }
                  action={
                    canCreate ? (
                      <LinkButton
                        to="/admin/content/resources/new"
                        variant="outline"
                        size="sm"
                        icon={<Plus />}
                      >
                        New resource
                      </LinkButton>
                    ) : undefined
                  }
                />
              }
            />

            {listQuery.data && listQuery.data.total > 0 && (
              <Pagination
                page={page}
                pageSize={listQuery.data.pageSize}
                total={listQuery.data.total}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </TabPanel>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus === 'archived' ? 'Archive selected resources?' : 'Publish selected resources?'}
        description={
          pendingStatus === 'archived'
            ? `${selectedIds.length} resource${selectedIds.length === 1 ? '' : 's'} will be removed from the student library. You can restore them later from the Archived tab.`
            : `${selectedIds.length} resource${selectedIds.length === 1 ? '' : 's'} will become visible to students immediately.`
        }
        confirmLabel={pendingStatus === 'archived' ? 'Archive' : 'Publish'}
        tone={pendingStatus === 'archived' ? 'danger' : 'default'}
        loading={bulkBusy}
        onConfirm={() => {
          if (pendingStatus) void runBulkStatus(pendingStatus)
        }}
        onCancel={() => setPendingStatus(null)}
      />
    </div>
  )
}
