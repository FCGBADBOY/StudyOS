/**
 * Admin → PYQs: the archive browser.
 *
 * Every previous-year question lives here regardless of subject, class or
 * board, which is what makes cross-cutting work possible — spotting a repeat
 * question across years, or finding the subjects with no archive at all.
 *
 * Filtering is server-side (the service applies the predicates before the
 * rows leave PostgreSQL) and paginated, so this screen stays fast no matter how
 * large the archive grows.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileQuestion, Plus, RefreshCw, Search, Sparkles, Upload } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  SkeletonCard,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { Pagination } from '../components/DataTable'
import { ConfirmDialog } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import { archiveQuestion, listQuestions, PYQ_PAGE_SIZE, type PyqFilter } from '../services/adminPyq.service'
import { listSubjects } from '../services/adminAcademic.service'
import type { AdminPyqRow, AdminSubjectRow } from '../types/admin'

/** Question types rendered as compact, consistently coloured chips. */
const TYPE_BADGE: Record<AdminPyqRow['question_type'], { label: string; tone: 'neutral' | 'accent' | 'outline' }> = {
  MCQ: { label: 'MCQ', tone: 'accent' },
  assertion_reason: { label: 'Assertion–Reason', tone: 'neutral' },
  short_answer: { label: 'Short answer', tone: 'outline' },
  long_answer: { label: 'Long answer', tone: 'outline' },
  numerical: { label: 'Numerical', tone: 'accent' },
  case_study: { label: 'Case study', tone: 'neutral' },
  other: { label: 'Other', tone: 'outline' },
}

