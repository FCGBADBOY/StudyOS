/**
 * Source adapter registry.
 *
 * This is the *only* place that maps a board (or an approved repository) onto
 * an adapter. Nothing else in StudyOS may branch on board identity — that is
 * the whole point of the adapter layer (spec §6).
 *
 *   const adapter = getSourceAdapter(boardSlug)
 *   if (adapter) { … } else { … generic path … }
 *
 * Looking a source up by its registered domain works the same way, so a
 * `source_registry` row automatically gets the behaviour that matches it.
 */
import type { BoardSourceAdapter } from './base-source'
import { cbseAdapter } from './cbse'
import { icseAdapter } from './icse'
import { iscAdapter } from './isc'
import { wbchseAdapter } from './wbchse'
import { genericOpenSourceAdapter } from './generic-open-source'
import { STATE_BOARD_ADAPTERS } from './state-boards'

/** Every adapter the engine knows, in registration order. */
export const SOURCE_ADAPTERS: readonly BoardSourceAdapter[] = [
  cbseAdapter,
  icseAdapter,
  iscAdapter,
  wbchseAdapter,
  ...STATE_BOARD_ADAPTERS,
  genericOpenSourceAdapter,
]

const BY_BOARD = new Map<string, BoardSourceAdapter>(
  SOURCE_ADAPTERS.map((adapter) => [adapter.boardSlug, adapter]),
)

const BY_ID = new Map<string, BoardSourceAdapter>(SOURCE_ADAPTERS.map((adapter) => [adapter.id, adapter]))

/**
 * Adapter for a board slug (`cbse`, `isc`, `wbchse`, …).
 *
 * Falls back to the generic open-source adapter only when the slug is
 * explicitly `generic`; an unknown board returns `null` so the caller reports
 * "no adapter configured for this board" instead of silently crawling
 * something with the wrong rules.
 */
export function getSourceAdapter(boardSlug: string | null | undefined): BoardSourceAdapter | null {
  if (!boardSlug) return null
  const key = boardSlug.trim().toLowerCase()
  return BY_BOARD.get(key) ?? null
}

/** Adapter by its stable id (matches `source_registry` rows). */
export function getSourceAdapterById(id: string | null | undefined): BoardSourceAdapter | null {
  if (!id) return null
  return BY_ID.get(id.trim().toLowerCase()) ?? null
}

/**
 * Adapter whose approved domains contain `domain`.
 *
 * Used when the worker only has a URL (a link found on an already-approved
 * page) and needs to know whether that host is allowed at all.
 */
export function adapterForDomain(domain: string): BoardSourceAdapter | null {
  const host = domain.replace(/^www\./, '').toLowerCase()
  return (
    SOURCE_ADAPTERS.find((adapter) =>
      adapter.domains.some((entry) => {
        const clean = entry.replace(/^www\./, '').toLowerCase()
        return host === clean || host.endsWith(`.${clean}`)
      }),
    ) ?? null
  )
}

/** Boards with an adapter, for the admin "add source" picker. */
export function listAdapterChoices(): Array<{
  id: string
  boardSlug: string
  label: string
  boardName: string
  description: string
  domains: string[]
}> {
  return SOURCE_ADAPTERS.map((adapter) => ({
    id: adapter.id,
    boardSlug: adapter.boardSlug,
    label: adapter.label,
    boardName: adapter.boardName,
    description: adapter.description,
    domains: [...adapter.domains],
  }))
}

/** Is this host approved for crawling, by any adapter? */
export function isApprovedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return SOURCE_ADAPTERS.some((adapter) =>
      adapter.domains.some((entry) => {
        const clean = entry.replace(/^www\./, '').toLowerCase()
        return host === clean || host.endsWith(`.${clean}`)
      }),
    )
  } catch {
    return false
  }
}
