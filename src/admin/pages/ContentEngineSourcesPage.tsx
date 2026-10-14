/**
 * Admin → Content Engine → Source registry (`/admin/content-engine/sources`).
 *
 * The allow-list. The crawler will not touch a host that does not appear here,
 * and `decideStorage()` is what decides whether a discovered document is
 * downloaded or kept as a link.
 *
 * The three columns that matter on every row are the ones the legality rules
 * hang off (spec §2/§6/§21):
 *
 *   licence status  →  redistribution allowed  →  stored or link-only
 *
 * A source whose licence is `unknown` or `restricted` can still be enabled —
 * the engine will simply never store its files.
 */
import { useCallback, useState } from 'react'
import { Bot, CheckCircle2, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StatCard,
} from '@/components/ui'
import { ConfirmDialog } from '../components/AdminFeedback'
import { useQuery } from '@/hooks/useQuery'
import { isDemo } from '@/services/shared'
import { relativeTime } from '@/utils/format'
import {
  SOURCE_TYPES,
  LICENSE_STATUSES,
  ACCESS_METHODS,
  SOURCE_TYPE_LABELS,
  type AccessMethod,
  type CrawlRunRow,
  type LicenseStatus,
  type SourceRegistryRow,
  type SourceType,
} from '@/content-engine/types'
import { DEFAULT_LICENSE_POLICY, decideStorage, describeStorageDecision } from '@/content-engine/license'
import { adapterForDomain, listAdapterChoices } from '@/content-engine/sources/registry'
import {
  createSource,
  deleteSource,
  listCrawlRuns,
  listSources,
  updateSource,
  verifySource,
} from '../services/contentEngine.service'
import { LicensePill, WarningRow } from '../components/ContentEngineBits'
import { useToast } from '@/context/AppProvider'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring'

const TYPE_OPTIONS = SOURCE_TYPES.map((id) => ({ id, label: SOURCE_TYPE_LABELS[id] }))
const LICENSE_OPTIONS = LICENSE_STATUSES.map((id) => ({ id, label: id.replace(/_/g, ' ') }))
const ACCESS_OPTIONS = ACCESS_METHODS.map((id) => ({ id, label: id.replace(/_/g, ' ') }))
const ADAPTER_OPTIONS = listAdapterChoices().map((choice) => ({
  id: choice.id,
  label: `${choice.label} — ${choice.domains.join(', ')}`,
}))

interface DraftState {
  source_name: string
  domain: string
  base_url: string
  adapter: string
  source_type: SourceType
  license_status: LicenseStatus
  access_method: AccessMethod
  redistribution_allowed: boolean
  enabled: boolean
  priority: string
}

const EMPTY_DRAFT: DraftState = {
  source_name: '',
  domain: '',
  base_url: '',
  adapter: ADAPTER_OPTIONS[0]?.id ?? '',
  source_type: 'official_board',
  license_status: 'unknown',
  access_method: 'public',
  redistribution_allowed: false,
  enabled: false,
  priority: '100',
}

