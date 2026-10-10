/**
 * Admin → Academic → Structure overview.
 *
 * The hierarchy runs Board → Class → Stream → Subject → Chapter, and every
 * resource or question ultimately points at a chapter. That chain is what lets
 * one database serve any board, class or stream — nothing is hard-coded to a
 * single curriculum, so adding ICSE or a Commerce stream is data entry rather
 * than a schema change.
 *
 * This hub is deliberately just counts and links: the editing happens on the
 * five focused screens below it, each of which owns one level.
 */
import { ArrowRight, BookOpen, Layers, Library, GraduationCap, Split, Boxes } from 'lucide-react'
import { Card, LinkButton, PageHeader, SkeletonCard } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can } from '../lib/permissions'
import {
  listBoards,
  listChapters,
  listClasses,
  listStreams,
  listSubjects,
} from '../services/adminAcademic.service'

const LEVELS = [
  {
    href: '/admin/academic/boards',
    label: 'Boards',
    icon: GraduationCap,
    blurb: 'CBSE, ICSE, state boards — the top of the tree.',
  },
  {
    href: '/admin/academic/classes',
    label: 'Classes',
    icon: Layers,
    blurb: 'Class 9–12. Senior classes unlock streams.',
  },
  {
    href: '/admin/academic/streams',
    label: 'Streams',
    icon: Split,
    blurb: 'Science, Commerce, Humanities for senior classes.',
  },
  {
    href: '/admin/academic/subjects',
    label: 'Subjects',
    icon: Library,
    blurb: 'Physics, Chemistry, Maths — attached to a class.',
  },
  {
    href: '/admin/academic/chapters',
    label: 'Chapters',
    icon: BookOpen,
    blurb: 'Where resources and questions actually attach.',
  },
] as const

export default function AdminAcademicPage() {
  const { role, loading: sessionLoading } = useAdminSession()
  const mayView = can(role, 'academic.view')

  const enabled = !sessionLoading && mayView
  const boards = useQuery('admin:academic:hub:boards', () => listBoards(true), { enabled })
  const classes = useQuery('admin:academic:hub:classes', () => listClasses(true), { enabled })
  const streams = useQuery('admin:academic:hub:streams', () => listStreams(true), { enabled })
  const subjects = useQuery('admin:academic:hub:subjects', () => listSubjects(true), { enabled })
  const chapters = useQuery('admin:academic:hub:chapters', () => listChapters(true), { enabled })

  const counts = [boards, classes, streams, subjects, chapters]
  const loading = counts.some((entry) => entry.loading)

  /* Resolved per level so the union of array types never has to be narrowed. */
  const totals = [
    { total: boards.data?.length ?? 0, archived: (boards.data ?? []).filter((row) => row.is_archived).length },
    { total: classes.data?.length ?? 0, archived: (classes.data ?? []).filter((row) => row.is_archived).length },
    { total: streams.data?.length ?? 0, archived: (streams.data ?? []).filter((row) => row.is_archived).length },
    { total: subjects.data?.length ?? 0, archived: (subjects.data ?? []).filter((row) => row.is_archived).length },
    { total: chapters.data?.length ?? 0, archived: (chapters.data ?? []).filter((row) => row.is_archived).length },
  ]

  if (!sessionLoading && !mayView) {
    return (
      <Notice tone="warning" title="You don't have permission to view the academic hierarchy.">
        Ask a super admin to grant <code className="font-mono text-xs">academic.view</code> if you
        believe this is a mistake.
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Academic structure"
        subtitle="Boards, classes, streams, subjects and chapters — the skeleton every resource hangs from."
      />

      {/* The chain, spelled out once. */}
      <Card className="p-4">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {['Board', 'Class', 'Stream', 'Subject', 'Chapter'].map((step, index, all) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-control bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {step}
              </span>
              {index < all.length - 1 && <ArrowRight className="size-3.5 text-faint" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">
          Streams only apply to senior classes. A subject may also be pinned to a single board, so
          board-specific syllabus changes never touch the shared one.
        </p>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LEVELS.map((level, index) => {
            const { total, archived } = totals[index]
            const Icon = level.icon

            return (
              <li key={level.href}>
                <LinkButton
                  to={level.href}
                  variant="outline"
                  className="flex h-full w-full items-center gap-4 rounded-card p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-muted"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-soft-fg"
                  >
                    <Icon className="size-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{level.label}</span>
                      <span className="tabular text-sm text-muted">{total}</span>
                      {archived > 0 && (
                        <span className="text-xs text-faint">{archived} archived</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{level.blurb}</span>
                  </span>

                  <ArrowRight className="size-4 shrink-0 text-faint" aria-hidden="true" />
                </LinkButton>
              </li>
            )
          })}

          <li>
            <Card className="flex h-full items-start gap-4 p-4">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface-muted text-muted"
              >
                <Boxes className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-foreground">Archiving, not deleting</p>
                <p className="mt-0.5 text-sm text-muted">
                  Levels are never removed while anything still references them. Archiving hides a
                  row from students and keeps every linked resource intact and restorable.
                </p>
              </div>
            </Card>
          </li>
        </ul>
      )}
    </div>
  )
}
