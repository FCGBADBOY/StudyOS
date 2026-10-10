/**
 * Admin → Content: the shared resource filter bar.
 *
 * Search is debounced (300 ms) so `listResources` is not fired on every
 * keystroke, and each select patches only the field it owns on the parent's
 * `ResourceFilter` — switching the status tab, for example, never drops the
 * subject the admin had already chosen.
 *
 * NOTE — the kit `SearchBar` is a click-to-open *trigger* (it exposes no
 * value or onChange, see `src/components/ui/SearchBar.tsx`), so a filter that
 * must accept typed text uses a controlled `Input` wearing the same styling.
 */
import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button, Card, Input, Select } from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import {
  RESOURCE_STATUSES,
  RESOURCE_STATUS_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
} from '../types/admin'
import type {
  AdminBoardRow,
  AdminClassRow,
  AdminSubjectRow,
  ResourceStatus,
  ResourceType,
} from '../types/admin'
import type { ResourceFilter } from '../services/adminContent.service'

/** Sentinel used by every select; stored as `undefined` on the filter. */
const ALL = 'all'

export interface ResourceFiltersProps {
  value: ResourceFilter
  onChange: (next: ResourceFilter) => void
  subjects: AdminSubjectRow[]
  boards: AdminBoardRow[]
  classes: AdminClassRow[]
}

function isActive(value: ResourceFilter): boolean {
  return Boolean(
    value.search?.trim() ||
      (value.status && value.status !== ALL) ||
      (value.resourceType && value.resourceType !== ALL) ||
      (value.subjectId && value.subjectId !== ALL) ||
      (value.boardId && value.boardId !== ALL) ||
      (value.classId && value.classId !== ALL),
  )
}

export function ResourceFilters({ value, onChange, subjects, boards, classes }: ResourceFiltersProps) {
  const [search, setSearch] = useState(value.search ?? '')

  /* Debounced push of the search box — nothing reaches `listResources`
     until the admin stops typing for 300 ms. */
  useEffect(() => {
    const next = search.trim()
    const current = value.search ?? ''
    if (next === current) return
    const timer = window.setTimeout(() => {
      onChange({ ...value, search: next || undefined })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, value, onChange])

  /* Follow the parent when the query changes from the outside — including
     the "Clear filters" button, which must empty this box as well. */
  useEffect(() => {
    const incoming = value.search ?? ''
    if (incoming === search.trim()) return
    setSearch(incoming)
  }, [value.search])

  function patch(next: Partial<ResourceFilter>) {
    onChange({ ...value, ...next })
  }

  const statusOptions: SelectOption[] = [
    { id: ALL, label: 'All statuses' },
    ...RESOURCE_STATUSES.map((status) => ({ id: status, label: RESOURCE_STATUS_LABELS[status] })),
  ]

  const typeOptions: SelectOption[] = [
    { id: ALL, label: 'All types' },
    ...RESOURCE_TYPES.map((type) => ({ id: type, label: RESOURCE_TYPE_LABELS[type] })),
  ]

  const subjectOptions: SelectOption[] = [
    { id: ALL, label: 'All subjects' },
    ...subjects.map((subject) => ({ id: subject.id, label: subject.name })),
  ]

  const boardOptions: SelectOption[] = [
    { id: ALL, label: 'All boards' },
    ...boards.map((board) => ({ id: board.id, label: board.name })),
  ]

  const classOptions: SelectOption[] = [
    { id: ALL, label: 'All classes' },
    ...classes.map((entry) => ({ id: entry.id, label: entry.name })),
  ]

  const active = isActive(value) || search.trim().length > 0

  return (
    <Card padded={false} className="p-4">
      <div className="space-y-4">
        <div className="sm:max-w-md">
          <Input
            label="Search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search resources..."
            icon={<Search />}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Status"
            options={statusOptions}
            value={value.status ?? ALL}
            onChange={(next) =>
              patch({ status: next === ALL ? undefined : (next as ResourceStatus) })
            }
            placeholder="All statuses"
          />

          <Select
            label="Resource type"
            options={typeOptions}
            value={value.resourceType ?? ALL}
            onChange={(next) =>
              patch({ resourceType: next === ALL ? undefined : (next as ResourceType) })
            }
            placeholder="All types"
          />

          <Select
            label="Subject"
            options={subjectOptions}
            value={value.subjectId ?? ALL}
            onChange={(next) => patch({ subjectId: next === ALL ? undefined : next })}
            placeholder="All subjects"
          />

          <Select
            label="Board"
            options={boardOptions}
            value={value.boardId ?? ALL}
            onChange={(next) => patch({ boardId: next === ALL ? undefined : next })}
            placeholder="All boards"
          />

          <Select
            label="Class"
            options={classOptions}
            value={value.classId ?? ALL}
            onChange={(next) => patch({ classId: next === ALL ? undefined : next })}
            placeholder="All classes"
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon={<X />}
            disabled={!active}
            onClick={() => {
              /* Drop any half-typed query the debounce has not pushed yet. */
              setSearch('')
              onChange({})
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  )
}
