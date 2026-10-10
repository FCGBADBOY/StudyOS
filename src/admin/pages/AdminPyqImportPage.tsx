/**
 * Admin → PYQ bulk import.
 *
 * This screen is deliberately a three-step review flow rather than a "pick a
 * file and hope" uploader, because a bad import is expensive to undo:
 *
 *   1. Choose a file (CSV or JSON) and parse it locally.
 *   2. Review a row-by-row validation table — every row shows either its
 *      resolved hierarchy or the exact reason it was rejected, plus a
 *      "possible duplicate" flag when it resembles an existing question.
 *   3. Confirm, choosing whether to skip the flagged duplicates.
 *
 * Nothing is written until step 3. Duplicate detection is advisory: rows are
 * flagged, never merged or deleted automatically, because similarity is not
 * proof. Every insertion is independent, so a single rejected row is reported
 * by line number rather than failing the whole batch.
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileUp, RotateCcw } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  LinkButton,
  PageHeader,
  ProgressBar,
} from '@/components/ui'
import { useToast } from '@/context/AppProvider'
import { Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import {
  IMPORT_COLUMNS,
  insertImportedQuestions,
  parseCsv,
  validateImport,
  type ImportPreview,
  type ParsedRow,
} from '../services/adminPyq.service'
import { importPyqJson, type JsonImportOutcome } from '../services/adminPyqImport.service'

const ACCEPT = '.csv,.json,text/csv,application/json'

export default function AdminPyqImportPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { role } = useAdminSession()
  const inputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [importing, setImporting] = useState(false)
  const [outcome, setOutcome] = useState<JsonImportOutcome | null>(null)

  const editable = can(role, 'pyq.import')

  const importable = useMemo(
    () =>
      preview
        ? preview.rows.filter(
            (row) => row.errors.length === 0 && row.draft && (!skipDuplicates || !row.duplicateOf),
          )
        : [],
    [preview, skipDuplicates],
  )

  async function handleFile(file: File) {
    setFileName(file.name)
    setParseError(null)
    setOutcome(null)
    setPreview(null)
    setParsing(true)

    try {
      const text = await file.text()

      if (file.name.toLowerCase().endsWith('.json')) {
        const json = await importPyqJson(text)
        setOutcome(json.outcome)
        setPreview(json.preview)
        if (json.outcome.added === 0 && json.outcome.failed > 0) {
          setParseError('No rows could be imported. Check the errors below.')
        }
      } else {
        const { records } = parseCsv(text)
        if (records.length === 0) {
          setParseError('That file has no data rows. A header row is required.')
        } else {
          setPreview(await validateImport(records))
        }
      }
    } catch (caught) {
      setParseError(caught instanceof Error ? caught.message : 'We could not read that file.')
    } finally {
      setParsing(false)
    }
  }

  async function runImport() {
    if (!preview) return
    setImporting(true)
    try {
      const result = await insertImportedQuestions(preview, { skipDuplicates })
      toast({
        title: `${result.inserted} question${result.inserted === 1 ? '' : 's'} imported`,
        description:
          result.failed.length > 0
            ? `${result.failed.length} row${result.failed.length === 1 ? '' : 's'} could not be inserted.`
            : undefined,
        variant: result.failed.length > 0 ? 'warning' : 'success',
      })
      navigate('/admin/content/pyq')
    } catch (caught) {
      toast({
        title: 'Import failed',
        description: caught instanceof Error ? caught.message : undefined,
        variant: 'danger',
      })
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setFileName(null)
    setPreview(null)
    setOutcome(null)
    setParseError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back="/admin/content/pyq"
        title="Bulk import questions"
        subtitle="Upload a CSV or JSON export and review every row before it is written."
      />

      {!editable && (
        <Notice tone="warning" title="Read-only access">
          Your role cannot import questions. You can review the validation results, but the import
          button stays disabled.
        </Notice>
      )}

      {/* ------------------------------------------------------ step 1 */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">1. Choose a file</h2>
        <p className="mt-1 text-sm text-muted">
          Accepted columns: <span className="font-mono text-xs">{IMPORT_COLUMNS.join(', ')}</span>
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
            }}
            className="block w-full cursor-pointer rounded-control border border-border bg-surface
                       text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-control
                       file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm
                       file:font-medium file:text-foreground
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            aria-label="Choose a CSV or JSON file to import"
          />
          {(preview || outcome) && (
            <Button variant="ghost" onClick={reset} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
              Start over
            </Button>
          )}
        </div>

        {fileName && !parseError && !preview && !outcome && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <FileUp className="size-4" aria-hidden="true" />
            Reading {fileName}…
          </p>
        )}
        {parsing && <div className="mt-4"><ProgressBar value={60} label="Validating rows…" /></div>}
      </Card>

      {parseError && <Notice tone="danger" title="Nothing imported">{parseError}</Notice>}

      {/* ---------------------------------------------------- summary */}
      {preview && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">2. Review the results</h2>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile tone="brand" value={preview.rows.length} label="Rows read" />
            <SummaryTile tone="success" value={preview.validCount} label="Valid" />
            <SummaryTile tone="danger" value={preview.errorCount} label="Rejected" />
            <SummaryTile tone="warning" value={preview.duplicateCount} label="Possible duplicates" />
          </div>

          {preview.unknownColumns.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Ignored unknown column{preview.unknownColumns.length === 1 ? '' : 's'}:{' '}
              <span className="font-mono text-xs">{preview.unknownColumns.join(', ')}</span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Checkbox
              checked={skipDuplicates}
              onChange={setSkipDuplicates}
              label="Skip possible duplicates"
              description="Flagged rows are left out of the import. They are never deleted."
            />
            <span className="text-sm text-muted" aria-live="polite">
              {importable.length} row{importable.length === 1 ? '' : 's'} will be imported.
            </span>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------ row-by-row */}
      {preview && preview.rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Row details</h2>
          </div>
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
            {preview.rows.map((row) => (
              <ImportRow key={row.line} row={row} />
            ))}
          </ul>
        </Card>
      )}

      {/* ---------------------------------------------------- outcome */}
      {outcome && (
        <Notice tone={outcome.failed > 0 ? 'warning' : 'success'} title="Import finished">
          {outcome.added} added, {outcome.skipped} skipped, {outcome.failed} failed.
        </Notice>
      )}

      {/* -------------------------------------------------------- CTA */}
      {preview && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={runImport}
            loading={importing}
            disabled={!editable || importable.length === 0}
          >
            Import {importable.length} question{importable.length === 1 ? '' : 's'}
          </Button>
          <LinkButton to="/admin/content/pyq" variant="ghost">
            Cancel
          </LinkButton>
        </div>
      )}

      {!preview && !parseError && (
        <p className="text-sm text-muted">
          Nothing is uploaded until you press Import. You will see a full preview first.
        </p>
      )}
    </div>
  )
}

