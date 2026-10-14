/**
 * StudyOS Autonomous Academic Content Engine — public surface.
 *
 * Two halves, one vocabulary (see the migration for the schema and
 * `supabase/functions/content-engine` for the worker):
 *
 *   A. GENERATE  syllabus → chapter map → original, class-aware notes
 *   B. COLLECT   discover → verify → import *or* link → classify → dedupe
 *
 * Everything exported from here is pure (except `api.ts`), so it can run in
 * the browser for previews and inside the Deno worker for the real work.
 *
 * NOTE `api.ts` is intentionally NOT re-exported: importing it pulls in the
 * Supabase client, and the edge worker must never do that.
 */

export * from './types'
export * from './license'
export * from './validation'
export * from './dedupe'
export * from './jobs'
export * from './analytics'
export * from './prompts'

export {
  CRAWL_LIMITS,
  absolutise,
  detectSession,
  extractHrefs,
  hostOf,
  isAllowedDomain,
  matchesPatterns,
  newestSession,
  textOf,
  type AdapterSession,
  type AdapterContext,
  type BoardSourceAdapter,
  type DiscoveryTarget,
  type FetchOutcome,
  type PaperFilter,
  type UrlPattern,
} from './sources/base-source'

export {
  SOURCE_ADAPTERS,
  adapterForDomain,
  getSourceAdapter,
  getSourceAdapterById,
  isApprovedDomain,
  listAdapterChoices,
} from './sources/registry'

export { cbseAdapter } from './sources/cbse'
export { icseAdapter } from './sources/icse'
export { iscAdapter } from './sources/isc'
export { wbchseAdapter } from './sources/wbchse'
export { genericOpenSourceAdapter } from './sources/generic-open-source'
export { STATE_BOARD_ADAPTERS } from './sources/state-boards'
