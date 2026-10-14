/**
 * Admin → Content Engine → PYQ & sample-paper discovery
 * (`/admin/content-engine/pyq-discovery`).
 *
 * The legality-first collector (spec §25–§30). The rule that shapes this whole
 * screen is that **publicly accessible is not redistributable**:
 *
 *   * a document with an unclear licence is kept as metadata + a canonical URL
 *     and shown to students as "View Original", never as a StudyOS download;
 *   * `unverified` material is never dressed up as an official PYQ — the
 *     authenticity tier travels with the row everywhere;
 *   * anything the extractor is unsure about stays in "needs review" and is
 *     hidden from students until an admin resolves it.
 */
import { useState } from 'react'
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  RefreshCw,
  ScrollText,
  Sparkles,
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
  PageHeader,
  ProgressBar,
  SectionHeader,
  Select,
} from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { isDemo } from '@/services/shared'
import { relativeTime } from '@/utils/format'
import {
  DOC_KINDS,
  DOC_KIND_LABELS,
  OFFICIAL_STATUSES,
  OFFICIAL_STATUS_LABELS,
  RETRIEVAL_STATUSES,
  RETRIEVAL_LABELS,
  type DocKind,
  type ExtractedQuestionRow,
  type OfficialStatus,
  type PaperMetadataRow,
  type PyqImportJobRow,
  type RetrievalStatus,
  type SourceDocumentRow,
} from '@/content-engine/types'
import { decideStorage, labelForDocument } from '@/content-engine/license'
import { ContentLabel } from '@/components/content/ContentLabel'
import {
  listDocuments,
  listExtractedQuestions,
  listPapers,
  listPyqImportJobs,
  runAction,
} from '../services/contentEngine.service'
import {
  LicensePill,
  OfficialnessPill,
  RetrievalPill,
  WarningRow,
} from '../components/ContentEngineBits'
import { useToast } from '@/context/AppProvider'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

const KIND_OPTIONS = [
  { id: 'all', label: 'All document types' },
  ...DOC_KINDS.map((id) => ({ id, label: DOC_KIND_LABELS[id] })),
]
const RETRIEVAL_OPTIONS = [
  { id: 'all', label: 'Any storage state' },
  ...RETRIEVAL_STATUSES.map((id) => ({ id, label: RETRIEVAL_LABELS[id] })),
]
const OFFICIAL_OPTIONS = [
  { id: 'all', label: 'Any authenticity' },
  ...OFFICIAL_STATUSES.map((id) => ({ id, label: OFFICIAL_STATUS_LABELS[id] })),
]

