/**
 * Admin → Academic → Boards.
 *
 * The top of the hierarchy: a board (CBSE, ICSE, a state board…) owns classes,
 * which own subjects. Because everything below inherits from here, archiving a
 * board is the one action that can hide a whole curriculum — so it is guarded
 * by a confirmation that spells out the consequence, and it never deletes.
 */
import { ArchivedBadge, HierarchyManager, type HierarchyConfig } from '../components/HierarchyManager'
import type { Column } from '../components/DataTable'
import {
  createBoard,
  listBoards,
  setBoardArchived,
  updateBoard,
} from '../services/adminAcademic.service'
import type { AdminBoardRow } from '../types/admin'

const COLUMNS: Column<AdminBoardRow>[] = [
  {
    key: 'name',
    header: 'Board',
    sortable: true,
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{row.name}</p>
        {row.short_name && <p className="truncate text-xs text-muted">{row.short_name}</p>}
      </div>
    ),
  },
  {
    key: 'slug',
    header: 'Slug',
    hideBelow: 'md',
    render: (row) => <code className="font-mono text-xs text-muted">{row.slug}</code>,
  },
  {
    key: 'description',
    header: 'Description',
    hideBelow: 'lg',
    render: (row) => (
      <p className="line-clamp-2 max-w-md text-sm text-muted">{row.description || '—'}</p>
    ),
  },
  {
    key: 'display_order',
    header: 'Order',
    align: 'right',
    sortable: true,
    render: (row) => <span className="tabular text-sm text-muted">{row.display_order}</span>,
  },
  {
    key: 'is_archived',
    header: 'Status',
    render: (row) => <ArchivedBadge archived={row.is_archived} />,
  },
]

export default function AdminBoardsPage() {
  const config: HierarchyConfig<AdminBoardRow> = {
    title: 'Boards',
    subtitle: 'Exam boards sit at the top of the hierarchy — classes and subjects inherit from them.',
    entity: 'board',
    queryKey: 'boards',
    columns: COLUMNS,
    fields: [
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        required: true,
        placeholder: 'Central Board of Secondary Education',
        hint: 'The slug is generated from this name.',
      },
      {
        key: 'short_name',
        label: 'Short name',
        kind: 'text',
        placeholder: 'CBSE',
        hint: 'Shown in tight spaces, e.g. filter chips.',
      },
      { key: 'description', label: 'Description', kind: 'textarea', wide: true, placeholder: 'Who this board is for.' },
      {
        key: 'display_order',
        label: 'Display order',
        kind: 'number',
        required: true,
        defaultValue: '1',
        hint: 'Lower numbers appear first for students.',
      },
    ],
    list: listBoards,
    create: (values) =>
      createBoard({
        name: values.name as string,
        short_name: (values.short_name as string) || undefined,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
      }),
    update: (id, values) =>
      updateBoard(id, {
        name: values.name as string,
        short_name: (values.short_name as string) || undefined,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
      }),
    setArchived: setBoardArchived,
    validate: (values) => {
      const order = Number(values.display_order)
      if (!Number.isInteger(order) || order < 0) return 'Display order must be a whole number of 0 or more.'
      return null
    },
  }

  return <HierarchyManager config={config} />
}
