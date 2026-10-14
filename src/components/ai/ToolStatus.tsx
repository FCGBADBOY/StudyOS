/**
 * Status line under a streaming answer: which internal tools ran, whether the
 * answer was grounded in StudyOS content, and an honest warning when it was
 * not.
 *
 * Visual treatment: one calm cream band inside the assistant message. Every
 * row is informational, never alarming — the "not grounded" notice is a warm
 * amber callout rather than a red panel, because it is a caveat, not a crash.
 */
import { AlertTriangle, Library, ShieldCheck } from 'lucide-react'
import { themeColors } from '@/config/visual'
import { cn } from '@/utils/cn'
import { toolDetail, toolLabel } from '@/ai/tools/catalog'
import type { ResponseMeta } from '@/ai/types'

const AI = themeColors('ai')
const WARNING = themeColors('warning')
const SUCCESS = themeColors('success')

export function ToolStatus({ meta, status }: { meta: ResponseMeta | null; status?: string | null }) {
  const tools = meta?.tools ?? []
  const showStatus = Boolean(status) && !tools.length

  if (!meta && !showStatus) return null

  return (
    <div className="mt-3 space-y-2 rounded-tile bg-cream px-3 py-2.5">
      {showStatus && status && (
        <p className="flex items-center gap-2 text-[12px] font-medium text-muted">
          <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 animate-pulse rounded-full', AI.solid)} />
          <span className="min-w-0 break-words">{status}</span>
        </p>
      )}

      {tools.length > 0 && (
        <ul role="list" className="flex flex-wrap gap-x-3 gap-y-1.5">
          {tools.map((tool) => (
            <li key={tool} className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
              <ShieldCheck aria-hidden className={cn('h-3.5 w-3.5 shrink-0', SUCCESS.solid)} />
              <span className="font-semibold text-foreground">{toolLabel(tool)}</span>
              {toolDetail(tool) && <span className="text-faint">· {toolDetail(tool)}</span>}
            </li>
          ))}
        </ul>
      )}

      {meta?.retrievalUsed && meta.grounded && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-muted">
          <Library aria-hidden className="h-3.5 w-3.5 shrink-0 text-faint" />
          <span className="min-w-0">
            Answered from {meta.subject ?? 'your'} {meta.chapter ? `· ${meta.chapter}` : 'library'}
          </span>
          {typeof meta.confidence === 'number' && (
            <span className="tabular font-semibold text-faint">
              · {Math.round(meta.confidence * 100)}% confidence
            </span>
          )}
        </p>
      )}

      {meta && !meta.grounded && (
        <p
          className={cn(
            'flex items-start gap-2 rounded-tile border-l-[3px] px-2.5 py-2',
            'text-[11.5px] leading-snug text-foreground',
            WARNING.soft,
          )}
          style={{ borderLeftColor: 'var(--warning)' }}
        >
          <AlertTriangle aria-hidden className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', WARNING.onSoft)} />
          <span className="min-w-0">
            Nothing in your StudyOS library matched this exactly — this answer comes from general knowledge, so
            double-check it against your textbook.
          </span>
        </p>
      )}
    </div>
  )
}
