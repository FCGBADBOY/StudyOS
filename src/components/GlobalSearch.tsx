import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, ClipboardList, FileText, FlaskConical, Hash, Search, Sigma, X } from 'lucide-react'
import { fadeUp, searchIn, searchOut, staggerIn } from '@/animations'
import { useApp } from '@/context/AppProvider'
import { SEARCH_CATEGORIES, searchIndex } from '@/data/search'
import { BackgroundArt, Badge, Chip, EmptyState, IconTile, IconButton } from '@/components/ui'
import { useDebouncedValue } from '@/hooks'
import type { ThemeKey } from '@/config/visual'
import type { SearchCategory, SearchResult } from '@/types'
import { cn } from '@/utils/cn'

const CATEGORY_ICON: Record<SearchCategory, typeof FileText> = {
  All: Search,
  Notes: FileText,
  PYQs: ClipboardList,
  Formulas: Sigma,
  Questions: FlaskConical,
  Chapters: BookOpen,
}

const RESULT_ICON: Record<SearchCategory, typeof FileText> = {
  All: Hash,
  Notes: FileText,
  PYQs: ClipboardList,
  Formulas: Sigma,
  Questions: FlaskConical,
  Chapters: BookOpen,
}

/**
 * Every category owns a theme, so a result is recognisable by its colour and
 * tile before the label is read — the same vocabulary the Library uses.
 */
const CATEGORY_THEME: Record<SearchCategory, ThemeKey> = {
  All: 'search',
  Notes: 'notes',
  PYQs: 'pyq',
  Formulas: 'formula',
  Questions: 'quiz',
  Chapters: 'library',
}

/**
 * Global full-screen search (⌘K / Ctrl+K or the search field).
 * Categories, recent searches, live results and a proper empty state.
 */