export default function AdminPyqPage() {
  const { toast } = useToast()
  const { role } = useAdminSession()

  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<PyqFilter>({})
  const [search, setSearch] = useState('')
  const [pendingArchive, setPendingArchive] = useState<AdminPyqRow | null>(null)
  const [archiving, setArchiving] = useState(false)

  const { data: subjects } = useQuery<AdminSubjectRow[]>('admin:pyq:subjects', () => listSubjects(true))

  const query = useMemo<PyqFilter>(
    () => ({ ...filter, search: search.trim() || undefined }),
    [filter, search],
  )

  const { data, loading, error, refetch } = useQuery(
    `admin:pyq:list:${JSON.stringify(query)}:${page}`,
    () => listQuestions(query, page, PYQ_PAGE_SIZE),
  )

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const subjectName = (id: string | null) =>
    (id && subjects?.find((subject) => subject.id === id)?.name) || '—'

  function clearFilters() {
    setFilter({})
    setSearch('')
    setPage(1)
  }

  const hasFilters = search.trim() !== '' || Object.keys(filter).length > 0

  async function confirmArchive() {
    if (!pendingArchive) return
    setArchiving(true)
    try {
      await archiveQuestion(pendingArchive.id)
      toast({
        title: 'Question archived',
        description: 'It has been removed from the student archive and kept for reporting.',
        variant: 'success',
      })
      setPendingArchive(null)
      refetch()
    } catch (caught) {
      toast({
        title: 'Could not archive the question',
        description: caught instanceof Error ? caught.message : undefined,
        variant: 'danger',
      })
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Previous Year Questions"
        subtitle="Browse, edit and import the board exam archive."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={refetch}
              disabled={loading}
              icon={<RefreshCw className="size-4" aria-hidden="true" />}
            >
              <span className="sr-only sm:not-sr-only">Refresh</span>
            </Button>
            {can(role, 'pyq.import') && (
              <LinkButton
                to="/admin/content/pyq/import"
                variant="secondary"
                icon={<Upload className="size-4" aria-hidden="true" />}
              >
                Bulk import
              </LinkButton>
            )}
            {can(role, 'pyq.create') && (
              <LinkButton
                to="/admin/content/pyq/new"
                icon={<Plus className="size-4" aria-hidden="true" />}
              >
                New question
              </LinkButton>
            )}
          </div>
        }
      />

      {/* ------------------------------------------------------- filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <DebouncedSearch
              value={search}
              onCommit={(value) => {
                setSearch(value)
                setPage(1)
              }}
              placeholder="Search question text…"
              label="Search questions"
            />
          </div>

          <Select
            label="Subject"
            value={filter.subjectId ?? 'all'}
            onChange={(value) => {
              setFilter((current) => ({ ...current, subjectId: value }))
              setPage(1)
            }}
            options={[
              { id: 'all', label: 'All subjects' },
              ...(subjects ?? []).map((subject) => ({ id: subject.id, label: subject.name })),
            ]}
          />

          <Select
            label="Question type"
            value={filter.questionType ?? 'all'}
            onChange={(value) => {
              setFilter((current) => ({ ...current, questionType: value }))
              setPage(1)
            }}
            options={[
              { id: 'all', label: 'All types' },
              { id: 'MCQ', label: 'MCQ' },
              { id: 'assertion_reason', label: 'Assertion–Reason' },
              { id: 'short_answer', label: 'Short answer' },
              { id: 'long_answer', label: 'Long answer' },
              { id: 'numerical', label: 'Numerical' },
              { id: 'case_study', label: 'Case study' },
              { id: 'other', label: 'Other' },
            ]}
          />

          <Select
            label="Difficulty"
            value={filter.difficulty ?? 'all'}
            onChange={(value) => {
              setFilter((current) => ({ ...current, difficulty: value }))
              setPage(1)
            }}
            options={[
              { id: 'all', label: 'Any difficulty' },
              { id: 'easy', label: 'Easy' },
              { id: 'moderate', label: 'Moderate' },
              { id: 'hard', label: 'Hard' },
            ]}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {loading
              ? 'Loading questions…'
              : `${total.toLocaleString('en-IN')} question${total === 1 ? '' : 's'} match`}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {/* --------------------------------------------------------- list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="We could not load the questions." description={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileQuestion className="size-6" aria-hidden="true" />}
          title={hasFilters ? 'No questions match those filters' : 'No questions yet'}
          description={
            hasFilters
              ? 'Try widening the search, or clearing the filters.'
              : 'Import a CSV export, or add the first question by hand.'
          }
          action={
            can(role, 'pyq.import') ? (
              <LinkButton to="/admin/content/pyq/import" variant="secondary">
                Bulk import
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((question) => (
            <li key={question.id}>
              <Card className="p-4 transition-colors hover:bg-surface-muted/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={TYPE_BADGE[question.question_type].tone}>
                        {TYPE_BADGE[question.question_type].label}
                      </Badge>
                      <Badge variant="neutral">{question.year}</Badge>
                      <Badge variant="outline">{question.exam_type}</Badge>
                      <Badge variant="outline">{question.marks} marks</Badge>
                      <Badge
                        variant={
                          question.difficulty === 'hard'
                            ? 'danger'
                            : question.difficulty === 'moderate'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {question.difficulty}
                      </Badge>
                      {question.is_important && (
                        <Badge variant="accent">
                          <Sparkles className="mr-1 inline size-3" aria-hidden="true" />
                          Important
                        </Badge>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-3 text-sm text-foreground">{question.question_text}</p>

                    <p className="mt-2 text-xs text-muted">
                      {subjectName(question.subject_id)}
                      {question.source ? ` · ${question.source}` : ''}
                      {question.paper_set ? ` · ${question.paper_set}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {can(role, 'pyq.edit') && (
                      <LinkButton to={`/admin/content/pyq/${question.id}`} variant="outline" size="sm">
                        Edit
                      </LinkButton>
                    )}
                    {can(role, 'pyq.archive') && (
                      <Button variant="ghost" size="sm" onClick={() => setPendingArchive(question)}>
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!loading && total > PYQ_PAGE_SIZE && (
        <Pagination page={page} pageSize={PYQ_PAGE_SIZE} total={total} onPageChange={setPage} />
      )}

      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive this question?"
        description={
          <>
            <p>
              <span className="font-medium text-foreground">
                {pendingArchive?.year} · {subjectName(pendingArchive?.subject_id ?? null)}
              </span>
            </p>
            <p className="mt-2">
              It will disappear from the student archive immediately. Reporting keeps working, and the
              question is never permanently deleted.
            </p>
          </>
        }
        tone="danger"
        confirmLabel="Archive question"
        loading={archiving}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  )
}

/**
 * Debounced text input.
 *
 * Typing must not fire a query per keystroke, but the field has to stay
 * responsive — so the value is held locally and the parent is only told once
 * the admin has paused for 300ms. The pending timer is cancelled on unmount so
 * we never call a setter on a dead component.
 */
function DebouncedSearch({
  value,
  onCommit,
  label,
  placeholder,
}: {
  value: string
  onCommit: (value: string) => void
  label: string
  placeholder: string
}) {
  const [draft, setDraft] = useState(value)

  /* Adopt an external reset (e.g. "Clear filters") without echoing back. */
  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (draft === value) return
    const timer = window.setTimeout(() => onCommit(draft), 300)
    return () => window.clearTimeout(timer)
  }, [draft, value, onCommit])

  return (
    <Input
      type="search"
      label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      icon={<Search className="size-4" aria-hidden="true" />}
    />
  )
}
