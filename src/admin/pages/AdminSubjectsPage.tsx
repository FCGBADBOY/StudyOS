/**
 * Admin → Academic → Subjects.
 *
 * A subject hangs off a class, and optionally off a board and a stream — that
 * combination is what lets one database serve CBSE Class 12 Science *and*
 * a state board's Class 10 without schema changes. The selects below stay in
 * step with each other: choosing a class narrows the boards and streams that
 * make sense for it, and everything is validated before the write leaves.
 */
import { ArchivedBadge, HierarchyManager, type HierarchyConfig } from '../components/HierarchyManager'
import type { Column } from '../components/DataTable'
import { useQuery } from '@/hooks/useQuery'
import {
  createSubject,
  listBoards,
  listClasses,
  listStreams,
  listSubjects,
  setSubjectArchived,
  updateSubject,
} from '../services/adminAcademic.service'
import type { AdminBoardRow, AdminClassRow, AdminStreamRow, AdminSubjectRow } from '../types/admin'

export default function AdminSubjectsPage() {
  /* Lookups — loaded once, then offered as choices in the form. */
  const { data: classes } = useQuery<AdminClassRow[]>('admin:academic:lookup:classes', () => listClasses(true))
  const { data: boards } = useQuery<AdminBoardRow[]>('admin:academic:lookup:boards', () => listBoards(true))
  const { data: streams } = useQuery<AdminStreamRow[]>('admin:academic:lookup:streams', () => listStreams(true))

  const className = (id: string | null) => (id && classes?.find((row) => row.id === id)?.name) || '—'
  const boardName = (id: string | null) => (id && boards?.find((row) => row.id === id)?.name) || '—'
  const streamName = (id: string | null) => (id && streams?.find((row) => row.id === id)?.name) || '—'

  const columns: Column<AdminSubjectRow>[] = [
    {
      key: 'name',
      header: 'Subject',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          {row.code && <p className="truncate font-mono text-xs text-muted">{row.code}</p>}
        </div>
      ),
    },
    { key: 'class_id', header: 'Class', render: (row) => <span className="text-sm text-muted">{className(row.class_id)}</span> },
    { key: 'board_id', header: 'Board', hideBelow: 'md', render: (row) => <span className="text-sm text-muted">{boardName(row.board_id)}</span> },
    { key: 'stream_id', header: 'Stream', hideBelow: 'md', render: (row) => <span className="text-sm text-muted">{streamName(row.stream_id)}</span> },
    {
      key: 'display_order',
      header: 'Order',
      align: 'right',
      sortable: true,
      render: (row) => <span className="tabular text-sm text-muted">{row.display_order}</span>,
    },
    { key: 'is_archived', header: 'Status', render: (row) => <ArchivedBadge archived={row.is_archived} /> },
  ]

  const config: HierarchyConfig<AdminSubjectRow> = {
    title: 'Subjects',
    subtitle: 'Subjects belong to a class, and optionally to a board and stream.',
    entity: 'subject',
    queryKey: 'subjects',
    columns,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'Physics' },
      { key: 'code', label: 'Code', kind: 'text', placeholder: '042', hint: 'Optional board code for this subject.' },
      {
        key: 'class_id',
        label: 'Class',
        kind: 'select',
        required: true,
        placeholder: 'Choose a class…',
        options: (classes ?? []).map((row) => ({ id: row.id, label: row.name })),
      },
      {
        key: 'board_id',
        label: 'Board',
        kind: 'select',
        placeholder: 'Any board',
        options: [{ id: '', label: 'Any board' }, ...(boards ?? []).map((row) => ({ id: row.id, label: row.name }))],
      },
      {
        key: 'stream_id',
        label: 'Stream',
        kind: 'select',
        placeholder: 'No stream',
        hint: 'Leave as "No stream" for foundation classes.',
        options: [{ id: '', label: 'No stream' }, ...(streams ?? []).map((row) => ({ id: row.id, label: row.name }))],
      },
      {
        key: 'description',
        label: 'Description',
        kind: 'textarea',
        wide: true,
        placeholder: 'What this subject covers in one line.',
      },
      {
        key: 'display_order',
        label: 'Display order',
        kind: 'number',
        required: true,
        defaultValue: '1',
        hint: 'Lower numbers appear first in the subject grid.',
      },
    ],
    list: listSubjects,
    create: (values) =>
      createSubject({
        name: values.name as string,
        code: (values.code as string) || undefined,
        class_id: values.class_id as string,
        board_id: (values.board_id as string) || null,
        stream_id: (values.stream_id as string) || null,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
      }),
    update: (id, values) =>
      updateSubject(id, {
        name: values.name as string,
        code: (values.code as string) || undefined,
        class_id: values.class_id as string,
        board_id: (values.board_id as string) || null,
        stream_id: (values.stream_id as string) || null,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
      }),
    setArchived: setSubjectArchived,
    validate: (values) => {
      if (!values.class_id) return 'Choose a class — every subject belongs to one.'
      const order = Number(values.display_order)
      if (!Number.isInteger(order) || order < 0) return 'Display order must be a whole number of 0 or more.'
      return null
    },
  }

  return <HierarchyManager config={config} />
}
