import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LoadingState } from '@/components/ui'
import { usePaper, useSubject } from '@/hooks'
import PyqPaperPage from './PyqPaperPage'
import PyqSubjectPage from './PyqSubjectPage'

/** The first render happens before a query subscribes — read it as loading. */
function isPending(query: { data: unknown; error: string | null; source: string | undefined }): boolean {
  return query.data === undefined && !query.error && !query.source
}

/**
 * Single-segment resolver for `/pyq/:slug`.
 *
 * The same URL space holds subject ids (`/pyq/chemistry`) and full paper slugs
 * (`/pyq/2025-cbse-physics-set-1`), so the slug is matched against the paper
 * archive first (slugs are unique), then against the subject list. Anything
 * else bounces back to the PYQ Intelligence home exactly once.
 *
 * Both lookups are served by the data layer, so the resolution waits for the
 * queries instead of guessing on the first paint.
 */
export default function PyqRoutePage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const paperQuery = usePaper(slug)
  const subjectQuery = useSubject(slug)

  const loading =
    paperQuery.loading ||
    subjectQuery.loading ||
    (Boolean(slug) && (isPending(paperQuery) || isPending(subjectQuery)))
  const isPaper = Boolean(paperQuery.data)
  const isSubject = !isPaper && Boolean(subjectQuery.data)

  useEffect(() => {
    if (loading || isPaper || isSubject) return
    navigate('/pyq', { replace: true })
  }, [loading, isPaper, isSubject, navigate])

  if (loading) return <LoadingState label="Opening" />
  if (isPaper) return <PyqPaperPage />
  if (isSubject) return <PyqSubjectPage />
  return null
}
