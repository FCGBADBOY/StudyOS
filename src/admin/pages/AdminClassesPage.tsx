/**
 * Admin → Academic → Classes.
 *
 * A class (Class 11, Class 12) is what a student actually picks when they
 * first open the app, so the `senior` flag matters: it decides whether the
 * stream picker (Science / Commerce / Humanities) is shown to them.
 */
import { ArchivedBadge, HierarchyManager, type HierarchyConfig } from '../components/HierarchyManager'
import type { Column } from '../components/DataTable'
import {
  createClass,
  listClasses,
  setClassArchived,
  updateClass,
} from '../services/adminAcademic.service'
import type { AdminClassRow } from '../types/admin'

const COLUMNS: Column<AdminClassRow>[] = [
  {
    key: 'name',
    header: 'Class',
    sortable: true,
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  { key: 'slug', header: 'Slug', hideBelow: 'md', render: (row) => <code className="font-mono text-xs text-muted">{row.slug}</code> },
  {
    key: 'description',
    header: 'Description',
    hideBelow: 'lg',
    render: (row) => <p className="line-clamp-2 max-w-md text-sm text-muted">{row.description || '—'}</p>,
  },
  {
    key: 'senior',
    header: 'Track',
    render: (row) => (row.senior ? <span className="text-sm text-muted">Senior (streams)</span> : <span className="text-sm text-muted">Foundation</span>),
  },
  {
    key: 'display_order',
    header: 'Order',
    align: 'right',
    sortable: true,
    render: (row) => <span className="tabular text-sm text-muted">{row.display_order}</span>,
  },
  { key: 'is_archived', header: 'Status', render: (row) => <ArchivedBadge archived={row.is_archived} /> },
]

export default function AdminClassesPage() {
  const config: HierarchyConfig<AdminClassRow> = {
    title: 'Classes',
    subtitle: 'Classes group subjects and set the curriculum year a student follows.',
    entity: 'class',
    queryKey: 'classes',
    columns: COLUMNS,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'Class 12' },
      {
        key: 'description',
        label: 'Description',
        kind: 'textarea',
        wide: true,
        placeholder: 'What students in this class are preparing for.',
      },
      {
        key: 'senior',
        label: 'Senior class',
        kind: 'checkbox',
        hint: 'Senior classes offer a stream picker (Science, Commerce, Humanities).',
      },
      {
        key: 'display_order',
        label: 'Display order',
        kind: 'number',
        required: true,
        defaultValue: '1',
        hint: 'Lower numbers appear first, e.g. Class 11 before Class 12.',
      },
    ],
    list: listClasses,
    create: (values) =>
      createClass({
        name: values.name as string,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
        senior: values.senior === true,
      }),
    update: (id, values) =>
      updateClass(id, {
        name: values.name as string,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
        senior: values.senior === true,
      }),
    setArchived: setClassArchived,
    validate: (values) => {
      const order = Number(values.display_order)
      if (!Number.isInteger(order) || order < 0) return 'Display order must be a whole number of 0 or more.'
      return null
    },
  }

  return <HierarchyManager config={config} />
}
