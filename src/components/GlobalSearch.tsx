import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, ClipboardList, FileText, FlaskConical, Hash, Search, Sigma, X } from 'lucide-react'
import { fadeUp, searchIn, searchOut, staggerIn } from '@/animations'
import { useApp } from '@/context/AppProvider'
import { SEARCH_CATEGORIES, searchIndex } from '@/data/search'
import { Chip, EmptyState, IconButton } from '@/components/ui'
import { useDebouncedValue } from '@/hooks'
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
        className="relative flex max-h-[100dvh] w-full flex-col bg-background shadow-pop sm:mx-auto sm:mt-[8vh] sm:h-fit sm:max-h-[80dvh] sm:max-w-2xl sm:rounded-card sm:border sm:border-border"
      >
        {/* Search field */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-3 sm:rounded-t-card">
          <span aria-hidden className="pl-1 text-faint [&_svg]:h-[18px] [&_svg]:w-[18px]">
            <Search />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Search notes, PYQs, formulas, chapters"
            placeholder="Search notes, PYQs, formulas, chapters…"
            className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-faint"
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

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2.5 no-scrollbar sm:rounded-t-none">
          {SEARCH_CATEGORIES.map((item) => {
            const CatIcon = CATEGORY_ICON[item]
            return (
              <Chip
                key={item}
                selected={category === item}
                onClick={() => setCategory(item)}
                className="shrink-0 text-[13px]"
                icon={<CatIcon />}
              >
                {item}
              </Chip>
            )
          })}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {showRecents && recentSearches.length > 0 && (
            <section aria-labelledby="recent-heading" className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="recent-heading" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
                  Recent searches
                </h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="rounded-control px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <li key={term}>
                    <Chip onClick={() => useRecent(term)} className="text-[13px]">
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
              <ul className="space-y-1.5">
                {results.map((result) => {
                  const ResultIcon = RESULT_ICON[result.category]
                  return (
                    <li key={result.id} data-search-row>
                      <button
                        type="button"
                        onClick={() => go(result)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-tile border border-transparent bg-surface px-3 py-3 text-left outline-none',
                          'transition-colors duration-150 hover:border-border hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-ring',
                        )}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg [&_svg]:h-[17px] [&_svg]:w-[17px]"
                        >
                          <ResultIcon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{result.title}</span>
                            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                              {result.category}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-muted">{result.meta}</span>
                          <span className="mt-1 block clamp-2 text-[12.5px] leading-snug text-faint">
                            {result.snippet}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="mt-2 h-4 w-4 shrink-0 text-faint" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div ref={emptyRef}>
                <EmptyState
                  icon={<Search />}
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
        <div className="hidden items-center justify-between border-t border-border bg-surface px-4 py-2.5 text-[11.5px] text-faint sm:flex">
          <span>
            <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans">esc</kbd> to close
          </span>
          <span className="flex items-center gap-1">
            <Icon aria-hidden className="h-3.5 w-3.5" />
            Searching in {category === 'All' ? 'everything' : category}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

