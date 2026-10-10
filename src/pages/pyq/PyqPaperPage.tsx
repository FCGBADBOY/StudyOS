import { useParams } from 'react-router-dom'
import { CalendarRange, Clock, Download, Hash, Layers, ListChecks, Share2 } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LinkButton,
  PageHeader,
  SectionHeader,
  SkeletonList,
} from '@/components/ui'
import { QuestionCard } from '@/components/QuestionCard'
import { usePaper, useStagger } from '@/hooks'
import { useToast } from '@/context/AppProvider'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'

/** The first render happens before a query subscribes — read it as loading. */
function isPending(query: { data: unknown; error: string | null; source: string | undefined }): boolean {
  return query.data === undefined && !query.error && !query.source
}

/* ---------------------------------- page ----------------------------------- */

export default function PyqPaperPage() {
  const params = useParams<{ subject?: string; paper?: string; slug?: string }>()
  const { toast } = useToast()

  /* The paper slug can arrive as `paper`, as a single-segment `slug`, or (for
     legacy deep links) in the `subject` slot — resolve whichever is present. */
  const paperSlug = params.paper ?? params.slug ?? params.subject
  const paperQuery = usePaper(paperSlug)
  const paper = paperQuery.data
  const loading = Boolean(paperSlug) && (paperQuery.loading || isPending(paperQuery))

  const metaRef = useStagger<HTMLDivElement>({ step: 60, distance: 14 })
  const questionsRef = useStagger<HTMLDivElement>({ step: 55, distance: 14 })

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <SkeletonList count={4} label="Loading paper" />
      </div>
    )
  }

  if (paperQuery.error && !paper) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          back="/pyq"
          title="Paper unavailable"
          subtitle="We could not open that paper right now."
        />
        <ErrorState
          title="We could not open that paper"
          description="Check your connection and try again — the PYQ Intelligence home lists every paper we have scanned."
          onRetry={paperQuery.refetch}
        />
      </div>
    )
  }

  if (!paper) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          back="/pyq"
          title="Paper not found"
          subtitle="This paper is not part of the scanned archive."
        />
        <EmptyState
          title="We could not open that paper"
          description="The link may be out of date. The PYQ Intelligence home lists every paper we have scanned."
          action={<LinkButton to="/pyq">Back to PYQ Intelligence</LinkButton>}
        />
      </div>
    )
  }

  const accent = subjectAccent(paper.subjectId)

  const meta = [
    { label: 'Year', value: paper.year, hint: `${paper.board} session`, icon: <CalendarRange /> },
    { label: 'Duration', value: paper.duration, hint: 'Full paper', icon: <Clock /> },
    { label: 'Total marks', value: paper.marks, hint: 'Maximum score', icon: <Hash /> },
    {
      label: 'Sections',
      value: paper.sections.length,
      hint: `${paper.questions.length} questions`,
      icon: <Layers />,
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        back="/pyq"
        title={`${paper.year} CBSE ${paper.subjectName} — ${paper.set}`}
        subtitle={`Full paper · ${paper.duration} · ${paper.marks} marks`}
        actions={
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize',
              accent.soft,
              accent.text,
            )}
          >
            {paper.classId.replace('-', ' ')}
          </span>
        }
      />

      {/* ------------------------------ paper meta ----------------------------- */}
      <section aria-label="Paper details">
        <div ref={metaRef} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {meta.map((item) => (
            <Card key={item.label} padded>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                    {item.label}
                  </p>
                  <p className="tabular mt-2 text-xl font-bold leading-none text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-2 text-[12px] leading-snug text-muted">{item.hint}</p>
                </div>
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg [&_svg]:h-[18px] [&_svg]:w-[18px]"
                >
                  {item.icon}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------- sections ------------------------------ */}
      <section aria-labelledby="sections-heading">
        <SectionHeader
          id="sections-heading"
          title="Paper sections"
          subtitle="How the marks are distributed across the paper"
        />
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <div className="hidden grid-cols-[1fr_1.2fr_1fr] gap-3 border-b border-border bg-surface-muted px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint sm:grid">
            <span>Section</span>
            <span>Questions</span>
            <span>Marks</span>
          </div>
          <ul>
            {paper.sections.map((section) => (
              <li
                key={section.name}
                className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_1.2fr_1fr] sm:items-center sm:gap-3"
              >
                <span className="text-sm font-semibold text-foreground">{section.name}</span>
                <span className="text-[13px] text-muted">
                  <span className="mr-1 font-semibold text-faint sm:hidden">Questions</span>
                  {section.questions}
                </span>
                <span className="tabular text-[13px] text-muted">
                  <span className="mr-1 font-semibold text-faint sm:hidden">Marks</span>
                  {section.marks}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------- questions ----------------------------- */}
      <section aria-labelledby="paper-questions-heading">
        <SectionHeader
          id="paper-questions-heading"
          title="Questions"
          subtitle="Every item from this set, with concept tags and outlines"
        />
        <div ref={questionsRef} className="grid gap-3">
          {paper.questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              onSave={() =>
                toast({
                  title: 'Added to MistakeBook',
                  description: `${question.chapter} · CBSE ${question.year}`,
                  variant: 'success',
                })
              }
            />
          ))}
        </div>
      </section>

      {/* -------------------------------- actions ------------------------------ */}
      <section aria-label="Paper actions">
        <Card padded className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            icon={<ListChecks />}
            className="sm:flex-1"
            onClick={() =>
              toast({
                title: 'Added to practice queue',
                description: `${paper.questions.length} questions from ${paper.year} ${paper.subjectName} — ${paper.set}`,
                variant: 'success',
              })
            }
          >
            Add all to practice queue
          </Button>
          <Button
            variant="secondary"
            icon={<Download />}
            className="sm:flex-1"
            onClick={() =>
              toast({
                title: 'Download started — available offline',
                description: `${paper.year} ${paper.subjectName} · ${paper.set}`,
                variant: 'default',
              })
            }
          >
            Download PDF
          </Button>
          <IconButton
            label="Share this paper"
            variant="outline"
            className="self-start sm:self-auto"
            onClick={() =>
              toast({
                title: 'Link copied',
                description: 'Share it with your study group.',
                variant: 'success',
              })
            }
          >
            <Share2 />
          </IconButton>
        </Card>
      </section>
    </div>
  )
}
