/**
 * One CRUD surface for the academic hierarchy (boards → classes → streams →
 * subjects → chapters).
 *
 * The five screens differ only in *which* columns are shown, *which* fields
 * the form has and *which* service functions are called — not in how archiving,
 * validation, permissions or modals behave. Driving them from a config keeps
 * those rules in one place instead of five near-copies that drift apart.
 *
 * Two invariants this component enforces for every level:
 *
 *   * Nothing is permanently deleted. The only destructive action is archiving,
 *     which hides the row from students and can be reversed from this screen.
 *   * Writes are gated by `academic.manage` — a courtesy check so an editor is
 *     never shown a button that the database would reject with a 42501.
 */
import { useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, RotateCcw } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  SkeletonCard,
  Textarea,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { DataTable, type Column } from './DataTable'
import { ConfirmDialog, Notice } from './AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'

/* ------------------------------- config types ------------------------------ */

export interface HierarchyField {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'lines'
  required?: boolean
  placeholder?: string
  hint?: string
  /** Select choices — recomputed on every render so lookups can load late. */
  options?: { id: string; label: string }[]
  /** Render full width (descriptions, topic lists). */
  wide?: boolean
  /** Seeded when the form opens for a *new* row. */
  defaultValue?: string
}

export interface HierarchyConfig<TRow extends { id: string; name: string; is_archived: boolean }> {
  /** Page title, e.g. "Boards". */
  title: string
  subtitle: string
  /** Singular noun used in dialog copy, e.g. "board". */
  entity: string
  /** Cache key segment for the list query. */
  queryKey: string
  columns: Column<TRow>[]
  fields: HierarchyField[]
  list: (includeArchived: boolean) => Promise<TRow[]>
  create: (values: Record<string, unknown>) => Promise<unknown>
  update: (id: string, values: Record<string, unknown>) => Promise<void>
  setArchived: (id: string, archived: boolean) => Promise<void>
  /** Extra rules beyond "required" — return an error message or null. */
  validate?: (values: Record<string, unknown>) => string | null
}

/** Drafts are plain strings; `lines` fields are newline-separated arrays. */
type Draft = Record<string, string>

function seedDraft<TRow>(fields: HierarchyField[], row: TRow | null): Draft {
  const draft: Draft = {}
  for (const field of fields) {
    if (!row) {
      draft[field.key] = field.defaultValue ?? (field.kind === 'checkbox' ? 'false' : '')
      continue
    }
    const raw = (row as unknown as Record<string, unknown>)[field.key]
    if (field.kind === 'lines') draft[field.key] = Array.isArray(raw) ? raw.join('\n') : ''
    else if (field.kind === 'checkbox') draft[field.key] = raw ? 'true' : 'false'
    else if (raw === null || raw === undefined) draft[field.key] = ''
    else draft[field.key] = String(raw)
  }
  return draft
}

function draftToValues(fields: HierarchyField[], draft: Draft): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = draft[field.key] ?? ''
    if (field.kind === 'lines') {
      values[field.key] = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    } else if (field.kind === 'checkbox') {
      values[field.key] = raw === 'true'
    } else if (field.kind === 'number') {
      values[field.key] = raw.trim() === '' ? null : Number(raw)
    } else {
      values[field.key] = raw.trim()
    }
  }
  return values
}

/* --------------------------------- component -------------------------------- */

