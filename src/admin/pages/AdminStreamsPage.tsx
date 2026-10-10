/**
 * Admin → Academic → Streams.
 *
 * Streams exist for senior classes only (Science / Commerce / Humanities).
 * They are shared across boards and classes rather than nested under either,
 * so the same stream can serve Class 11 and Class 12 without duplication —
 * subjects simply point at the stream they belong to.
 */
import { ArchivedBadge, HierarchyManager, type HierarchyConfig } from '../components/HierarchyManager'
import type { Column } from '../components/DataTable'
import {
  createStream,
  listStreams,
  setStreamArchived,
  updateStream,
} from '../services/adminAcademic.service'
import type { AdminStreamRow } from '../types/admin'

const COLUMNS: Column<AdminStreamRow>[] = [
  {
    key: 'name',
    header: 'Stream',
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
    key: 'display_order',
    header: 'Order',
    align: 'right',
    sortable: true,
    render: (row) => <span className="tabular text-sm text-muted">{row.display_order}</span>,
  },
  { key: 'is_archived', header: 'Status', render: (row) => <ArchivedBadge archived={row.is_archived} /> },
]

export default function AdminStreamsPage() {
  const config: HierarchyConfig<AdminStreamRow> = {
    title: 'Streams',
    subtitle: 'Streams split senior classes into subject combinations — Science, Commerce, Humanities.',
    entity: 'stream',
    queryKey: 'streams',
    columns: COLUMNS,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'Science' },
      {
        key: 'description',
        label: 'Description',
        kind: 'textarea',
        wide: true,
        placeholder: 'Which subjects a student following this stream will see.',
      },
      {
        key: 'display_order',
        label: 'Display order',
        kind: 'number',
        required: true,
        defaultValue: '1',
        hint: 'Lower numbers appear first in the stream picker.',
      },
    ],
    list: listStreams,
    create: (values) =>
      createStream({
        name: values.name as string,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
      }),
    update: (id, values) =>
      updateStream(id, {
        name: values.name as string,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
      }),
    setArchived: setStreamArchived,
    validate: (values) => {
      const order = Number(values.display_order)
      if (!Number.isInteger(order) || order < 0) return 'Display order must be a whole number of 0 or more.'
      return null
    },
  }

  return <HierarchyManager config={config} />
}
