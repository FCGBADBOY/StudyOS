/**
 * Admin → Content Engine → Review (`/admin/content-engine/review`).
 *
 * The human gate (spec §49/§50). Nothing the engine produces reaches a student
 * until an admin with `engine.manage` reads it and approves it here.
 *
 * What an editor is shown, in the order they need it:
 *
 *   1. **The note as a student will see it** — rendered from the same
 *      `NoteReader` component the chapter page uses, so review is not a
 *      guess about formatting.
 *   2. **The validation report** — itemised warnings and errors plus a
 *      syllabus coverage breakdown, never a bare score.
 *   3. **The provenance** — which sources it drew on and whether any of them
 *      were unverified.
 *
 * Approval never regenerates silently: a reprocess request creates a *new*
 * version and leaves the old one intact (spec §56).
 */
import { useCallback, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileWarning,
  GitBranch,
  Layers,
  ListChecks,
  Sparkles,
  XCircle,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  SectionHeader,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { isDemo } from '@/services/shared'
import { attributionRows } from '@/content-engine/license'
import { DEPTH_LABELS, NOTE_TYPE_LABELS, type SyllabusChangeSetRow } from '@/content-engine/types'
import {
  decideSyllabusChange,
  getSyllabusChangeItems,
  getNoteDetail,
  listNotesForReview,
  listSyllabusChangeSets,
  reviewScope,
  reviewNote,
  type NoteDetail,
  type ReviewDecision,
  type ReviewNoteRow,
} from '../services/contentEngine.service'
import {
  ContentStatusPill,
  EngineNotice,
  QualityMeter,
  WarningRow,
} from '../components/ContentEngineBits'
import { NoteReader } from '@/components/content/NoteReader'
import { useToast } from '@/context/AppProvider'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

const STATUS_TABS = [
  { id: 'needs_review', label: 'Needs review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
  { id: 'blocked', label: 'Blocked' },
] as const

type StatusTab = (typeof STATUS_TABS)[number]['id']

export default function ContentEngineReviewPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<StatusTab>('needs_review')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const notesQuery = useQuery<ReviewNoteRow[]>(
    `admin:engine:review:${tab}`,
    () => listNotesForReview({ status: tab }, 50),
  )
  const changesQuery = useQuery<SyllabusChangeSetRow[]>('admin:engine:review:syllabus', () =>
    listSyllabusChangeSets('needs_review'),
  )

  const refresh = useCallback(async () => {
    await Promise.all([notesQuery.refetch(), changesQuery.refetch()])
  }, [notesQuery.refetch, changesQuery.refetch])

  const notes = notesQuery.data ?? []
  const changeSets = changesQuery.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/admin/content-engine"
        eyebrow="Content Engine"
        title="Review queue"
        subtitle="Generated notes and syllabus changes wait here. A human decides what becomes visible to students — the engine can approve nothing by itself."
      />

      {isDemo && <EngineNotice />}

      {/* -------------------------------------------------------- tabs */}
      <nav aria-label="Review status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((entry) => {
          const active = entry.id === tab
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setTab(entry.id)
                setExpandedId(null)
              }}
              aria-current={active ? 'page' : undefined}
              className={`rounded-control px-3 py-1.5 text-[13px] font-semibold transition-colors ${FOCUS_RING} ${
                active ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-secondary hover:text-foreground'
              }`}
            >
              {entry.label}
            </button>
          )
        })}
      </nav>

      {/* -------------------------------------------------------- notes */}
      <section aria-label="Generated notes">
        {notesQuery.error ? (
          <ErrorState
            title="Could not load the review queue"
            description={notesQuery.error}
            onRetry={notesQuery.refetch}
          />
        ) : !notesQuery.data ? (
          <LoadingState label="Loading the review queue" />
        ) : notes.length === 0 ? (
          <EmptyState
            icon={tab === 'needs_review' ? <CheckCircle2 /> : <ListChecks />}
            title={tab === 'needs_review' ? 'Nothing to review' : 'No content in this state'}
            description={
              tab === 'needs_review'
                ? 'Every generated note has been reviewed. New material appears here as soon as the engine finishes generating and validating it.'
                : 'Content moves between these states as it is reviewed and published.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <ReviewCard
                key={note.id}
                note={note}
                expanded={expandedId === note.id}
                onToggle={() => setExpandedId(expandedId === note.id ? null : note.id)}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------- syllabus changes */}
      <section aria-labelledby="syllabus-heading">
        <SectionHeader
          id="syllabus-heading"
          title="Syllabus changes"
          subtitle="Discovery never overwrites the curriculum. Approve a diff here, then apply it — new chapters are added, existing ones updated, nothing deleted."
        />

        {changesQuery.error ? (
          <ErrorState
            title="Could not load syllabus changes"
            description={changesQuery.error}
            onRetry={changesQuery.refetch}
          />
        ) : !changesQuery.data ? (
          <LoadingState label="Loading syllabus changes" />
        ) : changeSets.length === 0 ? (
          <EmptyState
            compact
            icon={<GitBranch />}
            title="No syllabus changes waiting"
            description="When a weekly check finds a difference between the live syllabus and StudyOS, the diff appears here for review."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {changeSets.map((changeSet) => (
              <ChangeSetCard key={changeSet.id} changeSet={changeSet} onChanged={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Note card                                                                  */
/* -------------------------------------------------------------------------- */

function ReviewCard({
  note,
  expanded,
  onToggle,
  onChanged,
}: {
  note: ReviewNoteRow
  expanded: boolean
  onToggle: () => void
  onChanged: () => void | Promise<void>
}) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<NoteDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    if (detail || loadingDetail) return
    setLoadingDetail(true)
    try {
      setDetail(await getNoteDetail(note.id))
    } catch {
      toast({ title: 'Could not load the note', variant: 'danger' })
    } finally {
      setLoadingDetail(false)
    }
  }, [detail, loadingDetail, note.id, toast])

  const toggle = () => {
    onToggle()
    if (!expanded) void load()
  }

  const act = async (decision: ReviewDecision, reason?: string) => {
    setBusy(true)
    try {
      await reviewNote(note.id, decision, reason)
      toast({
        title:
          decision === 'approve'
            ? 'Note approved'
            : decision === 'publish'
              ? 'Note published'
              : decision === 'reject'
                ? 'Note blocked'
                : decision === 'archive'
                  ? 'Note archived'
                  : 'Reprocess queued',
        variant: 'success',
      })
      setRejectOpen(false)
      setRejectReason('')
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not apply that decision',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  const validation = detail?.validation ?? null
  const provenance = (detail?.provenance ?? []).map((entry) =>
    attributionRows({
      source_name: entry.source_name,
      source_url: entry.source_url,
      domain: entry.domain,
      publisher: entry.publisher,
      retrieved_at: entry.retrieved_at,
      license_status: entry.license_status,
      redistribution_allowed: entry.redistribution_allowed,
      official_status: entry.official_status,
    }),
  )

  return (
    <li>
      <Card as="article" aria-label={note.title}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className={`flex w-full items-start justify-between gap-3 text-left ${FOCUS_RING}`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{note.title}</p>
            <p className="mt-0.5 text-[13px] text-muted">{reviewScope(note)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">{NOTE_TYPE_LABELS[note.note_type] ?? note.note_type}</Badge>
              <Badge variant="outline">{DEPTH_LABELS[note.depth] ?? note.depth}</Badge>
              {note.generation_source === 'ai' && (
                <Badge theme="ai" uppercase>
                  AI-generated
                </Badge>
              )}
              {note.generation_version > 1 && (
                <Badge variant="outline">v{note.generation_version}</Badge>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ContentStatusPill status={note.status} />
            {expanded ? (
              <ChevronDown aria-hidden className="size-4 text-faint" />
            ) : (
              <ChevronRight aria-hidden className="size-4 text-faint" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 border-t border-border pt-4">
            {loadingDetail && !detail ? (
              <LoadingState label="Loading the note" />
            ) : (
              <div className="flex flex-col gap-5">
                {/* ------------------------------------------- metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="eyebrow text-faint">Validation</p>
                    <QualityMeter className="mt-1.5" score={note.quality_score} grade={note.quality_grade} />
                    <p className="mt-1.5 text-xs leading-relaxed text-faint">
                      Structural quality only — it is not a claim that the content is factually correct.
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 self-start text-[13px]">
                    <MetaRow label="Words" value={note.word_count.toLocaleString('en-IN')} />
                    <MetaRow label="Model" value={note.generation_model ?? 'unknown'} />
                    <MetaRow label="Prompt" value={note.prompt_version ?? 'unknown'} />
                    <MetaRow label="Version" value={String(note.generation_version)} />
                  </dl>
                </div>

                {/* ------------------------------------ validation report */}
                {validation && (validation.warnings.length > 0 || validation.errors.length > 0) && (
                  <div className="rounded-card border border-warning/35 bg-warning/8 p-3">
                    <p className="eyebrow flex items-center gap-1.5 text-warning">
                      <FileWarning aria-hidden className="size-3.5" />
                      {validation.errors.length} error{validation.errors.length === 1 ? '' : 's'} ·{' '}
                      {validation.warnings.length} warning{validation.warnings.length === 1 ? '' : 's'}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {[...validation.errors, ...validation.warnings].slice(0, 8).map((issue, index) => (
                        <li key={index} className="text-[13px] leading-relaxed text-muted">
                          <span className="font-semibold text-foreground">{issue.label}</span>
                          {issue.detail ? ` — ${issue.detail}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {validation && validation.coverage.missing.length > 0 && (
                  <WarningRow>
                    {validation.coverage.missing.length} syllabus topic
                    {validation.coverage.missing.length === 1 ? ' is' : 's are'} missing:{' '}
                    {validation.coverage.missing.join(', ')}.
                  </WarningRow>
                )}

                {/* Repair history: a reviewer should know the model already
                    tried to fix these sections once and it did not fully land. */}
                {validation && validation.repair_attempts > 0 && (
                  <p className="text-[13px] leading-relaxed text-faint">
                    Automated repair ran {validation.repair_attempts} time
                    {validation.repair_attempts === 1 ? '' : 's'} on{' '}
                    <span className="text-muted">{validation.repaired_targets.join(', ')}</span>.
                    Anything still listed above was left as written rather than rewritten again.
                  </p>
                )}

                {/* ------------------------------------------ the note */}
                <div>
                  <p className="eyebrow mb-2 text-faint">Content preview</p>
                  <NoteReader sections={detail?.sections ?? []} headingLevel="h4" />
                </div>

                {/* --------------------------------------- provenance */}
                {provenance.length > 0 && (
                  <div>
                    <p className="eyebrow mb-2 text-faint">Sources it drew on</p>
                    <div className="flex flex-col gap-2">
                      {provenance.map((rows, index) => (
                        <ProvenanceRows key={index} rows={rows} />
                      ))}
                    </div>
                  </div>
                )}
                {note.source_references.length > 0 && provenance.length === 0 && (
                  <div>
                    <p className="eyebrow mb-2 text-faint">Declared references</p>
                    <ul className="space-y-1 text-[13px] text-muted">
                      {note.source_references.map((reference, index) => (
                        <li key={index}>
                          <span className="font-semibold text-foreground">{reference.source_name}</span>
                          {reference.note ? ` — ${reference.note}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ---------------------------------------- decisions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {note.status !== 'approved' && note.status !== 'published' && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<CheckCircle2 />}
                      loading={busy}
                      onClick={() => void act('approve')}
                      className={FOCUS_RING}
                    >
                      Approve
                    </Button>
                  )}
                  {note.status !== 'published' && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busy}
                      onClick={() => void act('publish')}
                      className={FOCUS_RING}
                    >
                      Approve & publish
                    </Button>
                  )}
                  {note.status !== 'blocked' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<XCircle />}
                      onClick={() => setRejectOpen(true)}
                      className={FOCUS_RING}
                    >
                      Reject
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Sparkles />}
                    loading={busy}
                    onClick={() => void act('reprocess')}
                    className={FOCUS_RING}
                  >
                    Regenerate
                  </Button>
                  {note.status !== 'archived' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void act('archive')}
                      className={FOCUS_RING}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Block this note">
          <div className="flex flex-col gap-3">
            <p className="text-[13px] leading-relaxed text-muted">
              Blocking keeps the note in the database so it can be inspected or regenerated, but hides it from
              every student.
            </p>
            <Input
              label="Reason (optional)"
              placeholder="e.g. Reaction conditions are wrong for this syllabus"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={busy}
                onClick={() => void act('reject', rejectReason || undefined)}
              >
                Block note
              </Button>
            </div>
          </div>
        </Modal>
      </Card>
    </li>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-faint">{label}</dt>
      <dd className="truncate text-right text-muted">{value}</dd>
    </>
  )
}

function ProvenanceRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="rounded-card border border-border bg-surface-secondary/60 p-2.5">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-baseline gap-x-2 py-0.5">
          <dt className="eyebrow shrink-0 text-faint">{row.label}</dt>
          <dd className="min-w-0 flex-1 break-words text-[13px] text-muted">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* -------------------------------------------------------------------------- */
/* Syllabus change set                                                        */
/* -------------------------------------------------------------------------- */

function ChangeSetCard({
  changeSet,
  onChanged,
}: {
  changeSet: SyllabusChangeSetRow
  onChanged: () => void | Promise<void>
}) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const itemsQuery = useQuery(
    `admin:engine:changes:${changeSet.id}`,
    () => getSyllabusChangeItems(changeSet.id),
    { enabled: true },
  )

  const act = async (decision: 'approve' | 'reject' | 'apply') => {
    setBusy(true)
    try {
      await decideSyllabusChange(changeSet.id, decision)
      toast({
        title:
          decision === 'apply'
            ? 'Syllabus changes applied'
            : decision === 'approve'
              ? 'Changes approved'
              : 'Changes rejected',
        variant: 'success',
      })
      await onChanged()
    } catch (error) {
      toast({
        title: 'Could not save that decision',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  const items = itemsQuery.data ?? []

  return (
    <li>
      <Card as="article" aria-label="Syllabus change set">
        <CardHeader
          title={changeSet.academic_session ? `Syllabus diff · ${changeSet.academic_session}` : 'Syllabus diff'}
          subtitle={
            changeSet.subject_id
              ? 'A discovered syllabus differs from what StudyOS currently has.'
              : 'No subject could be matched — resolve the subject before applying.'
          }
        />

        {items.length > 0 && (
          <ul className="mt-2 divide-y divide-border">
            {items.slice(0, 12).map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">
                    {item.discovered_name ?? item.existing_name ?? '(unnamed)'}
                  </p>
                  {item.existing_name && item.discovered_name && item.existing_name !== item.discovered_name && (
                    <p className="mt-0.5 text-xs text-faint">was “{item.existing_name}”</p>
                  )}
                </div>
                <Badge
                  variant={
                    item.change_type === 'added'
                      ? 'success'
                      : item.change_type === 'removed'
                        ? 'danger'
                        : item.change_type === 'renamed'
                          ? 'warning'
                          : 'neutral'
                  }
                >
                  {item.change_type}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {items.length > 12 && (
          <p className="mt-2 text-xs text-faint">…and {items.length - 12} more changes.</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !changeSet.subject_id}
            onClick={() => void act('apply')}
            className={FOCUS_RING}
          >
            Approve & apply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void act('approve')}
            className={FOCUS_RING}
          >
            Approve only
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void act('reject')}
            className={FOCUS_RING}
          >
            Reject
          </Button>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-faint">
            <Layers aria-hidden className="size-3.5" />
            {changeSet.baseline.length} known → {changeSet.discovered.length} discovered
          </span>
        </div>
      </Card>
    </li>
  )
}
