/**
 * Admin → Content: create / edit a single resource.
 *
 * One screen covers both halves of the job: `…/resources/new` starts an empty
 * draft, `…/resources/:id` hydrates from `getResource`. Everything is local
 * state until an action button is pressed — `createResource` for a new row,
 * `updateResource` + `setResourceStatus` when the target workflow state differs
 * from the one stored on the server.
 *
 * The database re-checks every transition (`public.guard_resource_status`),
 * so the "Publish" button is hidden — not merely disabled — for roles without
 * `content.publish`.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Check, FileText, Save, Send, X } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  LoadingState,
  PageHeader,
  SectionHeader,
  Select,
  Textarea,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useToast } from '@/context/AppProvider'
import { invalidateQueries } from '@/lib/query'
import { Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import { successAnimation, uploadProgress } from '../animations/adminAnimations'
import {
  listBoards,
  listChapters,
  listClasses,
  listStreams,
  listSubjects,
} from '../services/adminAcademic.service'
import {
  createResource,
  formatBytes,
  getResource,
  listResourceVersions,
  setResourceStatus,
  updateResource,
  uploadResourceFile,
  validateUpload,
  type ResourceDraft,
} from '../services/adminContent.service'
import { RESOURCE_TYPES, RESOURCE_TYPE_LABELS } from '../types/admin'
import type { AdminResourceRow, ResourceStatus, ResourceType, ResourceVersionRow } from '../types/admin'

type SaveTarget = Extract<ResourceStatus, 'draft' | 'pending_review' | 'published'>

const TARGET_LABELS: Record<SaveTarget, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
}

const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ---------------------------------- page ---------------------------------- */