function SummaryTile({
  tone,
  value,
  label,
}: {
  tone: 'brand' | 'success' | 'danger' | 'warning'
  value: number
  label: string
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand-soft-fg',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
  } as const

  return (
    <div className={`rounded-card p-3 ${tones[tone]}`}>
      <p className="text-xl font-semibold tabular">{value.toLocaleString('en-IN')}</p>
      <p className="text-xs opacity-90">{label}</p>
    </div>
  )
}

function ImportRow({ row }: { row: ParsedRow }) {
  const invalid = row.errors.length > 0
  const duplicate = Boolean(row.duplicateOf)

  return (
    <li className={`px-5 py-3 ${invalid ? 'bg-danger-soft/30' : duplicate ? 'bg-warning-soft/30' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-xs font-medium tabular text-faint">L{row.line}</span>

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm text-foreground">
            {row.raw.question?.trim() || <span className="text-faint italic">No question text</span>}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            {invalid ? (
              <span className="flex items-center gap-1 text-danger">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                {row.errors.join('; ')}
              </span>
            ) : (
              <>
                <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
                <span>
                  {row.raw.board} · {row.raw.class}
                  {row.raw.subject ? ` · ${row.raw.subject}` : ''}
                  {row.raw.chapter ? ` · ${row.raw.chapter}` : ''}
                </span>
                <Badge variant="neutral">{row.raw.year}</Badge>
              </>
            )}

            {duplicate && !invalid && (
              <Badge variant="warning">{row.duplicateOf?.label ?? 'Possible duplicate'}</Badge>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

/** Kept for parity with the analytics screens that surface import failures. */
export { ErrorState }
