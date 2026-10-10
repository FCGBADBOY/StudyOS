/**
 * Admin service: audit log + reports moderation queue.
 *
 * The audit trail is written through `public.log_admin_action()` — a SECURITY
 * DEFINER function that stamps the *real* session user onto the row and strips
 * anything that looks like a secret from the metadata. Clients cannot INSERT
 * into `audit_logs` directly (no policy exists), so entries cannot be forged.
 *
 * Read access needs `audit.view` (admin and super_admin). Report moderation
 * needs `reports.view` / `reports.resolve`.
 */
import { db, isDemo, rows, one, mutate } from '@/services/shared'
import type { AdminReportRow, AuditLogRow, ReportStatus } from '../types/admin'
import { DEMO_ADMINS_AUDIT, DEMO_ADMINS_REPORTS } from '../data/adminDemo'
import { demoId, nowIso, readCollection, writeCollection } from './demoStore'

/* -------------------------------- audit log ------------------------------- */

/**
 * Record an administrative action.
 *
 * Always resolves — an audit failure must never break the action it is
 * describing, so errors are swallowed after a dev-mode warning.
 */
export async function logAdminAction(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (isDemo) {
    await logAdminActionDemo(action, entityType, entityId, metadata)
    return
  }

  const client = db()
  if (!client) return

  try {
    const { error } = await client.rpc('log_admin_action', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_metadata: metadata,
    })
    if (error && import.meta.env.DEV) console.warn('[admin:audit]', error.message)
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[admin:audit]', error)
  }
}

/** Demo-mode audit writer (same shape, persisted locally). */
export async function logAdminActionDemo(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const entry: AuditLogRow = {
    id: demoId('a'),
    actor_id: 'demo-admin',
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    created_at: nowIso(),
  }
  const all = readCollection<AuditLogRow>('audit', DEMO_ADMINS_AUDIT)
  writeCollection<AuditLogRow>('audit', [entry, ...all].slice(0, 500))
}

export interface AuditQuery {
  action?: string
  entityType?: string
  limit?: number
}

export async function listAuditLog(query: AuditQuery = {}): Promise<AuditLogRow[]> {
  const { limit = 100 } = query

  if (isDemo) {
    const all = readCollection<AuditLogRow>('audit', DEMO_ADMINS_AUDIT)
    return all
      .filter((row) => (query.action ? row.action === query.action : true))
      .filter((row) => (query.entityType ? row.entity_type === query.entityType : true))
      .slice(0, limit)
  }

  const client = db()
  if (!client) return []

  let request = client
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (query.action) request = request.eq('action', query.action)
  if (query.entityType) request = request.eq('entity_type', query.entityType)

  return rows<AuditLogRow>(request)
}

/* --------------------------------- reports -------------------------------- */

export interface ReportQuery {
  status?: ReportStatus | 'all'
  type?: string
  search?: string
}

/**
 * Reports matching the filter. `item_title` and `description` are searched
 * together so a moderator can paste an id or a phrase.
 */