export function HierarchyManager<TRow extends { id: string; name: string; is_archived: boolean }>({
  config,
}: {
  config: HierarchyConfig<TRow>
}) {
  const { toast } = useToast()
  const { role, loading: sessionLoading } = useAdminSession()

  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<TRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingArchive, setPendingArchive] = useState<TRow | null>(null)
  const [busy, setBusy] = useState(false)

  const mayView = can(role, 'academic.view')
  const mayManage = can(role, 'academic.manage')
  const open = creating || editing !== null

  const { data, loading, error, refetch } = useQuery(
    `admin:academic:${config.queryKey}:${showArchived}`,
    () => config.list(showArchived),
    { enabled: !sessionLoading && mayView },
  )

  const rows = data ?? []

  function closeForm() {
    setCreating(false)
    setEditing(null)
    setFormError(null)
  }

  function openCreate() {
    setDraft(seedDraft(config.fields, null))
    setFormError(null)
    setCreating(true)
  }

  function openEdit(row: TRow) {
    setDraft(seedDraft(config.fields, row))
    setFormError(null)
    setEditing(row)
  }

  async function save() {
    const values = draftToValues(config.fields, draft)

    for (const field of config.fields) {
      if (field.required && (draft[field.key] ?? '').trim() === '') {
        setFormError(`${field.label} is required.`)
        return
      }
    }

    const extra = config.validate?.(values) ?? null
    if (extra) {
      setFormError(extra)
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editing) await config.update(editing.id, values)
      else await config.create(values)
      toast({
        title: editing ? `${capitalize(config.entity)} updated` : `${capitalize(config.entity)} created`,
        variant: 'success',
      })
      closeForm()
      refetch()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'We could not save that change.'
      setFormError(message)
      toast({ title: 'Save failed', description: message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  async function applyArchive(archived: boolean) {
    if (!pendingArchive) return
    setBusy(true)
    try {
      await config.setArchived(pendingArchive.id, archived)
      toast({
        title: archived ? `${capitalize(config.entity)} archived` : `${capitalize(config.entity)} restored`,
        description: archived
          ? 'Students can no longer see it. Nothing was deleted.'
          : 'It is visible to students again.',
        variant: archived ? 'warning' : 'success',
      })
      setPendingArchive(null)
      refetch()
    } catch (caught) {
      toast({
        title: 'Could not update that row',
        description: caught instanceof Error ? caught.message : undefined,
        variant: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!sessionLoading && !mayView) {
    return (
      <Notice tone="warning" title="You don't have permission to view the academic hierarchy.">
        Ask a super admin to grant <code className="font-mono text-xs">academic.view</code> if you
        believe this is a mistake.
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={refetch} disabled={loading}>
              <RotateCcw className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Refresh</span>
            </Button>
            {mayManage && (
              <Button onClick={openCreate} icon={<Plus className="size-4" aria-hidden="true" />}>
                New {config.entity}
              </Button>
            )}
          </div>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted" aria-live="polite">
          {loading ? 'Loading…' : `${rows.length.toLocaleString('en-IN')} ${config.title.toLowerCase()}`}
        </p>
        <Checkbox
          checked={showArchived}
          onChange={setShowArchived}
          label="Show archived"
          description="Archived rows stay in the database, hidden from students."
        />
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title={`We could not load ${config.title.toLowerCase()}.`} description={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${config.title.toLowerCase()} yet`}
          description={
            showArchived
              ? 'Nothing has been archived at this level.'
              : `Create the first ${config.entity} to start building the hierarchy.`
          }
          action={
            mayManage ? (
              <Button onClick={openCreate} icon={<Plus className="size-4" aria-hidden="true" />}>
                New {config.entity}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          caption={config.title}
          columns={config.columns}
          rows={rows}
          rowKey={(row) => row.id}
          renderActions={
            mayManage
              ? (row) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      <span className="sr-only">Edit</span>
                      <span className="ml-1 hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (row.is_archived ? void applyArchive(false) : setPendingArchive(row))}
                    >
                      {row.is_archived ? (
                        <ArchiveRestore className="size-4" aria-hidden="true" />
                      ) : (
                        <Archive className="size-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">{row.is_archived ? 'Restore' : 'Archive'}</span>
                      <span className="ml-1 hidden sm:inline">{row.is_archived ? 'Restore' : 'Archive'}</span>
                    </Button>
                  </div>
                )
              : undefined
          }
          empty={<p className="px-4 py-6 text-center text-sm text-muted">Nothing to show.</p>}
          loading={loading}
        />
      )}

      {/* --------------------------------------------------------- form */}
      <Modal
        open={open}
        onClose={closeForm}
        title={editing ? `Edit ${config.entity}` : `New ${config.entity}`}
        description={
          editing
            ? `Update this ${config.entity}. Changes are recorded in the audit log.`
            : `Add a ${config.entity} to the academic hierarchy.`
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? 'Save changes' : `Create ${config.entity}`}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {config.fields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={draft[field.key] ?? ''}
              error={formError}
              onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
        </div>

        {formError && (
          <div className="mt-4">
            <Notice tone="danger">{formError}</Notice>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------- archive */}
      <ConfirmDialog
        open={pendingArchive !== null}
        title={`Archive this ${config.entity}?`}
        tone="danger"
        confirmLabel="Archive"
        loading={busy}
        description={
          <>
            <p>
              <span className="font-medium text-foreground">{pendingArchive?.name}</span> will be hidden
              from students and from every pick-list in this portal.
            </p>
            <p className="mt-2">
              Nothing is deleted — related content is kept, and you can restore it from this screen at
              any time.
            </p>
          </>
        }
        onConfirm={() => void applyArchive(true)}
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  )
}

/* --------------------------------- fields ---------------------------------- */

function FormField({
  field,
  value,
  onChange,
  error,
}: {
  field: HierarchyField
  value: string
  onChange: (value: string) => void
  error: string | null
}) {
  /* Render the live error only while this field is the offending one. */
  const showError = error !== null && field.required && value.trim() === ''
  const className = field.wide ? 'sm:col-span-2' : undefined

  switch (field.kind) {
    case 'textarea':
    case 'lines':
      return (
        <div className={className}>
          <Textarea
            label={field.label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={field.kind === 'lines' ? 4 : 3}
            placeholder={field.placeholder}
            aria-invalid={showError || undefined}
          />
          <FieldNote field={field} error={showError ? error : null} />
        </div>
      )
    case 'number':
      return (
        <Input
          label={field.label}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          hint={showError ? error : field.hint}
          error={showError ? error : undefined}
          className={className}
        />
      )
    case 'select':
      return (
        <Select
          label={field.label}
          value={value}
          onChange={onChange}
          options={field.options ?? []}
          placeholder={field.placeholder}
          className={className}
          id={`field-${field.key}`}
        />
      )
    case 'checkbox':
      return (
        <div className={className}>
          <Checkbox
            checked={value === 'true'}
            onChange={(checked) => onChange(checked ? 'true' : 'false')}
            label={field.label}
            description={field.hint}
          />
        </div>
      )
    default:
      return (
        <Input
          label={field.label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          hint={showError ? error : field.hint}
          error={showError ? error : undefined}
          className={className}
        />
      )
  }
}

function FieldNote({ field, error }: { field: HierarchyField; error: string | null }) {
  const text: ReactNode = error ?? field.hint
  if (!text) return null
  return <p className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-muted'}`}>{text}</p>
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Status cell shared by every hierarchy table. */
export function ArchivedBadge({ archived }: { archived: boolean }) {
  return archived ? (
    <Badge variant="neutral">Archived</Badge>
  ) : (
    <Badge variant="success">Active</Badge>
  )
}
