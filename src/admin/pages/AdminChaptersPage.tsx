/**
 * Admin → Academic → Chapters.
 *
 * Chapters are the leaf of the hierarchy and the unit students actually work
 * through — resources and PYQs both attach here, which is what makes the
 * content architecture retrievable later: every artefact resolves to
 * board → class → subject → chapter through foreign keys alone.
 *
 * Topics are stored as a text array. The form shows them one per line, because
 * that is how an editor thinks about a syllabus, and the component converts.
 */
import { ArchivedBadge, HierarchyManager, type HierarchyConfig } from '../components/HierarchyManager'
import type { Column } from '../components/DataTable'
import { useQuery } from '@/hooks/useQuery'
import {
  createChapter,
  listChapters,
  listSubjects,
  setChapterArchived,
  updateChapter,
} from '../services/adminAcademic.service'
import type { AdminChapterRow, AdminSubjectRow } from '../types/admin'

const DIFFICULTY_OPTIONS = [
  { id: '', label: 'Not set' },
  { id: 'easy', label: 'Easy' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'hard', label: 'Hard' },
]

export default function AdminChaptersPage() {
  const { data: subjects } = useQuery<AdminSubjectRow[]>('admin:academic:lookup:subjects-for-chapters', () =>
    listSubjects(true),
  )

  const subjectName = (id: string) => subjects?.find((row) => row.id === id)?.name || '—'

  const columns: Column<AdminChapterRow>[] = [
    {
      key: 'name',
      header: 'Chapter',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.name}</p>
          {row.topics.length > 0 && (
            <p className="truncate text-xs text-muted">{row.topics.slice(0, 3).join(' · ')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'chapter_number',
      header: 'No.',
      align: 'right',
      sortable: true,
      render: (row) => <span className="tabular text-sm text-muted">{row.chapter_number}</span>,
    },
    {
      key: 'subject_id',
      header: 'Subject',
      render: (row) => <span className="text-sm text-muted">{subjectName(row.subject_id)}</span>,
    },
    {
      key: 'difficulty',
      header: 'Difficulty',
      hideBelow: 'md',
      render: (row) => <span className="text-sm text-muted">{row.difficulty || '—'}</span>,
    },
    {
      key: 'estimated_minutes',
      header: 'Est. time',
      hideBelow: 'lg',
      align: 'right',
      render: (row) => (
        <span className="tabular text-sm text-muted">{row.estimated_minutes ? `${row.estimated_minutes} min` : '—'}</span>
      ),
    },
    { key: 'is_archived', header: 'Status', render: (row) => <ArchivedBadge archived={row.is_archived} /> },
  ]

  const config: HierarchyConfig<AdminChapterRow> = {
    title: 'Chapters',
    subtitle: 'Chapters are where resources and questions attach — the unit students work through.',
    entity: 'chapter',
    queryKey: 'chapters',
    columns,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: "Electric Charges and Fields" },
      {
        key: 'chapter_number',
        label: 'Chapter number',
        kind: 'number',
        required: true,
        defaultValue: '1',
        hint: 'Position within the syllabus, e.g. 1 for the first chapter.',
      },
      {
        key: 'subject_id',
        label: 'Subject',
        kind: 'select',
        required: true,
        placeholder: 'Choose a subject…',
        options: (subjects ?? []).map((row) => ({ id: row.id, label: row.name })),
      },
      {
        key: 'description',
        label: 'Description',
        kind: 'textarea',
        wide: true,
        placeholder: 'One line on what this chapter teaches.',
      },
      { key: 'difficulty', label: 'Difficulty', kind: 'select', options: DIFFICULTY_OPTIONS },
      {
        key: 'estimated_minutes',
        label: 'Estimated minutes',
        kind: 'number',
        hint: 'Rough study time for an average student.',
      },
      {
        key: 'topics',
        label: 'Topics',
        kind: 'lines',
        wide: true,
        placeholder: "Coulomb's law\nGauss's law\nElectric potential",
        hint: 'One topic per line. Used for search and later for retrieval.',
      },
      {
        key: 'display_order',
        label: 'Display order',
        kind: 'number',
        required: true,
        defaultValue: '1',
        hint: 'Lower numbers appear first in the chapter list.',
      },
    ],
    list: listChapters,
    create: (values) =>
      createChapter({
        name: values.name as string,
        chapter_number: Number(values.chapter_number) || 1,
        subject_id: values.subject_id as string,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
        difficulty: (values.difficulty as string) || null,
        estimated_minutes: values.estimated_minutes === null ? null : Number(values.estimated_minutes),
        topics: (values.topics as string[]) ?? [],
      }),
    update: (id, values) =>
      updateChapter(id, {
        name: values.name as string,
        chapter_number: Number(values.chapter_number) || 1,
        subject_id: values.subject_id as string,
        description: (values.description as string) || undefined,
        display_order: Number(values.display_order) || 0,
        difficulty: (values.difficulty as string) || null,
        estimated_minutes: values.estimated_minutes === null ? null : Number(values.estimated_minutes),
        topics: (values.topics as string[]) ?? [],
      }),
    setArchived: setChapterArchived,
    validate: (values) => {
      if (!values.subject_id) return 'Choose a subject — every chapter belongs to one.'
      const number = Number(values.chapter_number)
      if (!Number.isInteger(number) || number < 1) return 'Chapter number must be a whole number of 1 or more.'
      const order = Number(values.display_order)
      if (!Number.isInteger(order) || order < 0) return 'Display order must be a whole number of 0 or more.'
      if (values.estimated_minutes !== null) {
        const minutes = Number(values.estimated_minutes)
        if (!Number.isFinite(minutes) || minutes < 0) return 'Estimated minutes must be 0 or more.'
      }
      return null
    },
  }

  return <HierarchyManager config={config} />
}
