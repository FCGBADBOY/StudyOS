/**
 * Admin → Users: the directory.
 *
 * The table reads from `admin_user_directory` (a view that exposes only what a
 * staff account needs — no auth secrets, no provider tokens), and every filter
 * is applied in PostgreSQL so this stays quick at any account count.
 *
 * Role changes and suspensions go through RPCs rather than a plain UPDATE, so
 * the database re-checks permission and blocks privilege escalation. The
 * buttons below are hidden when the role lacks the capability, but that is a
 * courtesy: forging the UI still produces a 42501.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, UsersRound } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  SkeletonCard,
  StatCard,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { Pagination } from '../components/DataTable'
import { ConfirmDialog, Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { assignableRoles, can } from '../lib/permissions'
import {
  getUserCounts,
  listUsers,
  setUserRole,
  setUserSuspended,
  USER_PAGE_SIZE,
  type UserFilter,
} from '../services/adminUsers.service'
import type { AdminRole, AdminUserRow } from '../types/admin'

const STATUS_OPTIONS = [
  { id: 'all', label: 'Everyone' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
]

const ROLE_OPTIONS = [
  { id: 'all', label: 'Every role' },
  { id: 'student', label: 'Student' },
  { id: 'content_editor', label: 'Content Editor' },
  { id: 'moderator', label: 'Moderator' },
  { id: 'admin', label: 'Admin' },
  { id: 'super_admin', label: 'Super Admin' },
]

const ROLE_TONE: Record<AdminRole, 'neutral' | 'brand' | 'warning' | 'danger'> = {
  student: 'neutral',
  content_editor: 'brand',
  moderator: 'warning',
  admin: 'danger',
  super_admin: 'danger',
}

export default function AdminUsersPage() {
  const { toast } = useToast()
  const { role: actorRole, loading: sessionLoading, profile: me } = useAdminSession()

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all')
  const [roleId, setRoleId] = useState<string>('all')
  const [search, setSearch] = useState('')

  /* Suspense for a single row's role change / suspension. */
  const [pendingRole, setPendingRole] = useState<{ user: AdminUserRow; role: AdminRole } | null>(null)
  const [pendingSuspend, setPendingSuspend] = useState<{ user: AdminUserRow; suspend: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const filter = useMemo<UserFilter>(
    () => ({
      status,
      role: roleId === 'all' ? 'all' : (roleId as AdminRole),
      search: search.trim() || undefined,
    }),
    [status, roleId, search],
  )

  const { data, loading, error, refetch } = useQuery(
    `admin:users:${JSON.stringify(filter)}:${page}`,
    () => listUsers(filter, page, USER_PAGE_SIZE),
    { enabled: !sessionLoading && can(actorRole, 'users.view') },
  )

  const { data: counts } = useQuery('admin:users:counts', getUserCounts, {
    enabled: !sessionLoading && can(actorRole, 'users.view'),
  })

  /* Debounce the search box so typing does not fire a query per keystroke. */
  const [searchDraft, setSearchDraft] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const mayChangeRole = can(actorRole, 'users.change_role')
  const maySuspend = can(actorRole, 'users.suspend')
  const grantable = assignableRoles(actorRole)

  async function applyRole() {
    if (!pendingRole) return
    setBusy(true)
    try {
      await setUserRole(pendingRole.user.id, pendingRole.role)
      toast({
        title: 'Role updated',
        description: `${pendingRole.user.full_name ?? pendingRole.user.username ?? 'That account'} is now a ${pendingRole.role.replace('_', ' ')}.`,
        variant: 'success',
      })
      setPendingRole(null)
      refetch()
    } catch (caught) {
      toast({
        title: 'Could not change the role',
        description: caught instanceof Error ? caught.message : undefined,
        variant: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  async function applySuspend() {
    if (!pendingSuspend) return
    setBusy(true)
    try {
      await setUserSuspended(pendingSuspend.user.id, pendingSuspend.suspend)
      toast({
        title: pendingSuspend.suspend ? 'Account suspended' : 'Account reactivated',
        variant: pendingSuspend.suspend ? 'warning' : 'success',
      })
      setPendingSuspend(null)
      refetch()
    } catch (caught) {
      toast({
        title: 'Could not update the account',
        description: caught instanceof Error ? caught.message : undefined,
        variant: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!sessionLoading && !can(actorRole, 'users.view')) {
    return (
      <Notice tone="warning" title="You don't have permission to view users.">
        Ask a super admin to grant <code className="font-mono text-xs">users.view</code> if you believe
        this is a mistake.
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle="Manage accounts, roles and access across StudyOS."
        actions={
          <Button variant="ghost" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {counts && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total accounts"
            value={counts.total.toLocaleString('en-IN')}
            accent="brand"
            icon={<UsersRound className="size-4" aria-hidden="true" />}
          />
          <StatCard
            label="Students"
            value={counts.students.toLocaleString('en-IN')}
            accent="neutral"
          />
          <StatCard
            label="Staff"
            value={counts.staff.toLocaleString('en-IN')}
            accent="success"
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          />
          <StatCard
            label="Suspended"
            value={counts.suspended.toLocaleString('en-IN')}
            accent={counts.suspended > 0 ? 'danger' : 'neutral'}
          />
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Search"
            placeholder="Name, username or email"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(value) => {
              setStatus(value as 'all' | 'active' | 'suspended')
              setPage(1)
            }}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Role"
            value={roleId}
            onChange={(value) => {
              setRoleId(value)
              setPage(1)
            }}
            options={ROLE_OPTIONS}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} account${total === 1 ? '' : 's'}`}
          </p>
          {(searchDraft || status !== 'all' || roleId !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchDraft('')
                setSearch('')
                setStatus('all')
                setRoleId('all')
                setPage(1)
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="We could not load users." description={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No accounts match those filters"
          description="Try clearing the search or widening the status filter."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((user) => {
            const isSelf = me?.id === user.id
            return (
              <li key={user.id}>
                <Card className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={user.full_name ?? user.username ?? 'Account'}
                        src={user.avatar_url ?? undefined}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/users/${user.id}`}
                            className="truncate font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                          >
                            {user.full_name ?? user.username ?? 'Unnamed account'}
                          </Link>
                          <Badge variant={ROLE_TONE[user.role]}>
                            {user.role.replace('_', ' ')}
                          </Badge>
                          {user.suspended && <Badge variant="danger">Suspended</Badge>}
                          {isSelf && <Badge variant="neutral">You</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {user.email ?? 'No email on file'}
                          {user.username ? ` · @${user.username}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {mayChangeRole && !isSelf && (
                        <Select
                          value={user.role}
                          onChange={(value) =>
                            setPendingRole({ user, role: value as AdminRole })
                          }
                          options={ROLE_OPTIONS.filter((option) => option.id !== 'all').filter(
                            (option) => grantable.includes(option.id as AdminRole),
                          )}
                          className="w-40"
                          id={`role-${user.id}`}
                        />
                      )}
                      {maySuspend && !isSelf && (
                        <Button
                          variant={user.suspended ? 'ghost' : 'danger'}
                          size="sm"
                          onClick={() => setPendingSuspend({ user, suspend: !user.suspended })}
                        >
                          {user.suspended ? 'Reactivate' : 'Suspend'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {total > USER_PAGE_SIZE && (
        <Pagination page={page} pageSize={USER_PAGE_SIZE} total={total} onPageChange={setPage} />
      )}

      <ConfirmDialog
        open={pendingRole !== null}
        title="Change this account's role?"
        description={
          <>
            <p>
              <span className="font-medium text-foreground">
                {pendingRole?.user.full_name ?? pendingRole?.user.username ?? 'This account'}
              </span>{' '}
              will become a <span className="font-medium">{pendingRole?.role.replace('_', ' ')}</span>.
            </p>
            <p className="mt-2">
              This changes what they can do immediately, including their access to this portal.
            </p>
          </>
        }
        confirmLabel="Change role"
        loading={busy}
        onConfirm={applyRole}
        onCancel={() => setPendingRole(null)}
      />

      <ConfirmDialog
        open={pendingSuspend !== null}
        title={pendingSuspend?.suspend ? 'Suspend this account?' : 'Reactivate this account?'}
        tone={pendingSuspend?.suspend ? 'danger' : 'default'}
        description={
          pendingSuspend?.suspend ? (
            <>
              <p>
                <span className="font-medium text-foreground">
                  {pendingSuspend.user.full_name ?? pendingSuspend.user.username ?? 'This account'}
                </span>{' '}
                will lose access to StudyOS until reactivated.
              </p>
              <p className="mt-2">Their progress, notes and history are kept.</p>
            </>
          ) : (
            <p>This account will be able to sign in again.</p>
          )
        }
        confirmLabel={pendingSuspend?.suspend ? 'Suspend account' : 'Reactivate'}
        loading={busy}
        onConfirm={applySuspend}
        onCancel={() => setPendingSuspend(null)}
      />
    </div>
  )
}