export default function ContentEngineSourcesPage() {
  const { toast } = useToast()
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SourceRegistryRow | null>(null)

  const sourcesQuery = useQuery<SourceRegistryRow[]>('admin:engine:sources', () => listSources())
  const runsQuery = useQuery<CrawlRunRow[]>('admin:engine:crawl-runs', () => listCrawlRuns(8))

  const sources = sourcesQuery.data ?? []
  const refresh = useCallback(async () => {
    await Promise.all([sourcesQuery.refetch(), runsQuery.refetch()])
  }, [sourcesQuery.refetch, runsQuery.refetch])

  const toggle = async (source: SourceRegistryRow) => {
    try {
      await updateSource(source.id, { enabled: !source.enabled })
      toast({
        title: source.enabled ? 'Source disabled' : 'Source enabled',
        variant: 'success',
      })
      await refresh()
    } catch (error) {
      toast({
        title: 'Could not update the source',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    }
  }

  const verify = async (source: SourceRegistryRow) => {
    try {
      const response = await verifySource(source.id)
      toast({
        title: 'Source checked',
        description: response.summary ?? 'The worker re-checked reachability and robots.txt.',
        variant: 'success',
      })
      await refresh()
    } catch (error) {
      toast({
        title: 'Could not check the source',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    }
  }

  const remove = async () => {
    if (!pendingDelete) return
    try {
      await deleteSource(pendingDelete.id)
      toast({ title: 'Source removed', variant: 'success' })
      setPendingDelete(null)
      await refresh()
    } catch (error) {
      toast({
        title: 'Could not remove the source',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    }
  }

  const submit = async () => {
    const adapter = listAdapterChoices().find((choice) => choice.id === draft.adapter)
    const domain = (draft.domain || adapter?.domains[0] || '').trim().toLowerCase()
    const baseUrl = (draft.base_url || `https://${domain}`).trim()

    if (!draft.source_name.trim() || !domain) {
      toast({ title: 'A source name and a domain are required', variant: 'danger' })
      return
    }

    setSaving(true)
    try {
      await createSource({
        source_name: draft.source_name.trim(),
        domain,
        base_url: baseUrl,
        board_id: null,
        source_type: draft.source_type,
        license_status: draft.license_status,
        redistribution_allowed: draft.redistribution_allowed,
        access_method: draft.access_method,
        enabled: draft.enabled,
        priority: Number(draft.priority) || 100,
        notes: adapter ? `Adapter: ${adapter.label}` : null,
      })
      toast({ title: 'Source added', variant: 'success' })
      setFormOpen(false)
      setDraft(EMPTY_DRAFT)
      await refresh()
    } catch (error) {
      toast({
        title: 'Could not add the source',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'danger',
      })
    } finally {
      setSaving(false)
    }
  }

  const draftDecision = decideStorage({
    license: draft.license_status,
    accessMethod: draft.access_method,
    policy: DEFAULT_LICENSE_POLICY,
  })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back="/admin/content-engine"
        eyebrow="Content Engine"
        title="Source registry"
        subtitle="The crawl allow-list. A host that is not on this list is never fetched, and a document whose licence is unknown or restricted is never stored — only linked."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw />}
              onClick={() => void refresh()}
              loading={sourcesQuery.isFetching}
              className={FOCUS_RING}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => setFormOpen(true)}
              className={FOCUS_RING}
            >
              Add source
            </Button>
          </>
        }
      />

      {isDemo && (
        <WarningRow>
          The source registry needs a connected Supabase project. Nothing is listed here without a backend.
        </WarningRow>
      )}

      {/* --------------------------------------------------------- stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Registered sources"
          value={sources.length.toLocaleString('en-IN')}
          icon={<Bot />}
          accent="brand"
        />
        <StatCard
          label="Enabled"
          value={sources.filter((source) => source.enabled).length.toLocaleString('en-IN')}
          icon={<CheckCircle2 />}
          accent="success"
        />
        <StatCard
          label="Unavailable"
          value={sources.filter((source) => source.source_status === 'unavailable').length.toLocaleString('en-IN')}
          icon={<ExternalLink />}
          accent="warning"
        />
      </div>

      {/* ------------------------------------------------------- sources */}
      <section aria-label="Registered sources">
        {sourcesQuery.error ? (
          <ErrorState
            title="Could not load the source registry"
            description={sourcesQuery.error}
            onRetry={sourcesQuery.refetch}
          />
        ) : !sourcesQuery.data ? (
          <LoadingState label="Loading the source registry" />
        ) : sources.length === 0 ? (
          <EmptyState
            icon={<Bot />}
            title="No sources registered"
            description="Add an official board or an approved open-educational repository before the engine can discover anything. The engine never crawls a host that was not added here."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {sources.map((source) => {
              const decision = decideStorage({
                license: source.license_status,
                accessMethod: source.access_method,
                policy: DEFAULT_LICENSE_POLICY,
              })
              const adapter = adapterForDomain(source.domain)

              return (
                <li key={source.id}>
                  <Card as="article" aria-label={source.source_name}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{source.source_name}</p>
                          <LicensePill license={source.license_status} />
                          {source.source_status === 'unavailable' && (
                            <Badge variant="danger">Unavailable</Badge>
                          )}
                          {source.consecutive_failures > 0 && (
                            <Badge variant="warning">{source.consecutive_failures} failures</Badge>
                          )}
                        </div>
                        <p className="mt-1 break-all text-[13px] text-muted">{source.domain}</p>
                        <p className="mt-0.5 text-xs text-faint">
                          {SOURCE_TYPE_LABELS[source.source_type] ?? source.source_type} · priority{' '}
                          {source.priority}
                          {adapter ? ` · adapter: ${adapter.label}` : ' · no adapter matched'}
                        </p>
                        {source.last_error && (
                          <p className="mt-1 truncate text-xs text-danger">{source.last_error}</p>
                        )}
                        <p className="mt-1 text-xs text-faint">
                          Last checked:{' '}
                          {source.last_checked_at ? relativeTime(source.last_checked_at) : 'never'}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void verify(source)}
                          className={FOCUS_RING}
                        >
                          Check now
                        </Button>
                        <Button
                          variant={source.enabled ? 'soft' : 'ghost'}
                          size="sm"
                          onClick={() => void toggle(source)}
                          className={FOCUS_RING}
                        >
                          {source.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 />}
                          onClick={() => setPendingDelete(source)}
                          className={FOCUS_RING}
                        >
                          <span className="sr-only">Remove {source.source_name}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-border pt-3">
                      <p className="eyebrow text-faint">What the engine may do with this source</p>
                      <p
                        className={`mt-1 text-[13px] leading-relaxed ${
                          decision === 'store' ? 'text-success' : decision === 'block' ? 'text-danger' : 'text-warning'
                        }`}
                      >
                        {describeStorageDecision(decision, source.license_status)}
                      </p>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------- crawl runs */}
      <section aria-labelledby="crawl-runs-heading">
        <Card as="section" aria-label="Recent crawl runs">
          <CardHeader
            title="Recent crawl runs"
            subtitle="What the crawler fetched, and what it refused to touch."
          />
          {runsQuery.error ? (
            <ErrorState title="Could not load crawl runs" description={runsQuery.error} onRetry={runsQuery.refetch} />
          ) : !runsQuery.data ? (
            <LoadingState label="Loading crawl runs" />
          ) : (runsQuery.data ?? []).length === 0 ? (
            <EmptyState compact title="No crawl runs yet" description="Runs appear here the first time the worker checks a source." />
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {(runsQuery.data ?? []).map((run) => (
                <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">
                      {run.trigger} · {run.status}
                    </p>
                    <p className="mt-0.5 text-xs text-faint">
                      {relativeTime(run.started_at)} · {run.pages_fetched} fetched ·{' '}
                      {run.documents_found} documents found · {run.documents_stored} stored ·{' '}
                      {run.documents_linked} linked
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {run.blocked_by_robots > 0 && (
                      <Badge variant="neutral">{run.blocked_by_robots} robots-blocked</Badge>
                    )}
                    {run.errors > 0 && <Badge variant="danger">{run.errors} errors</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* --------------------------------------------------- add dialog */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add a source">
        <div className="flex flex-col gap-3">
          <Select
            label="Board adapter (optional)"
            value={draft.adapter}
            options={ADAPTER_OPTIONS}
            onChange={(value) => {
              const choice = listAdapterChoices().find((entry) => entry.id === value)
              setDraft((previous) => ({
                ...previous,
                adapter: value,
                domain: previous.domain || choice?.domains[0] || '',
                base_url: previous.base_url || choice?.domains[0] ? `https://${choice?.domains[0]}` : '',
              }))
            }}
          />
          <Input
            label="Source name"
            placeholder="e.g. CBSE Academic"
            value={draft.source_name}
            onChange={(event) => setDraft((previous) => ({ ...previous, source_name: event.target.value }))}
          />
          <Input
            label="Domain"
            placeholder="e.g. cbseacademic.nic.in"
            value={draft.domain}
            onChange={(event) => setDraft((previous) => ({ ...previous, domain: event.target.value }))}
          />
          <Input
            label="Base URL"
            placeholder="https://…"
            value={draft.base_url}
            onChange={(event) => setDraft((previous) => ({ ...previous, base_url: event.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Source type"
              value={draft.source_type}
              options={TYPE_OPTIONS}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, source_type: value as SourceType }))
              }
            />
            <Select
              label="Licence status"
              value={draft.license_status}
              options={LICENSE_OPTIONS}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, license_status: value as LicenseStatus }))
              }
            />
            <Select
              label="Access method"
              value={draft.access_method}
              options={ACCESS_OPTIONS}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, access_method: value as AccessMethod }))
              }
            />
            <Input
              label="Priority (lower runs first)"
              type="number"
              value={draft.priority}
              onChange={(event) => setDraft((previous) => ({ ...previous, priority: event.target.value }))}
            />
          </div>

          <Checkbox
            label="Redistribution allowed — I have confirmed StudyOS may store copies of this source's files"
            checked={draft.redistribution_allowed}
            onChange={(checked) => setDraft((previous) => ({ ...previous, redistribution_allowed: checked }))}
          />
          <Checkbox
            label="Enable this source immediately"
            checked={draft.enabled}
            onChange={(checked) => setDraft((previous) => ({ ...previous, enabled: checked }))}
          />

          <div className="rounded-card border border-border bg-surface-secondary/60 p-3">
            <p className="eyebrow text-faint">Result</p>
            <p
              className={`mt-1 text-[13px] leading-relaxed ${
                draftDecision === 'store'
                  ? 'text-success'
                  : draftDecision === 'block'
                    ? 'text-danger'
                    : 'text-warning'
              }`}
            >
              {describeStorageDecision(draftDecision, draft.license_status)}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void submit()}>
              Add source
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void remove()}
        title="Remove this source?"
        description={
          pendingDelete
            ? `Removing “${pendingDelete.source_name}” stops any further crawling. Documents already discovered keep their provenance records.`
            : ''
        }
        confirmLabel="Remove source"
        tone="danger"
      />
    </div>
  )
}