export function GlobalSearch() {
  const { searchOpen, closeSearch, recentSearches, addRecentSearch, clearRecentSearches } = useApp()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<SearchCategory>('All')
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const emptyRef = useRef<HTMLDivElement>(null)
  const debounced = useDebouncedValue(query, 140)

  const results = useMemo(() => searchIndex(debounced, category), [debounced, category])

  useEffect(() => {
    if (searchOpen) setMounted(true)
  }, [searchOpen])

  /* Entrance + exit motion, body scroll lock, focus management. */
  useLayoutEffect(() => {
    if (!mounted) return
    const stopIn = searchIn(panelRef.current)
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSearch()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      stopIn()
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mounted, closeSearch])

  useEffect(() => {
    if (mounted && !searchOpen) {
      searchOut(panelRef.current, () => {
        setMounted(false)
        setQuery('')
        setCategory('All')
      })
    }
  }, [searchOpen, mounted])

  /* Stagger the result rows whenever the result set changes. */
  useLayoutEffect(() => {
    if (!mounted || !resultsRef.current) return
    if (!results.length) return fadeUp(emptyRef.current)
    return staggerIn(resultsRef.current.querySelectorAll('[data-search-row]'), { step: 34, distance: 10 })
  }, [mounted, results.length, category, debounced])

  const go = (result: SearchResult) => {
    addRecentSearch(debounced.trim() || result.title)
    closeSearch()
    navigate(result.to)
  }

  const useRecent = (term: string) => {
    setQuery(term)
    inputRef.current?.focus()
  }

  if (!mounted) return null

  const showRecents = debounced.trim().length === 0
  const Icon = CATEGORY_ICON[category]

  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col" role="dialog" aria-modal="true" aria-label="Search StudyOS">
      <div className="absolute inset-0 bg-overlay" aria-hidden onClick={closeSearch} />

      <div
        ref={panelRef}
        className="relative isolate flex max-h-[100dvh] w-full flex-col overflow-hidden bg-cream shadow-pop sm:mx-auto sm:mt-[7vh] sm:h-fit sm:max-h-[82dvh] sm:max-w-2xl sm:rounded-hero"
      >
        {/* Warm light behind the sheet so it never reads as a grey slab. */}
        <BackgroundArt theme="brand" intensity="faint" variant="band" className="-z-10" />

        {/* Search field + categories — the white header block */}
        <div className="relative shrink-0 border-b border-border bg-surface px-3 pt-3 pb-1 sm:px-4">
          <div className="flex items-center gap-2.5">
            <IconTile icon={<Search />} theme="search" size="sm" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="Search notes, PYQs, formulas, chapters"
              placeholder="Search notes, PYQs, formulas, chapters…"
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:font-normal placeholder:text-faint"
            />
            {query && (
              <IconButton label="Clear search" size="sm" onClick={() => setQuery('')}>
                <X />
              </IconButton>
            )}
            <IconButton label="Close search" size="sm" onClick={closeSearch} className="hidden sm:inline-flex">
              <X />
            </IconButton>
          </div>

          {/* Categories — a themed tile per scope, filterable in one tap */}
          <div className="flex gap-1 overflow-x-auto py-1.5 no-scrollbar">
            {SEARCH_CATEGORIES.map((item) => {
              const CatIcon = CATEGORY_ICON[item]
              const active = category === item
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(item)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-control px-2 py-1.5 text-[13px] font-semibold outline-none transition-colors duration-150',
                    'focus-visible:ring-2 focus-visible:ring-brand-ring',
                    active
                      ? 'bg-cream text-foreground shadow-card'
                      : 'text-muted hover:bg-surface-muted hover:text-foreground',
                  )}
                >
                  <IconTile
                    icon={<CatIcon />}
                    theme={CATEGORY_THEME[item]}
                    size="xs"
                    variant={active ? 'gradient' : 'soft'}
                  />
                  <span>{item}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Body — recents and result groups on the warm ground */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          {showRecents && recentSearches.length > 0 && (
            <section aria-labelledby="recent-heading" className="mb-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 id="recent-heading" className="eyebrow">
                  Recent searches
                </h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="rounded-control px-2.5 py-1.5 text-[12px] font-semibold text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  Clear
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <li key={term}>
                    <Chip onClick={() => useRecent(term)} className="bg-surface text-[13px]">
                      {term}
                    </Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="results-heading" ref={resultsRef}>
            <h2 id="results-heading" className="sr-only">
              Results
            </h2>
            {results.length > 0 ? (
              <ul className="space-y-2">
                {results.map((result) => {
                  const ResultIcon = RESULT_ICON[result.category]
                  const tone = CATEGORY_THEME[result.category]
                  return (
                    <li key={result.id} data-search-row>
                      <button
                        type="button"
                        onClick={() => go(result)}
                        className={cn(
                          'group flex w-full items-start gap-3 rounded-card bg-surface px-3 py-3 text-left shadow-card outline-none',
                          'transition-shadow duration-150 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring',
                        )}
                      >
                        <IconTile icon={<ResultIcon />} theme={tone} size="md" variant="soft" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{result.title}</span>
                            <Badge theme={tone} uppercase className="shrink-0">
                              {result.category}
                            </Badge>
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-muted">{result.meta}</span>
                          <span className="mt-1 block clamp-2 text-[12.5px] leading-snug text-muted">
                            {result.snippet}
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden
                          className="mt-2 h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div ref={emptyRef}>
                <EmptyState
                  illustration="empty"
                  theme="search"
                  title={`No results for “${debounced.trim() || category}”`}
                  description="Try a different spelling, or switch categories — notes, PYQs, formulas, questions and chapters are all searchable."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Chip onClick={() => setCategory('All')}>Search everything</Chip>
                      <Chip onClick={() => setQuery('')}>Reset search</Chip>
                    </div>
                  }
                />
              </div>
            )}
          </section>
        </div>

        {/* Footer hint */}
        <div className="hidden items-center justify-between border-t border-border bg-surface px-4 py-2.5 text-[11.5px] text-muted sm:flex">
          <span>
            <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans">esc</kbd> to close
          </span>
          <span className="flex items-center gap-1.5">
            <IconTile icon={<Icon />} theme={CATEGORY_THEME[category]} size="xs" />
            Searching in {category === 'All' ? 'everything' : category}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
