/**
 * Admin → PYQ editor: create and edit a single previous-year question.
 *
 * Two things this screen is careful about:
 *
 *   1. Equations. Question text is plain text rendered as text — never HTML.
 *      A `$$…$$` span is shown in a monospace "formula" style so an editor can
 *      see where a maths expression sits, but it is *displayed*, not executed
 *      or parsed into markup. Nothing from this field is ever injected with
 *      `dangerouslySetInnerHTML`, so a question containing `<script>` is just a
 *      question containing some characters.
 *
 *   2. Hierarchy integrity. Board and class are required and independent, but
 *      the subject list is filtered to the chosen class and the chapter list to
 *      the chosen subject — so it is impossible to accidentally attach a
 *      Physics chapter to a Chemistry question.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import {
  Button,
  Card,
  Checkbox,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import {
  createQuestion,
  getQuestion,
  updateQuestion,
  type PyqDraft,
} from '../services/adminPyq.service'
import { listBoards, listChapters, listClasses, listSubjects } from '../services/adminAcademic.service'
import type {
  AdminBoardRow,
  AdminChapterRow,
  AdminClassRow,
  AdminSubjectRow,
  PyqQuestionType,
} from '../types/admin'

const QUESTION_TYPES: { value: PyqQuestionType; label: string }[] = [
  { value: 'MCQ', label: 'Multiple choice (MCQ)' },
  { value: 'assertion_reason', label: 'Assertion–Reason' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'long_answer', label: 'Long answer' },
  { value: 'numerical', label: 'Numerical' },
  { value: 'case_study', label: 'Case study' },
  { value: 'other', label: 'Other' },
]

/** The draft as the form holds it — ids are strings, numbers are strings too. */
interface FormState {
  board_id: string
  class_id: string
  subject_id: string
  chapter_id: string
  year: string
  exam_type: string
  question_text: string
  question_type: PyqQuestionType
  paper_set: string
  marks: string
  difficulty: 'easy' | 'moderate' | 'hard'
  source: string
  is_important: boolean
}

const EMPTY_FORM: FormState = {
  board_id: '',
  class_id: '',
  subject_id: '',
  chapter_id: '',
  year: String(new Date().getFullYear()),
  exam_type: 'board',
  question_text: '',
  question_type: 'short_answer',
  paper_set: 'Set 1',
  marks: '1',
  difficulty: 'moderate',
  source: '',
  is_important: false,
}

