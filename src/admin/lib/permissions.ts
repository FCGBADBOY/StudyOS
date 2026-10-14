/**
 * ---------------------------------------------------------------------------
 * Admin permission matrix (client-side mirror — COSMETIC ONLY).
 * ---------------------------------------------------------------------------
 * SECURITY MODEL — read this before changing anything here.
 *
 * The rules below decide which controls the Admin Portal *renders*. They are
 * NOT a security boundary. The authoritative checks live in PostgreSQL:
 *
 *   * `public.role_permissions`      — the role → permission matrix
 *   * `public.has_permission(text)`   — called inside Row Level Security
 *                                       policies (see migration 0012)
 *   * `public.guard_profile_role()`   — blocks privilege escalation
 *   * `public.admin_*()` RPCs         — re-check permission before acting
 *
 * A user who edits localStorage, patches React state or calls PostgREST
 * directly with these flags set to `true` still gets a 42501 from the
 * database. The mirror exists so an editor is not shown a "Publish" button
 * that would only ever produce an error toast.
 */
import type { AdminPermission, AdminRole } from '../types/admin'

/**
 * Role → permissions. Must stay in sync with the `insert` block in
 * `supabase/migrations/20261010000001_admin_roles_permissions.sql`.
 */
const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  student: [],

  content_editor: [
    'content.view',
    'content.create',
    'content.edit',
    'content.upload',
    'content.submit',
    'pyq.create',
    'pyq.edit',
    'pyq.import',
    'academic.view',
    'engine.view',
  ],

  moderator: [
    'content.view',
    'content.moderate',
    'content.archive',
    'academic.view',
    'academic.manage',
    'engine.view',
    'engine.manage',
    'reports.view',
    'reports.resolve',
    'analytics.view',
  ],

  admin: [
    'content.view',
    'content.create',
    'content.edit',
    'content.upload',
    'content.submit',
    'content.publish',
    'content.moderate',
    'content.archive',
    'content.delete',
    'academic.view',
    'academic.manage',
    'engine.view',
    'engine.manage',
    'pyq.create',
    'pyq.edit',
    'pyq.import',
    'pyq.archive',
    'reports.view',
    'reports.resolve',
    'users.view',
    'users.change_role',
    'users.suspend',
    'analytics.view',
    'audit.view',
    'settings.manage',
  ],

  super_admin: [
    'content.view',
    'content.create',
    'content.edit',
    'content.upload',
    'content.submit',
    'content.publish',
    'content.moderate',
    'content.archive',
    'content.delete',
    'academic.view',
    'academic.manage',
    'engine.view',
    'engine.manage',
    'pyq.create',
    'pyq.edit',
    'pyq.import',
    'pyq.archive',
    'reports.view',
    'reports.resolve',
    'users.view',
    'users.change_role',
    'users.suspend',
    'analytics.view',
    'audit.view',
    'settings.manage',
    'admin.manage',
  ],
}

/** Every permission a role holds, for the "what this role can do" panel. */
export function permissionsFor(role: AdminRole | null | undefined): readonly AdminPermission[] {
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Does the role hold the permission?
 *
 * Accepts several permissions and returns true when the role has ALL of them
 * (`all`) or ANY of them (`any`) — the common cases for gating a control.
 */
export function can(
  role: AdminRole | null | undefined,
  permission: AdminPermission | readonly AdminPermission[],
  options: { mode?: 'all' | 'any' } = {},
): boolean {
  const held = new Set(permissionsFor(role))
  const required = Array.isArray(permission) ? permission : [permission as AdminPermission]
  if (!required.length) return false
  return options.mode === 'any'
    ? required.some((entry) => held.has(entry))
    : required.every((entry) => held.has(entry))
}

/** True for any role that can reach the Admin Portal at all. */
export function isStaff(role: AdminRole | null | undefined): boolean {
  return role != null && role !== 'student'
}

/** Only a super admin may grant the super admin role (mirrors the trigger). */
export function canGrantRole(actor: AdminRole | null | undefined, target: AdminRole): boolean {
  if (target === 'super_admin') return actor === 'super_admin'
  return can(actor, 'users.change_role')
}

/** Roles the given actor is allowed to assign (never above their own level). */
export function assignableRoles(actor: AdminRole | null | undefined): AdminRole[] {
  const all: AdminRole[] = ['student', 'content_editor', 'moderator', 'admin', 'super_admin']
  return all.filter((role) => canGrantRole(actor, role))
}