export default function AdminResourceFormPage() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const { role } = useAdminSession()
  const { toast } = useToast()

  /* `new` never reaches `:id` on a dedicated route, but treat it as create
     anyway so the URL can never be mistaken for a database id. */
  const resourceId = routeId === 'new' ? undefined : routeId
  const isEdit = Boolean(resourceId)

  const canPublish = can(role, 'content.publish')
  const canViewVersions = can(role, 'content.view')

  /* ------------------------------- form state ----------------------------- */

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [boardId, setBoardId] = useState('')
  const [classId, setClassId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [resourceType, setResourceType] = useState<ResourceType>('notes')
  const [author, setAuthor] = useState('')
  const [source, setSource] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')

  /* --------------------------------- file --------------------------------- */

  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  /* -------------------------------- status -------------------------------- */

  const [submitting, setSubmitting] = useState<SaveTarget | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const fileChipRef = useRef<HTMLDivElement>(null)
  const hydratedRef = useRef<string | null>(null)

  /* -------------------------------- queries ------------------------------- */

  const resourceQuery = useQuery<AdminResourceRow | null>(
    resourceId ? `admin:resource:${resourceId}` : null,
    () => getResource(resourceId ?? ''),
  )

  const boardsQuery = useQuery('admin:boards', () => listBoards())
  const classesQuery = useQuery('admin:classes', () => listClasses())
  const streamsQuery = useQuery('admin:streams', () => listStreams())
  const subjectsQuery = useQuery('admin:subjects', () => listSubjects())
  const chaptersQuery = useQuery('admin:chapters', () => listChapters())

  const versionsQuery = useQuery<ResourceVersionRow[]>(
    resourceId && canViewVersions ? `admin:resource-versions:${resourceId}` : null,
    () => listResourceVersions(resourceId ?? ''),
  )

  const boards = boardsQuery.data ?? []
  const classes = classesQuery.data ?? []
  const streams = streamsQuery.data ?? []
  const subjects = subjectsQuery.data ?? []
  const chapters = chaptersQuery.data ?? []

  const visibleSubjects = classId ? subjects.filter((entry) => entry.class_id === classId) : subjects
  const visibleChapters = subjectId ? chapters.filter((entry) => entry.subject_id === subjectId) : chapters

  /* ------------------------------- hydration ------------------------------ */

  useEffect(() => {
    const row = resourceQuery.data
    if (!row || !resourceId || hydratedRef.current === resourceId) return
    hydratedRef.current = resourceId

    setTitle(row.title)
    setDescription(row.description ?? '')
    setBoardId(row.board_id ?? '')
    setClassId(row.class_id ?? '')
    setSubjectId(row.subject_id ?? '')
    setChapterId(row.chapter_id ?? '')
    setResourceType(row.resource_type)
    setAuthor(row.author_name ?? '')
    setSource(row.source_name ?? '')
    setTags(row.tags ?? [])
    setFilePath(row.file_path)
    setFileSize(row.file_size_bytes)
    setFileName(row.file_path ? (row.file_path.split('/').pop() ?? null) : null)
  }, [resourceQuery.data, resourceId])

  /* -------------------------------- upload -------------------------------- */

  /* The bar has to exist before the first progress event arrives, so the
     upload starts from an effect (after commit) rather than from the change
     handler — `uploadProgress` then drives the fill width with Anime.js. */
  useEffect(() => {
    const file = pendingFile
    if (!file || !uploading) return

    const bar = uploadProgress(barRef.current)
    let cancelled = false

    void (async () => {
      try {
        const result = await uploadResourceFile(file, {
          folder: 'uploads',
          onProgress: (percent) => {
            setProgress(percent)
            bar.set(percent)
          },
        })
        if (cancelled) return
        setProgress(100)
        setFilePath(result.path)
        setFileSize(result.sizeBytes)
        setFileName(file.name)
      } catch (error) {
        if (!cancelled) setUploadError(messageOf(error))
      } finally {
        bar.cleanup()
        if (!cancelled) {
          setUploading(false)
          setPendingFile(null)
        }
      }
    })()

    return () => {
      cancelled = true
      bar.cleanup()
    }
  }, [pendingFile, uploading])

  /* Small flourish once a file lands — honours prefers-reduced-motion. */
  useLayoutEffect(() => {
    if (uploading || !filePath) return
    return successAnimation(fileChipRef.current)
  }, [filePath, uploading])

  /* -------------------------------- derived ------------------------------- */

  const missing: string[] = []
  if (!title.trim()) missing.push('Title')
  if (!boardId) missing.push('Board')
  if (!classId) missing.push('Class')
  const invalid = missing.length > 0
  const busy = submitting !== null || uploading

  const boardName = boards.find((entry) => entry.id === boardId)?.name ?? ''
  const className = classes.find((entry) => entry.id === classId)?.name ?? ''
  const streamName = streams.find((entry) => entry.id === streamId)?.name ?? ''
  const subjectName = visibleSubjects.find((entry) => entry.id === subjectId)?.name ?? ''
  const chapterName = visibleChapters.find((entry) => entry.id === chapterId)?.name ?? ''
  const pathLabels = [boardName, className, streamName, subjectName, chapterName].filter(Boolean)

  /* -------------------------------- actions ------------------------------- */

  function handleClassChange(next: string) {
    setClassId(next)
    setSubjectId('')
    setChapterId('')
  }

  function handleSubjectChange(next: string) {
    setSubjectId(next)
    setChapterId('')
  }

  function addTags() {
    const parts = tagDraft
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    setTags((current) => [...current, ...parts.filter((part) => !current.includes(part))])
    setTagDraft('')
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTags()
      return
    }
    if (event.key === 'Backspace' && !tagDraft && tags.length > 0) {
      setTags((current) => current.slice(0, -1))
    }
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((entry) => entry !== tag))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    setUploadError(null)
    setProgress(0)

    const validation = validateUpload(file)
    if (!validation.ok) {
      setUploadError(validation.reason ?? 'That file cannot be uploaded.')
      input.value = ''
      return
    }

    setPendingFile(file)
    setUploading(true)
  }

  function removeFile() {
    setFilePath(null)
    setFileSize(null)
    setFileName(null)
    setProgress(0)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function save(target: SaveTarget) {
    if (invalid || busy) return
    setSubmitting(target)
    setSaveError(null)

    const draft: ResourceDraft = {
      title: title.trim(),
      description: description.trim() || undefined,
      resource_type: resourceType,
      board_id: boardId,
      class_id: classId,
      subject_id: subjectId || undefined,
      chapter_id: chapterId || undefined,
      author_name: author.trim() || undefined,
      source_name: source.trim() || undefined,
      file_path: filePath,
      file_size_bytes: fileSize,
      tags,
    }

    try {
      if (resourceId) {
        await updateResource(resourceId, draft)
        const currentStatus = resourceQuery.data?.status
        if (currentStatus && currentStatus !== target) {
          await setResourceStatus(resourceId, target)
        }
        toast({
          title: 'Resource updated',
          description: `Saved as ${TARGET_LABELS[target]}.`,
          variant: 'success',
        })
      } else {
        await createResource(draft, target)
        toast({
          title: 'Resource created',
          description: `Saved as ${TARGET_LABELS[target]}.`,
          variant: 'success',
        })
      }
      /* Drop every cached admin payload so the list re-reads this row. */
      invalidateQueries('admin:')
      navigate('/admin/content')
    } catch (error) {
      setSaveError(messageOf(error))
    } finally {
      setSubmitting(null)
    }
  }

  /* ------------------------------ edit loading ---------------------------- */

  if (isEdit && resourceQuery.loading) return <LoadingState label="Loading resource" />

  if (isEdit && resourceQuery.error && !resourceQuery.data) {
    return (
      <ErrorState
        title="Could not load this resource"
        description={resourceQuery.error}
        onRetry={resourceQuery.refetch}
      />
    )
  }

  if (isEdit && !resourceQuery.data) {
    return (
      <EmptyState
        title="Resource not found"
        description="It may have been deleted, or you may not have access to it."
        action={
          <LinkButton to="/admin/content" variant="outline" size="sm">
            Back to content
          </LinkButton>
        }
      />
    )
  }

  /* --------------------------------- render ------------------------------- */

  const thumbnailUrl = resourceQuery.data?.thumbnail_url ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        back="/admin/content"
        title={isEdit ? 'Edit resource' : 'New resource'}
        subtitle={
          isEdit
            ? 'Update the details, file and placement of this study resource.'
            : 'Add a note, PDF or formula sheet to the student library.'
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------- form ------------------------------- */}
        <div className="space-y-5 lg:col-span-2">
          {saveError && (
            <Notice tone="danger" title="Could not save the resource">
              {saveError}
            </Notice>
          )}

          <Card as="section" aria-label="Details" className="space-y-4">
            <SectionHeader title="Details" subtitle="What students see in the library" />

            <Input
              label="Title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Electrostatics — Complete Notes"
              maxLength={160}
            />

            <Textarea
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short summary of what this resource covers."
              maxLength={600}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Resource type"
                options={RESOURCE_TYPES.map((type) => ({ id: type, label: RESOURCE_TYPE_LABELS[type] }))}
                value={resourceType}
                onChange={(next) => setResourceType(next as ResourceType)}
                placeholder="Select a type"
              />

              <Input
                label="Author"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="e.g. StudyOS Editorial"
              />

              <Input
                label="Source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="e.g. NCERT 2025 edition"
              />

              <div className="sm:col-span-2">
                <Input
                  label="Tags"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Type a tag, press Enter or comma"
                  hint="Press Enter or comma to add. Backspace on an empty field removes the last tag."
                />
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove tag ${tag}`}
                          className="rounded-full p-0.5 text-faint transition-colors hover:text-foreground
                                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                        >
                          <X aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card as="section" aria-label="Academic placement" className="space-y-4">
            <SectionHeader
              title="Academic placement"
              subtitle="Board and class are required; the rest narrows where it appears"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Board"
                options={boards.map((entry) => ({ id: entry.id, label: entry.name }))}
                value={boardId}
                onChange={setBoardId}
                placeholder="Select board"
              />

              <Select
                label="Class"
                options={classes.map((entry) => ({ id: entry.id, label: entry.name }))}
                value={classId}
                onChange={handleClassChange}
                placeholder="Select class"
              />

              <Select
                label="Stream"
                options={streams.map((entry) => ({ id: entry.id, label: entry.name }))}
                value={streamId}
                onChange={setStreamId}
                placeholder="Select stream (optional)"
              />

              <Select
                label="Subject"
                options={visibleSubjects.map((entry) => ({ id: entry.id, label: entry.name }))}
                value={subjectId}
                onChange={handleSubjectChange}
                placeholder="Select subject (optional)"
              />

              <Select
                label="Chapter"
                options={visibleChapters.map((entry) => ({ id: entry.id, label: entry.name }))}
                value={chapterId}
                onChange={setChapterId}
                placeholder="Select chapter (optional)"
              />
            </div>
          </Card>

          <Card as="section" aria-label="File" className="space-y-4">
            <SectionHeader
              title="File"
              subtitle="PDF, PNG, JPG or WEBP — up to 50 MB"
            />

            <div>
              <label
                htmlFor="resource-file"
                className="mb-1.5 block text-[13px] font-medium text-muted"
              >
                Upload a file
              </label>
              <input
                ref={fileInputRef}
                id="resource-file"
                type="file"
                accept={ACCEPTED_FILES}
                onChange={handleFileChange}
                disabled={uploading}
                className="block w-full max-w-full cursor-pointer rounded-control border border-border bg-surface
                           px-3.5 py-2.5 text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-control
                           file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm
                           file:font-semibold file:text-foreground
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              />
            </div>

            {uploading && (
              <div className="rounded-tile border border-border bg-surface-muted p-3">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-foreground">{pendingFile?.name}</span>
                  <span className="tabular shrink-0 font-semibold text-muted">{progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
                >
                  <div ref={barRef} className="h-full rounded-full bg-brand" style={{ width: '0%' }} />
                </div>
              </div>
            )}

            {!uploading && filePath && (
              <div
                ref={fileChipRef}
                className="flex items-center justify-between gap-3 rounded-tile border border-border bg-surface-muted p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText aria-hidden className="h-4 w-4 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
                    <p className="tabular text-[12px] text-muted">
                      {fileSize != null ? formatBytes(fileSize) : 'Size unknown'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" icon={<X />} onClick={removeFile}>
                  Remove file
                </Button>
              </div>
            )}

            {uploadError && (
              <Notice tone="danger" title="Upload rejected">
                {uploadError}
              </Notice>
            )}
          </Card>

          {invalid && (
            <Notice tone="warning" title="Complete the required fields">
              Still needed: {missing.join(', ')}.
            </Notice>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="secondary"
              icon={<Save />}
              loading={submitting === 'draft'}
              disabled={invalid || busy}
              onClick={() => void save('draft')}
            >
              Save draft
            </Button>

            <Button
              variant="outline"
              icon={<Send />}
              loading={submitting === 'pending_review'}
              disabled={invalid || busy}
              onClick={() => void save('pending_review')}
            >
              Submit for review
            </Button>

            {canPublish && (
              <Button
                icon={<Check />}
                loading={submitting === 'published'}
                disabled={invalid || busy}
                onClick={() => void save('published')}
              >
                Publish
              </Button>
            )}

            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => navigate('/admin/content')}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* ------------------------------ preview ----------------------------- */}
        <div className="space-y-5">
          <Card as="section" aria-label="Resource preview" className="space-y-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">
              Resource preview
            </p>

            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="h-28 w-full rounded-tile border border-border bg-surface-muted object-cover"
              />
            ) : (
              <div className="grid h-28 place-items-center rounded-tile border border-border bg-surface-muted text-faint">
                <FileText aria-hidden className="h-7 w-7" />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[15px] font-semibold leading-snug text-foreground">
                {title.trim() || 'Untitled resource'}
              </p>
              <p className="text-sm leading-relaxed text-muted">
                {description.trim() || 'No description yet.'}
              </p>
            </div>

            <dl className="space-y-2.5 text-[13px]">
              <div>
                <dt className="text-faint">Path</dt>
                <dd className="mt-0.5">
                  {pathLabels.length > 0 ? (
                    <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-muted">
                      {pathLabels.map((label, index) => (
                        <span key={`${label}-${index}`} className="inline-flex items-center gap-1">
                          {index > 0 && (
                            <span aria-hidden className="text-faint">
                              ›
                            </span>
                          )}
                          <span>{label}</span>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="text-faint">No academic path selected</p>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-faint">File</dt>
                <dd className="mt-0.5 text-muted">
                  {filePath && fileName ? (
                    <>
                      <span className="text-foreground">{fileName}</span>
                      {fileSize != null && <span className="tabular"> · {formatBytes(fileSize)}</span>}
                    </>
                  ) : (
                    'No file attached'
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-faint">Type</dt>
                <dd className="mt-1">
                  <Badge variant="outline">{RESOURCE_TYPE_LABELS[resourceType]}</Badge>
                </dd>
              </div>

              <div>
                <dt className="text-faint">Author</dt>
                <dd className="mt-0.5 text-muted">{author.trim() || 'Not set'}</dd>
              </div>

              <div>
                <dt className="text-faint">Source</dt>
                <dd className="mt-0.5 text-muted">{source.trim() || 'Not set'}</dd>
              </div>

              <div>
                <dt className="text-faint">Tags</dt>
                <dd className="mt-1">
                  {tags.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-faint">None yet</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          {isEdit && canViewVersions && (
            <Card as="section" aria-labelledby="version-history-heading">
              <SectionHeader
                id="version-history-heading"
                title="Version history"
                subtitle="Saved revisions of this resource"
              />

              {versionsQuery.loading && (
                <p className="text-sm text-muted">Loading revisions…</p>
              )}

              {!versionsQuery.loading && versionsQuery.error && (
                <ErrorState
                  compact
                  title="Could not load revisions"
                  description={versionsQuery.error}
                  onRetry={versionsQuery.refetch}
                />
              )}

              {!versionsQuery.loading && !versionsQuery.error && (
                <>
                  {(versionsQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted">No revisions yet.</p>
                  ) : (
                    <ol className="divide-y divide-border">
                      {versionsQuery.data?.map((version) => (
                        <li key={version.id} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              Version {version.version}
                            </p>
                            <p className="text-[13px] text-muted">
                              {version.change_summary || 'No change summary.'}
                            </p>
                          </div>
                          <span className="tabular shrink-0 text-[12px] text-faint">
                            {formatDateTime(version.created_at)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