export default function AdminPyqFormPage() {
  const { id } = useParams<{ id: string }>()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { role } = useAdminSession()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Hierarchy — loaded once, then filtered client-side for the dependent selects. */
  const { data: boards } = useQuery<AdminBoardRow[]>('admin:pyqform:boards', () => listBoards(false))
  const { data: classes } = useQuery<AdminClassRow[]>('admin:pyqform:classes', () => listClasses(false))
  const { data: subjects } = useQuery<AdminSubjectRow[]>('admin:pyqform:subjects', () => listSubjects(false))
  const { data: chapters } = useQuery<AdminChapterRow[]>('admin:pyqform:chapters', () => listChapters(false))

  const { data: existing, loading, error: loadError, refetch } = useQuery(
    editing ? `admin:pyqform:load:${id}` : null,
    () => getQuestion(id!),
  )

  /* Seed the form from the loaded question exactly once. */
  useEffect(() => {
    if (!existing) return
    setForm({
      board_id: existing.board_id,
      class_id: existing.class_id,
      subject_id: existing.subject_id ?? '',
      chapter_id: existing.chapter_id ?? '',
      year: String(existing.year),
      exam_type: existing.exam_type,
      question_text: existing.question_text,
      question_type: existing.question_type,
      paper_set: existing.paper_set,
      marks: String(existing.marks),
      difficulty: existing.difficulty,
      source: existing.source ?? '',
      is_important: existing.is_important,
    })
  }, [existing])

  /* Dependent dropdowns — subjects follow the class, chapters follow the subject. */
  const visibleSubjects = useMemo(
    () => (form.class_id ? (subjects ?? []).filter((subject) => subject.class_id === form.class_id) : []),
    [subjects, form.class_id],
  )

  const visibleChapters = useMemo(
    () => (form.subject_id ? (chapters ?? []).filter((chapter) => chapter.subject_id === form.subject_id) : []),
    [chapters, form.subject_id],
  )

  const marks = Number(form.marks)
  const year = Number(form.year)

  const problems: string[] = []
  if (!form.board_id) problems.push('Board')
  if (!form.class_id) problems.push('Class')
  if (!form.question_text.trim()) problems.push('Question text')
  if (!Number.isInteger(year) || year < 1990 || year > 2100) problems.push('A year between 1990 and 2100')
  if (!Number.isFinite(marks) || marks <= 0) problems.push('Marks greater than zero')

  const valid = problems.length === 0
  const canPublish = can(role, 'content.publish')

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      /* Changing the class invalidates the subject, which invalidates the chapter. */
      if (key === 'class_id') {
        next.subject_id = ''
        next.chapter_id = ''
      }
      if (key === 'subject_id') next.chapter_id = ''
      return next
    })
  }

  function buildDraft(): PyqDraft {
    return {
      board_id: form.board_id,
      class_id: form.class_id,
      subject_id: form.subject_id || null,
      chapter_id: form.chapter_id || null,
      year,
      exam_type: form.exam_type.trim() || 'board',
      question_text: form.question_text.trim(),
      question_type: form.question_type,
      paper_set: form.paper_set.trim() || 'Set 1',
      marks,
      difficulty: form.difficulty,
      source: form.source.trim() || null,
      concepts: existing?.concepts ?? [],
      is_important: form.is_important,
    }
  }

  async function save(publishAfter: boolean) {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const draft = buildDraft()
      if (editing && id) {
        await updateQuestion(id, draft)
        toast({ title: 'Question saved', variant: 'success' })
      } else {
        const created = await createQuestion(draft)
        toast({ title: 'Question created', variant: 'success' })
        if (publishAfter) {
          navigate(`/admin/content/pyq/${created.id}`)
          return
        }
      }
      navigate('/admin/content/pyq')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'We could not save the question.'
      setError(message)
      toast({ title: 'Save failed', description: message, variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  if (editing && loading) {
    return (
      <div className="py-10">
        <LoadingState label="Loading question…" />
      </div>
    )
  }

  if (editing && loadError) {
    return (
      <ErrorState
        title="We could not load that question."
        description={loadError}
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back="/admin/content/pyq"
        title={editing ? 'Edit question' : 'New question'}
        subtitle={
          editing
            ? 'Update the wording, marks or classification.'
            : 'Add a single previous-year question to the archive.'
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {!valid && (
        <Notice tone="warning" title="Still needed">
          {problems.join(', ')}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------------ editor */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="space-y-4 p-5">
            <Textarea
              label="Question"
              value={form.question_text}
              onChange={(event) => patch('question_text', event.target.value)}
              rows={6}
              placeholder="State Gauss's law and derive the expression for the electric field due to an infinite plane sheet of charge."
            />
            <p className="mt-1.5 text-xs text-muted">
              Plain text. Write maths between $$…$$ — it is displayed as a formula, never rendered as HTML.
            </p>

            {/* Equation preview — shows how a $$…$$ span will read, as text. */}
            {/\$\$.+\$\$/.test(form.question_text) && (
              <div className="rounded-control border border-border bg-surface-sunken p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">Formula preview</p>
                <div className="mt-2 space-y-1.5 font-mono text-sm text-foreground">
                  {extractFormulae(form.question_text).map((formula, index) => (
                    <p key={index} className="break-words">
                      {formula}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Board"
                value={form.board_id}
                onChange={(value) => patch('board_id', value)}
                options={[
                  { id: '', label: 'Choose a board…' },
                  ...(boards ?? []).map((board) => ({ id: board.id, label: board.name })),
                ]}
              />

              <Select
                label="Class"
                value={form.class_id}
                onChange={(value) => patch('class_id', value)}
                options={[
                  { id: '', label: 'Choose a class…' },
                  ...(classes ?? []).map((entry) => ({ id: entry.id, label: entry.name })),
                ]}
              />

              <Select
                label="Subject"
                value={form.subject_id}
                onChange={(value) => patch('subject_id', value)}
                options={[
                  { id: '', label: 'Unassigned' },
                  ...visibleSubjects.map((subject) => ({ id: subject.id, label: subject.name })),
                ]}
                placeholder={form.class_id ? undefined : 'Choose a class first.'}
              />

              <Select
                label="Chapter"
                value={form.chapter_id}
                onChange={(value) => patch('chapter_id', value)}
                options={[
                  { id: '', label: 'Whole subject' },
                  ...visibleChapters.map((chapter) => ({ id: chapter.id, label: chapter.name })),
                ]}
                placeholder={form.subject_id ? undefined : 'Choose a subject first.'}
              />
            </div>
          </Card>

          <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Select
              label="Question type"
              value={form.question_type}
              onChange={(value) => patch('question_type', value as PyqQuestionType)}
              options={QUESTION_TYPES.map((type) => ({ id: type.value, label: type.label }))}
            />

            <Select
              label="Difficulty"
              value={form.difficulty}
              onChange={(value) => patch('difficulty', value as FormState['difficulty'])}
              options={[
                { id: 'easy', label: 'Easy' },
                { id: 'moderate', label: 'Moderate' },
                { id: 'hard', label: 'Hard' },
              ]}
            />

            <Input
              label="Year"
              type="number"
              inputMode="numeric"
              min={1990}
              max={2100}
              value={form.year}
              onChange={(event) => patch('year', event.target.value)}
            />

            <Input
              label="Marks"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.marks}
              onChange={(event) => patch('marks', event.target.value)}
            />

            <Input
              label="Exam type"
              value={form.exam_type}
              onChange={(event) => patch('exam_type', event.target.value)}
              placeholder="board"
            />

            <Input
              label="Paper set"
              value={form.paper_set}
              onChange={(event) => patch('paper_set', event.target.value)}
              placeholder="Set 1"
            />

            <Input
              label="Source"
              value={form.source}
              onChange={(event) => patch('source', event.target.value)}
              placeholder="CBSE Delhi 2024"
              className="sm:col-span-2"
            />

            <div className="sm:col-span-2">
              <Checkbox
                checked={form.is_important}
                onChange={(checked) => patch('is_important', checked)}
                label="Mark as important"
                description="Surfaces the question in the student app's high-yield list."
              />
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------------- sidebar */}
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <SummaryRow
                label="Board"
                value={boards?.find((board) => board.id === form.board_id)?.name ?? '—'}
              />
              <SummaryRow
                label="Class"
                value={classes?.find((entry) => entry.id === form.class_id)?.name ?? '—'}
              />
              <SummaryRow
                label="Subject"
                value={visibleSubjects.find((subject) => subject.id === form.subject_id)?.name ?? '—'}
              />
              <SummaryRow
                label="Chapter"
                value={visibleChapters.find((chapter) => chapter.id === form.chapter_id)?.name ?? '—'}
              />
              <SummaryRow label="Type" value={QUESTION_TYPES.find((t) => t.value === form.question_type)?.label ?? '—'} />
              <SummaryRow label="Year" value={form.year || '—'} />
              <SummaryRow label="Marks" value={form.marks || '—'} />
            </dl>
          </Card>

          <Card className="space-y-2 p-5">
            <Button
              fullWidth
              onClick={() => save(false)}
              disabled={!valid || saving}
              loading={saving}
              icon={<Save className="size-4" aria-hidden="true" />}
            >
              {editing ? 'Save changes' : 'Save question'}
            </Button>
            {!editing && canPublish && (
              <Button fullWidth variant="secondary" onClick={() => save(true)} disabled={!valid || saving}>
                Save and open
              </Button>
            )}
            <Button fullWidth variant="ghost" onClick={() => navigate('/admin/content/pyq')} disabled={saving}>
              Cancel
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-foreground">{value}</dd>
    </div>
  )
}

/**
 * Pull each `$$…$$` span out of the text for the preview panel.
 * Returns the inner text only — no delimiters, no markup, no evaluation.
 */
function extractFormulae(text: string): string[] {
  const matches = text.match(/\$\$[^$]+\$\$/g) ?? []
  return matches.map((match) => match.slice(2, -2).trim()).filter(Boolean)
}
