/**
 * Admin → User detail.
 *
 * Two halves, deliberately separated:
 *
 *   * Account — what an admin may change: the role, and whether the account is
 *     suspended. Both go through RPCs so the database re-checks permission and
 *     refuses privilege escalation.
 *   * Learning — what an admin may only *read*: study minutes, questions
 *     attempted, accuracy, mistakes, bookmarks. There is no write path here at
 *     all, because a student's progress is theirs, not the platform's.
 *
 * No auth secrets are shown. Email comes from `admin_user_directory`, a view
 * that exposes nothing from `auth.users` beyond the address itself.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, BookMarked, CircleAlert, Clock, ListChecks, Target } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { ConfirmDialog, Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { assignableRoles, can, permissionsFor } from '../lib/permissions'
import {
  getUser,
  getUserActivity,
  setUserRole,
  setUserSuspended,
} from '../services/adminUsers.service'
import type { AdminRole } from '../types/admin'

const ROLE_TONE: Record<AdminRole, 'neutral' | 'brand' | 'warning' | 'danger'> = {
  student: 'neutral',
  content_editor: 'brand',
  moderator: 'warning',
  admin: 'danger',
  super_admin: 'danger',
}

const ROLE_BLURB: Record<AdminRole, string> = {
  student: 'Studies, tracks progress and reports problems. No portal access.',
  content_editor: 'Creates and edits resources and PYQs. Cannot publish or manage users.',
  moderator: 'Reviews reports and content quality. Manages the academic hierarchy.',
  admin: 'Full content, publishing, user and analytics access.',
  super_admin: 'Everything an admin can do, plus granting administrative roles.',
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const { role: actorRole, profile: me } = useAdminSession()

  const [busy, setBusy] = useState(false)
  const [pendingRole, setPendingRole] = useState<AdminRole | null>(null)
  const [pendingSuspend, setPendingSuspend] = useState<boolean | null>(null)
  const [suspendReason, setSuspendReason] = useState('')

  const { data: user, loading, error, refetch } = useQuery(
    id ? `admin:user:${id}` : null,
    () => getUser(id!),
    { enabled: Boolean(id) && can(actorRole, 'users.view') },
  )

  const { data: activity } = useQuery(
    id ? `admin:user:${id}:activity` : null,
    () => getUserActivity(id!),
    { enabled: Boolean(id) && can(actorRole, 'users.view') },
  )

  if (loading) {
    return (
      <div className="py-10">
        <LoadingState label="Loading account…" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="We could not load that account." description={error} onRetry={refetch} />
  }

  if (!user) {
    return (
      <EmptyAccount />
    )
  }

  const isSelf = me?.id === user.id
  const mayChangeRole = can(actorRole, 'users.change_role') && !isSelf
  const maySuspend = can(actorRole, 'users.suspend') && !isSelf
  const grantable = assignableRoles(actorRole)
  const heldPermissions = permissionsFor(user.role)

  async function applyRole() {
    if (!pendingRole || !user) return
    setBusy(true)
    try {
      await setUserRole(user.id, pendingRole)
      toast({ title: 'Role updated', description: `Now a ${pendingRole.replace('_', ' ')}.`, variant: 'success' })
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
    if (pendingSuspend === null || !user) return
    setBusy(true)
    try {
      await setUserSuspended(user.id, pendingSuspend, suspendReason.trim() || undefined)
      toast({
        title: pendingSuspend ? 'Account suspended' : 'Account reactivated',
        variant: pendingSuspend ? 'warning' : 'success',
      })
      setPendingSuspend(null)
      setSuspendReason('')
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

  return (
    <div className="space-y-5">
      <PageHeader
        back
        title={user.full_name ?? user.username ?? 'Unnamed account'}
        subtitle={user.email ?? 'No email on file'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LinkButton to="/admin/users" variant="ghost">
              <ArrowLeft className="size-4" aria-hidden="true" />
              All users
            </LinkButton>
          </div>
        }
      />

      {/* ------------------------------------------------------ identity */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={user.full_name ?? user.username ?? 'Account'} src={user.avatar_url ?? undefined} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={ROLE_TONE[user.role]}>{user.role.replace('_', ' ')}</Badge>
              {user.suspended ? (
                <Badge variant="danger">Suspended</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
              {isSelf && <Badge variant="neutral">This is you</Badge>}
            </div>

            <p className="mt-2 text-sm text-muted">{ROLE_BLURB[user.role]}</p>

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Username" value={user.username ? `@${user.username}` : '—'} />
              <Row label="Joined" value={formatDate(user.created_at)} />
              <Row label="Last active" value={user.last_active_at ? formatRelative(user.last_active_at) : 'Never'} />
              <Row label="Target exam" value={user.target_exam ?? '—'} />
              {user.suspended && (
                <>
                  <Row label="Suspended" value={formatDate(user.suspended_at)} />
                  <Row label="Reason" value={user.suspended_reason ?? 'No reason recorded'} />
                </>
              )}
            </dl>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------- account */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Account access</h2>
        <p className="mt-1 text-sm text-muted">
          Role and suspension are enforced by the database, not this screen.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          {mayChangeRole ? (
            <Select
              label="Role"
              value={user.role}
              onChange={(value) => setPendingRole(value as AdminRole)}
              options={grantable.map((role) => ({ id: role, label: role.replace('_', ' ') }))}
              className="flex-1"
              id="user-role"
            />
          ) : (
            <div className="flex-1">
              <p className="mb-1.5 text-[13px] font-medium text-muted">Role</p>
              <div className="flex h-11 items-center rounded-control border border-border bg-surface-muted px-3 text-sm text-muted">
                {user.role.replace('_', ' ')}
              </div>
            </div>
          )}

          {maySuspend && (
            <Button
              variant={user.suspended ? 'ghost' : 'danger'}
              onClick={() => setPendingSuspend(!user.suspended)}
            >
              {user.suspended ? 'Reactivate account' : 'Suspend account'}
            </Button>
          )}
        </div>

        {!mayChangeRole && (
          <p className="mt-3 text-xs text-muted">
            {isSelf
              ? 'You cannot change your own role.'
              : 'Your role does not include users.change_role.'}
          </p>
        )}
      </Card>

      {/* ---------------------------------------------------- permissions */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">What this role can do</h2>
        {heldPermissions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nothing in the Admin Portal — students have no administrative permissions.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {heldPermissions.map((permission) => (
              <li key={permission}>
                <Badge variant="outline">
                  <code className="font-mono text-[11px]">{permission}</code>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ------------------------------------------------------ learning */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="size-4" aria-hidden="true" />
          Learning activity
        </h2>
        <p className="mb-3 text-sm text-muted">
          Read-only. Study data belongs to the student — it can be inspected here but never edited.
        </p>

        {activity ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Questions attempted"
              value={activity.questionsAttempted.toLocaleString('en-IN')}
              accent="brand"
              icon={<ListChecks className="size-4" aria-hidden="true" />}
            />
            <StatCard
              label="Accuracy"
              value={activity.accuracy === null ? '—' : `${activity.accuracy}%`}
              accent={activity.accuracy === null ? 'neutral' : activity.accuracy >= 60 ? 'success' : 'warning'}
              icon={<Target className="size-4" aria-hidden="true" />}
            />
            <StatCard
              label="Time studied"
              value={formatMinutes(activity.minutesStudied)}
              accent="neutral"
              icon={<Clock className="size-4" aria-hidden="true" />}
            />
            <StatCard
              label="Chapters started"
              value={activity.chaptersStarted.toLocaleString('en-IN')}
              accent="neutral"
              icon={<BookMarked className="size-4" aria-hidden="true" />}
            />
            <StatCard
              label="Mistakes logged"
              value={activity.mistakes.toLocaleString('en-IN')}
              accent={activity.mistakes > 20 ? 'warning' : 'neutral'}
              icon={<CircleAlert className="size-4" aria-hidden="true" />}
            />
            <StatCard
              label="Bookmarks"
              value={activity.bookmarks.toLocaleString('en-IN')}
              accent="neutral"
            />
            <StatCard
              label="Study sessions"
              value={activity.sessions.toLocaleString('en-IN')}
              accent="neutral"
            />
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Syllabus coverage</p>
              <ProgressBar
                value={Math.min(100, activity.chaptersStarted * 7)}
                label="Chapters touched"
                className="mt-3"
              />
              <p className="mt-2 text-xs text-muted">
                {activity.chaptersStarted} chapter{activity.chaptersStarted === 1 ? '' : 's'} opened at
                least once.
              </p>
            </div>
          </div>
        ) : (
          <Card className="p-5">
            <LoadingState label="Loading activity…" />
          </Card>
        )}
      </div>

      {/* ------------------------------------------------------- dialogs */}
      <ConfirmDialog
        open={pendingRole !== null}
        title="Change this account's role?"
        description={
          <>
            <p>
              <span className="font-medium text-foreground">
                {user.full_name ?? user.username ?? 'This account'}
              </span>{' '}
              will become a <span className="font-medium">{pendingRole?.replace('_', ' ')}</span>.
            </p>
            <p className="mt-2">{pendingRole ? ROLE_BLURB[pendingRole] : ''}</p>
          </>
        }
        confirmLabel="Change role"
        loading={busy}
        onConfirm={applyRole}
        onCancel={() => setPendingRole(null)}
      />

      <ConfirmDialog
        open={pendingSuspend !== null}
        title={pendingSuspend ? 'Suspend this account?' : 'Reactivate this account?'}
        tone={pendingSuspend ? 'danger' : 'default'}
        description={
          pendingSuspend ? (
            <div className="space-y-3">
              <p>
                They will lose access to StudyOS until reactivated. Progress and notes are kept.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-muted">
                  Reason (recorded in the audit log)
                </span>
                <textarea
                  value={suspendReason}
                  onChange={(event) => setSuspendReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm
                             text-foreground focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-brand-ring"
                  placeholder="Repeatedly uploaded broken resource links."
                />
              </label>
            </div>
          ) : (
            <p>This account will be able to sign in again.</p>
          )
        }
        confirmLabel={pendingSuspend ? 'Suspend account' : 'Reactivate'}
        loading={busy}
        onConfirm={applySuspend}
        onCancel={() => {
          setPendingSuspend(null)
          setSuspendReason('')
        }}
      />
    </div>
  )
}

function EmptyAccount() {
  return (
    <Card className="p-8 text-center">
      <p className="font-medium text-foreground">That account could not be found.</p>
      <p className="mt-1 text-sm text-muted">It may have been removed, or the link is out of date.</p>
      <div className="mt-4">
        <LinkButton to="/admin/users" variant="secondary">
          Back to users
        </LinkButton>
      </div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-foreground">{value}</dd>
    </div>
  )
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelative(value: string): string {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}
