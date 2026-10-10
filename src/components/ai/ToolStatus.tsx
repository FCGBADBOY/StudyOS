/**
 * Status line under a streaming answer: which internal tools ran, whether the
 * answer was grounded in StudyOS content, and an honest warning when it was
 * not.
 */
import { AlertTriangle, Library, ShieldCheck } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toolDetail, toolLabel } from '@/ai/tools/catalog'
import type { ResponseMeta } from '@/ai/types'

export function ToolStatus({ meta, status }: { meta: ResponseMeta | null; status?: string | null }) {
  const tools = meta?.tools ?? []
  const showStatus = Boolean(status) && !tools.length

  if (!meta && !showStatus) return null

  return (
    <div className="mt-3 space-y-1.5 pl-2">
      {showStatus && status && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-brand-soft-fg">
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
          {status}
        </p>
      )}

      {tools.length > 0 && (
        <ul role="list" className="flex flex-wrap gap-x-3 gap-y-1">
          {tools.map((tool) => (
            <li key={tool} className="flex items-center gap-1 text-[11px] text-muted">
              <ShieldCheck aria-hidden className="h-3 w-3 text-success" />
              <span className="font-medium">{toolLabel(tool)}</span>
              {toolDetail(tool) && <span className="text-faint">· {toolDetail(tool)}</span>}
            </li>
          ))}
        </ul>
      )}

      {meta?.retrievalUsed && meta.grounded && (
        <p className="flex items-center gap-1.5 text-[11px] text-faint">
          <Library aria-hidden className="h-3 w-3" />
          Answered from {meta.subject ?? 'your'} {meta.chapter ? `· ${meta.chapter}` : 'library'}
          {typeof meta.confidence === 'number' && (
            <span className="tabular">· {Math.round(meta.confidence * 100)}% confidence</span>
          )}
        </p>
      )}

      {meta && !meta.grounded && (
        <p
          className={cn(
            'flex items-start gap-1.5 rounded-tile border border-warning/50 bg-warning-soft px-2 py-1.5',
            'text-[11px] leading-snug text-foreground',
          )}
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
          <span>
            Nothing in your StudyOS library matched this exactly — this answer comes from general knowledge, so
            double-check it against your textbook.
          </span>
        </p>
      )}
    </div>
  )
}
