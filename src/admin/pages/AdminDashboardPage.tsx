/**
 * Admin → Dashboard: platform KPIs, the content status mix, recent audit
 * activity and quick links into the management screens.
 *
 * Every figure comes from the analytics/audit services — nothing is invented
 * in the view. Counters animate once per fetch with the shared `statCounter`
 * helper, and the page degrades to skeletons (loading) or an ErrorState with
 * retry (failure) per query so one broken RPC never blanks the dashboard.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  RefreshCw,
  Users,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  SectionHeader,
  SkeletonCard,
  StatCard,
  type StatCardProps,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { isDemo } from '@/services/shared'
import { greetingForHour, relativeTime } from '@/utils/format'
import { statCounter } from '../animations/adminAnimations'
import { Notice } from '../components/AdminFeedback'
import { DonutChart, type DonutSegment } from '../components/Charts'
import { getPlatformStats } from '../services/adminAnalytics.service'
import { listAuditLog } from '../services/adminAudit.service'
import type { AuditLogRow, PlatformStats } from '../types/admin'

/** One focus treatment reused by every interactive element on the page. */
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

const SKELETON_COUNT = 6
const ACTIVITY_LIMIT = 8

/**
 * StatCard whose value counts up once per fetch.
 *
 * `StatCard` takes a plain ReactNode for `value`, so the animated span lives
 * here and hands its node straight to `statCounter`.
 */
function AnimatedStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: number
  icon?: ReactNode
  accent?: StatCardProps['accent']
}) {
  const valueRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => statCounter(valueRef.current, value), [value])

  return (
    <StatCard
      label={label}
      accent={accent}
      icon={icon}
      value={<span ref={valueRef}>{value.toLocaleString('en-IN')}</span>}
    />
  )
}

/** `content.published` -> "Content Published". */
function humanise(action: string): string {
  const text = action.replace(/[._]/g, ' ').trim()
  if (!text) return action
  return text.replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Status mix for the donut.
 *
 * `admin_platform_stats()` exposes drafts, pending review, published and
 * archived directly; approved is whatever is left once those are accounted
 * for. The RPC has no rejected counter yet, so that segment stays at zero
 * rather than inventing a number.
 */
function contentStatusSegments(stats: PlatformStats): DonutSegment[] {
  const accountedFor = stats.drafts + stats.pending_review + stats.published + stats.archived
  const approved = Math.max(0, stats.resources - accountedFor)

  return [
    { label: 'Draft', value: stats.drafts, className: 'fill-brand' },
    { label: 'Pending Review', value: stats.pending_review, className: 'fill-warning' },
    { label: 'Approved', value: approved, className: 'fill-accent' },
    { label: 'Published', value: stats.published, className: 'fill-success' },
    { label: 'Rejected', value: 0, className: 'fill-danger' },
    { label: 'Archived', value: stats.archived, className: 'fill-border' },
  ]
}

export default function AdminDashboardPage() {
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  const statsQuery = useQuery<PlatformStats>('admin:dashboard:platform-stats', () => getPlatformStats())
  const auditQuery = useQuery<AuditLogRow[]>('admin:dashboard:recent-activity', () =>
    listAuditLog({ limit: ACTIVITY_LIMIT }),
  )

  const stats = statsQuery.data
  const activity = auditQuery.data
  const refreshing = statsQuery.isFetching || auditQuery.isFetching

  function refresh() {
    statsQuery.refetch()
    auditQuery.refetch()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingForHour()}, Admin`}
        subtitle="Manage and monitor StudyOS."
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw />}
            loading={refreshing}
            onClick={refresh}
            className={FOCUS_RING}
          >
            Refresh
          </Button>
        }
      />

      {isDemo && !noticeDismissed && (
        <Notice tone="info" title="Demo mode">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0">
              This portal is running on bundled seed data, not a live database — the figures and activity below are
              sample content.
            </p>
            <button
              type="button"
              onClick={() => setNoticeDismissed(true)}
              className={`shrink-0 rounded-control px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground ${FOCUS_RING}`}
            >
              Dismiss
            </button>
          </div>
        </Notice>
      )}

      {/* ------------------------------------------------------- statistics */}
      <section aria-label="Platform statistics" className="space-y-4">
        {statsQuery.error && !stats ? (
          <ErrorState
            title="Could not load platform statistics"
            description={statsQuery.error}
            onRetry={statsQuery.refetch}
          />
        ) : !stats ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading platform statistics"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <span className="sr-only">Loading platform statistics…</span>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatedStat label="Total Students" value={stats.students} icon={<Users />} accent="brand" />
              <AnimatedStat label="Total Resources" value={stats.resources} icon={<BookOpen />} accent="neutral" />
              <AnimatedStat label="Total PYQs" value={stats.pyqs} icon={<FileText />} accent="brand" />
              <AnimatedStat
                label="Published Content"
                value={stats.published}
                icon={<CheckCircle2 />}
                accent="success"
              />
              <AnimatedStat
                label="Pending Reviews"
                value={stats.pending_review}
                icon={<Clock />}
                accent="warning"
              />
              <AnimatedStat label="Open Reports" value={stats.open_reports} icon={<Flag />} accent="danger" />
            </div>

            <Card as="section" aria-label="Content status">
              <CardHeader
                title="Content status"
                subtitle="How every resource is distributed across the publishing workflow."
              />
              <div className="mt-4">
                <DonutChart
                  title="Content status distribution"
                  centerLabel="Resources"
                  centerValue={stats.resources.toLocaleString('en-IN')}
                  segments={contentStatusSegments(stats)}
                />
              </div>
            </Card>
          </>
        )}
      </section>

      {/* --------------------------------------------------- recent activity */}
      <section aria-label="Recent activity">
        {auditQuery.error && !activity ? (
          <ErrorState
            title="Could not load recent activity"
            description={auditQuery.error}
            onRetry={auditQuery.refetch}
          />
        ) : !activity ? (
          <LoadingState label="Loading recent activity" />
        ) : (
          <Card as="section">
            <CardHeader
              title="Recent activity"
              subtitle={`The last ${ACTIVITY_LIMIT} actions recorded in the audit log.`}
            />

            {activity.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  compact
                  title="No activity yet"
                  description="Actions taken in the admin portal will appear here."
                />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{humanise(entry.action)}</p>
                      <p className="mt-0.5 text-xs text-faint">{relativeTime(entry.created_at)}</p>
                    </div>
                    <Badge variant="neutral">{entry.entity_type}</Badge>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to="/admin/audit"
              className={`mt-4 inline-flex items-center gap-1.5 rounded-control px-1 py-1 text-sm font-semibold text-brand transition-colors hover:text-foreground ${FOCUS_RING}`}
            >
              View full audit log
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Card>
        )}
      </section>

      {/* ------------------------------------------------------ quick links */}
      <section aria-labelledby="dashboard-quick-links">
        <SectionHeader id="dashboard-quick-links" title="Quick links" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LinkButton
            to="/admin/content"
            variant="outline"
            icon={<BookOpen />}
            className={FOCUS_RING}
          >
            Resources
          </LinkButton>
          <LinkButton to="/admin/content/pyq" variant="outline" icon={<FileText />} className={FOCUS_RING}>
            PYQs
          </LinkButton>
          <LinkButton to="/admin/users" variant="outline" icon={<Users />} className={FOCUS_RING}>
            Users
          </LinkButton>
          <LinkButton to="/admin/reports" variant="outline" icon={<Flag />} className={FOCUS_RING}>
            Reports
          </LinkButton>
        </div>
      </section>
    </div>
  )
}