export async function listReports(query: ReportQuery = {}): Promise<AdminReportRow[]> {
  if (isDemo) {
    const all = readCollection<AdminReportRow>('reports', DEMO_ADMINS_REPORTS)
    const needle = query.search?.trim().toLowerCase() ?? ''
    return all
      .filter((row) => (query.status && query.status !== 'all' ? row.status === query.status : true))
      .filter((row) => (query.type && query.type !== 'all' ? row.report_type === query.type : true))
      .filter((row) =>
        needle
          ? row.item_title.toLowerCase().includes(needle) ||
            (row.description ?? '').toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  const client = db()
  if (!client) return []

  let request = client
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (query.status && query.status !== 'all') request = request.eq('status', query.status)
  if (query.type && query.type !== 'all') request = request.eq('report_type', query.type)
  if (query.search?.trim()) {
    const needle = query.search.trim()
    request = request.or(`item_title.ilike.%${needle}%,description.ilike.%${needle}%`)
  }

  return rows<AdminReportRow>(request)
}

export async function getReport(id: string): Promise<AdminReportRow | null> {
  if (isDemo) {
    return readCollection<AdminReportRow>('reports', DEMO_ADMINS_REPORTS).find((row) => row.id === id) ?? null
  }
  const client = db()
  if (!client) return null
  return one<AdminReportRow>(client.from('reports').select('*').eq('id', id).maybeSingle())
}

export interface ReportResolution {
  status: Extract<ReportStatus, 'investigating' | 'resolved' | 'dismissed'>
  note?: string
}

/**
 * Move a report through the moderation queue.
 * The reviewer and timestamp are stamped by the database policy/trigger.
 */
export async function resolveReport(id: string, resolution: ReportResolution): Promise<void> {
  const stamp = { resolved_at: nowIso(), resolution_note: resolution.note?.trim() || null }

  if (isDemo) {
    const all = readCollection<AdminReportRow>('reports', DEMO_ADMINS_REPORTS)
    const next = all.map((row) =>
      row.id === id
        ? {
            ...row,
            status: resolution.status,
            ...stamp,
            resolved_by: resolution.status === 'investigating' ? row.resolved_by : 'demo-admin',
          }
        : row,
    )
    writeCollection<AdminReportRow>('reports', next)
    await logAdminActionDemo('report.updated', 'report', id, { status: resolution.status })
    return
  }

  const client = db()
  if (!client) return
  await mutate(
    client
      .from('reports')
      .update({
        status: resolution.status,
        ...stamp,
        resolved_by: resolution.status === 'investigating' ? null : (await currentUserId(client)),
      })
      .eq('id', id),
  )
  await logAdminAction('report.updated', 'report', id, { status: resolution.status })
}

/** Current session user, used to stamp `resolved_by`. */
async function currentUserId(client: NonNullable<ReturnType<typeof db>>): Promise<string | null> {
  const { data } = await client.auth.getUser()
  return data.user?.id ?? null
}

export interface ReportCounts {
  open: number
  investigating: number
  resolved: number
  dismissed: number
  total: number
}

/** Badge counts for the reports tab bar. */
export async function getReportCounts(): Promise<ReportCounts> {
  const all = await listReports()
  const counts: ReportCounts = { open: 0, investigating: 0, resolved: 0, dismissed: 0, total: all.length }
  for (const row of all) counts[row.status] += 1
  return counts
}

/* ------------------------------ student report ---------------------------- */
/* The same shape a student would submit from the app (spec §25).             */

export interface FileReportInput {
  report_type: AdminReportRow['report_type']
  item_type: AdminReportRow['item_type']
  item_id: string | null
  item_title: string
  description?: string
}

/**
 * File a report as the signed-in user. The RLS policy forces
 * `reporter_id = auth.uid()`, so a student cannot accuse on someone else's
 * behalf even if the field is tampered with client-side.
 */
export async function fileReport(input: FileReportInput): Promise<void> {
  if (isDemo) {
    const row: AdminReportRow = {
      id: demoId('rep'),
      reporter_id: 'demo-student',
      report_type: input.report_type,
      item_type: input.item_type,
      item_id: input.item_id,
      item_title: input.item_title,
      description: input.description?.trim() || null,
      status: 'open',
      resolution_note: null,
      resolved_by: null,
      resolved_at: null,
      created_at: nowIso(),
    }
    const all = readCollection<AdminReportRow>('reports', DEMO_ADMINS_REPORTS)
    writeCollection<AdminReportRow>('reports', [row, ...all])
    return
  }

  const client = db()
  if (!client) return

  const { data } = await client.auth.getUser()
  await mutate(
    client.from('reports').insert({
      reporter_id: data.user?.id ?? null,
      report_type: input.report_type,
      item_type: input.item_type,
      item_id: input.item_id,
      item_title: input.item_title,
      description: input.description?.trim() || null,
    }),
  )
}