export default function ContentEnginePyqDiscoveryPage() {
  const { toast } = useToast()
  const [kind, setKind] = useState<'all' | DocKind>('all')
  const [retrieval, setRetrieval] = useState<'all' | RetrievalStatus>('all')
  const [official, setOfficial] = useState<'all' | OfficialStatus>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const documentsQuery = useQuery(
    `admin:engine:documents:${kind}:${retrieval}:${official}`,
    () => listDocuments({ kind, retrieval, official }, 50),
  )
  const papersQuery = useQuery<PaperMetadataRow[]>('admin:engine:papers', () => listPapers(30))
  const questionsQuery = useQuery<ExtractedQuestionRow[]>('admin:engine:extracted', () =>
    listExtractedQuestions({ needsReview: true }, 40),
  )
  const importsQuery = useQuery<PyqImportJobRow[]>('admin:engine:pyq-imports', () => listPyqImportJobs(10))

  const documents = (documentsQuery.data?.items ?? []).filter((document) => {
    const needle = search.trim().toLowerCase()
    return !needle || `${document.title} ${document.domain}`.toLowerCase().includes(needle)
  })

  const discover = async (action: 'discoverPYQs' | 'discoverSamplePapers') => {
    setBusy(true)
    try {
      const response = await runAction(action)
      toast({
        title: action === 'discoverPYQs' ? 'PYQ discovery queued' : 'Sample-paper discovery queued',
        description: response.summary ?? 'The worker will only touch enabled, allow-listed sources.',
        variant: 'success',
      })
      await Promise.all([documentsQuery.refetch(), papersQuery.refetch(), importsQuery.refetch()])
    } catch (error) {
      toast({
        title: 'Could not queue discovery',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/admin/content-engine"
        eyebrow="Content Engine"
        title="PYQ & sample papers"
        subtitle="Discover, verify and classify papers. Unverified material is never presented as an official PYQ, and a document whose licence is unclear is never stored — only linked."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw />}
              onClick={() => void documentsQuery.refetch()}
              loading={documentsQuery.isFetching}
              className={FOCUS_RING}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={<ScrollText />}
              loading={busy}
              onClick={() => void discover('discoverPYQs')}
              disabled={isDemo}
              className={FOCUS_RING}
            >
              Discover PYQs
            </Button>
            <Button
              variant="primary"
              icon={<Sparkles />}
              loading={busy}
              onClick={() => void discover('discoverSamplePapers')}
              disabled={isDemo}
              className={FOCUS_RING}
            >
              Discover sample papers
            </Button>
          </>
        }
      />

      {isDemo && (
        <WarningRow>
          Discovery needs a connected Supabase project and at least one enabled source in the registry.
        </WarningRow>
      )}

      {/* ---------------------------------------------------- import jobs */}
      {(importsQuery.data ?? []).length > 0 && (
        <section aria-label="Recent import runs">
          <Card as="section">
            <CardHeader title="Recent import runs" subtitle="Extraction, classification and de-duplication." />
            <ul className="mt-2 divide-y divide-border">
              {(importsQuery.data ?? []).map((job) => (
                <li key={job.id} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground">
                      {job.year ? `${job.year} · ` : ''}
                      {job.exam_type}
                    </p>
                    <Badge
                      variant={
                        job.status === 'completed'
                          ? 'success'
                          : job.status === 'failed'
                            ? 'danger'
                            : job.status === 'needs_review'
                              ? 'warning'
                              : 'brand'
                      }
                    >
                      {job.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <ProgressBar
                    value={job.progress}
                    size="xs"
                    variant={job.status === 'failed' ? 'danger' : 'brand'}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-xs text-faint">
                    {job.questions_found} found · {job.questions_imported} imported ·{' '}
                    {job.duplicates_blocked} duplicates blocked · {job.low_confidence} low confidence
                  </p>
                  {job.error && <p className="mt-1 text-xs text-danger">{job.error}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* ------------------------------------------------------ documents */}
      <section aria-labelledby="documents-heading">
        <SectionHeader
          id="documents-heading"
          title="Discovered documents"
          subtitle="Every document the engine has found, with what it is allowed to do with it."
        />

        <Card as="section" aria-label="Document filters">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Type" value={kind} options={KIND_OPTIONS} onChange={(value) => setKind(value as 'all' | DocKind)} />
            <Select
              label="Storage"
              value={retrieval}
              options={RETRIEVAL_OPTIONS}
              onChange={(value) => setRetrieval(value as 'all' | RetrievalStatus)}
            />
            <Select
              label="Authenticity"
              value={official}
              options={OFFICIAL_OPTIONS}
              onChange={(value) => setOfficial(value as 'all' | OfficialStatus)}
            />
            <Input
              label="Search"
              placeholder="Title or domain…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </Card>

        {documentsQuery.error ? (
          <ErrorState
            title="Could not load the discovered documents"
            description={documentsQuery.error}
            onRetry={documentsQuery.refetch}
          />
        ) : !documentsQuery.data ? (
          <LoadingState label="Loading discovered documents" />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileSearch />}
            title="No documents discovered yet"
            description="Enable a source in the registry, then run discovery. The engine only ever visits allow-listed academic domains and always obeys robots.txt."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------------- papers */}
      <section aria-labelledby="papers-heading">
        <SectionHeader
          id="papers-heading"
          title="Classified papers"
          subtitle="Papers with a resolved year, board and authenticity tier."
        />
        {(papersQuery.data ?? []).length === 0 ? (
          <EmptyState
            compact
            icon={<ScrollText />}
            title="No papers classified yet"
            description="A paper becomes classified once its board, class, year and authenticity have been resolved — and confirmed by a reviewer where confidence was low."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {(papersQuery.data ?? []).map((paper) => (
              <li key={paper.id}>
                <Card as="article" aria-label={`Paper ${paper.year ?? ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {paper.year ? `${paper.year} · ` : ''}
                        {paper.exam_type.replace(/_/g, ' ')}
                        {paper.paper_set && paper.paper_set !== 'unknown' ? ` · Set ${paper.paper_set}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-faint">
                        {paper.language !== 'unknown' ? `${paper.language} · ` : ''}
                        {paper.question_count !== null ? `${paper.question_count} questions · ` : ''}
                        {paper.marks !== null ? `${paper.marks} marks` : 'marks unknown'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <OfficialnessPill status={paper.official_status} />
                      {paper.marking_scheme_document_id ? (
                        <Badge variant="success">Marking scheme linked</Badge>
                      ) : (
                        <Badge variant="neutral">No marking scheme</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------- needs review */}
      <section aria-labelledby="mapping-heading">
        <SectionHeader
          id="mapping-heading"
          title="Question mappings needing review"
          subtitle="Extracted questions whose chapter or topic the engine was unsure about. These stay hidden from students until confirmed."
        />
        {(questionsQuery.data ?? []).length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle2 />}
            title="No uncertain mappings"
            description="Every extracted question has been confidently mapped to a chapter, or has already been reviewed."
          />
        ) : (
          <Card as="section" aria-label="Questions needing review">
            <ul className="divide-y divide-border">
              {(questionsQuery.data ?? []).map((question) => (
                <li key={question.id} className="py-3">
                  <p className="text-[13px] leading-relaxed text-foreground">{question.question_text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="warning">Needs mapping</Badge>
                    <Badge variant="neutral">{question.question_type}</Badge>
                    {question.year && <Badge variant="neutral">{question.year}</Badge>}
                    {question.marks !== null && <Badge variant="neutral">{question.marks} marks</Badge>}
                    {question.mapping_confidence !== null && (
                      <Badge variant="outline">
                        {Math.round(question.mapping_confidence)}% confidence
                      </Badge>
                    )}
                    <span className="text-xs text-faint">via {question.mapping_source}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Document card                                                              */
/* -------------------------------------------------------------------------- */

function DocumentCard({ document }: { document: SourceDocumentRow }) {
  const decision = decideStorage({
    license: document.license_status,
    accessMethod: document.access_method,
  })
  const labelKey = labelForDocument({
    doc_kind: document.doc_kind,
    official_status: document.official_status,
  })
  const isStored = document.retrieval_status === 'stored' && Boolean(document.storage_path)

  return (
    <li>
      <Card as="article" aria-label={document.title}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">{DOC_KIND_LABELS[document.doc_kind] ?? document.doc_kind}</Badge>
              <ContentLabel labelKey={labelKey} />
              {document.academic_session && (
                <Badge variant="neutral">{document.academic_session}</Badge>
              )}
            </div>
            <p className="mt-1.5 text-sm font-semibold text-foreground">{document.title}</p>
            <p className="mt-0.5 break-all text-[13px] text-muted">{document.domain}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <OfficialnessPill status={document.official_status} />
              <LicensePill license={document.license_status} />
              <RetrievalPill status={document.retrieval_status} />
              {document.link_status === 'broken' && <Badge variant="danger">Link broken</Badge>}
              {document.duplicate_of && <Badge variant="warning">Duplicate</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-faint">
              First seen {relativeTime(document.first_seen_at)}
              {document.retrieved_at ? ` · retrieved ${relativeTime(document.retrieved_at)}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {isStored ? (
              <Badge variant="success" icon={<Bot aria-hidden className="size-3" />}>
                Stored in StudyOS
              </Badge>
            ) : (
              <a
                href={document.canonical_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={`inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground ${FOCUS_RING}`}
              >
                View original
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            )}
          </div>
        </div>

        <p
          className={`mt-3 border-t border-border pt-2.5 text-[13px] leading-relaxed ${
            decision === 'store' ? 'text-success' : decision === 'block' ? 'text-danger' : 'text-warning'
          }`}
        >
          {decision === 'store'
            ? 'Redistribution verified — a copy is stored with attribution retained.'
            : 'Licence unclear — only the title and canonical URL are kept, and students see a “View original” link.'}
        </p>
      </Card>
    </li>
  )
}
