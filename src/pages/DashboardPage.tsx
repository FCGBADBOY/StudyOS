import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookMarked,
  Bot,
  CalendarDays,
  ChevronRight,
  Crosshair,
  FileText,
  Flame,
  Play,
  ScanLine,
  Sigma,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useStagger, useCountUp, useDashboard, useProfile } from '@/hooks'
import { useApp } from '@/context/AppProvider'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  Skeleton,
  StatCard,
} from '@/components/ui'
import { ExamCard } from '@/components/ExamCard'
import { subjectAccent } from '@/utils/subject'
import { daysUntil, formatDuration, greetingForHour } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { QuickAction } from '@/types'

const ACTION_ICONS: Record<QuickAction['icon'], LucideIcon> = {
  sparkles: Sparkles,
  scan: ScanLine,
  'file-text': FileText,
  sigma: Sigma,
  'book-marked': BookMarked,
}

/** Personalised home: today's focus, shortcuts, momentum and what's next. */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { toast, answers } = useApp()
  const sectionsRef = useStagger<HTMLDivElement>({ step: 55, distance: 14 })

  const dashboard = useDashboard()
  const profileQuery = useProfile()
  const data = dashboard.data
  const profile = profileQuery.data

  const streak = useCountUp<HTMLSpanElement>(data?.snapshot.streak ?? 0)
  const minutes = useCountUp<HTMLSpanElement>(data?.snapshot.weekMinutes ?? 0)
  const solved = useCountUp<HTMLSpanElement>(data?.snapshot.questionsSolved ?? 0)
  const accuracy = useCountUp<HTMLSpanElement>(data?.snapshot.accuracy ?? 0)

  const weak = data?.weakChapters ?? []
  const upcoming = (data?.exams ?? [])
    .filter(
      (exam: { date: string }) => new Date(`${exam.date}T00:00:00`) >= new Date(new Date().toDateString()),
    )
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
  const exam = upcoming[0]
  const focus = data?.focus ?? null
  const name = profile?.name.split(' ')[0] ?? 'there'

  /* ------------------------------- states -------------------------------- */
  if (dashboard.loading) {
    return (
      <div role="status" aria-live="polite" className="space-y-7 sm:space-y-9">
        <span className="sr-only">Loading your dashboard…</span>
        <Skeleton className="h-20 w-2/3" />
        <Skeleton className="h-56 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (dashboard.error) {
    return <ErrorState onRetry={dashboard.refetch} />
  }

  if (!data) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Finish setup and start studying — your personalised dashboard will appear here."
      />
    )
  }

  return (
    <div ref={sectionsRef} className="space-y-7 sm:space-y-9">
      {/* Greeting */}
      <section aria-labelledby="greeting">
        <p className="text-[13px] font-medium text-muted">
          {greetingForHour()}, {name} 👋
        </p>
        <h1 id="greeting" className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          Ready for a focused session?
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Your {profile?.className ?? 'current'} syllabus is {data.syllabus.percent}% covered.{' '}
          {focus
            ? `${focus.subjectName} needs attention today — ${focus.reason}`
            : 'Keep solving to unlock your personalised study recommendation.'}
        </p>
      </section>

      {/* Today's study — hero focus card */}
      <section aria-labelledby="today-focus">
        <SectionHeader
          id="today-focus"
          title="Today’s study"
          subtitle="Picked from your weak chapters and past-year weightage"
          action={
            <Link to="/planner" className="text-[13px] font-semibold text-brand hover:underline">
              Open planner
            </Link>
          }
        />
        {focus ? (
          <Card padded className="relative overflow-hidden">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand">{focus.subjectName}</Badge>
                  <Badge variant="warning">{focus.difficulty}</Badge>
                  <span className="inline-flex items-center gap-1 text-[12px] tabular text-faint">
                    <Timer aria-hidden className="h-3.5 w-3.5" />
                    {formatDuration(focus.minutes)}
                  </span>
                </div>
                <h3 className="mt-2.5 text-lg font-semibold leading-snug tracking-tight text-foreground">
                  {focus.title}
                </h3>
                <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-muted">
                  <Sparkles aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  {focus.reason}
                </p>
                <div className="mt-3.5 max-w-md">
                  <ProgressBar
                    value={focus.progress}
                    label="Chapter progress"
                    valueText={`${focus.progress}%`}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                <Button
                  icon={<Play />}
                  onClick={() => {
                    toast({
                      title: 'Session started',
                      description: `${focus.title} · ${focus.minutes} min focus block.`,
                    })
                    navigate(`/library/cbse/class-12/${focus.subjectId}`)
                  }}
                >
                  Start session
                </Button>
                <Button
                  variant="outline"
                  icon={<Bot />}
                  onClick={() => {
                    toast({ title: 'AI Tutor opened', description: `Ask anything about ${focus.title}.` })
                    navigate('/ai-tutor')
                  }}
                >
                  Explain with AI
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <EmptyState
            compact
            title="No recommendation yet"
            description="Solve a few questions or open a chapter and StudyOS will pick today's focus for you."
          />
        )}
      </section>

      {/* Explainable recommendations — why each chapter, in points */}
      {data.recommendations.length > 0 && (
        <section aria-labelledby="recommended">
          <SectionHeader
            id="recommended"
            title="Recommended for you"
            subtitle="Same rules as Today's study — every reason shows its points"
          />
          <ul role="list" className="space-y-3">
            {data.recommendations.map((item) => (
              <li key={item.id} className="rounded-card border border-border bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand">{item.subjectName}</Badge>
                  <Badge variant="outline">{item.difficulty}</Badge>
                  <span className="tabular text-[12px] text-faint">{formatDuration(item.minutes)}</span>
                  <span className="tabular ml-auto text-[12px] font-semibold text-muted">
                    {item.score} pts
                  </span>
                </div>
                <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground">{item.title}</h3>
                <ul role="list" className="mt-2 space-y-1">
                  {item.reasons.map((reason) => (
                    <li key={reason.label} className="flex items-center justify-between gap-3 text-[12px] text-muted">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Sparkles aria-hidden className="h-3 w-3 shrink-0 text-brand" />
                        <span className="min-w-0 truncate">{reason.label}</span>
                      </span>
                      <span className="tabular shrink-0 text-faint">+{reason.points}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Quick actions */}
      <section aria-labelledby="quick-actions">
        <SectionHeader id="quick-actions" title="Quick actions" subtitle="Jump straight into a study mode" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.quickActions.map((action) => {
            const Icon = ACTION_ICONS[action.icon]
            return (
              <Link
                key={action.id}
                to={action.to}
                className={cn(
                  'group flex min-h-[104px] flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-card outline-none',
                  'transition-colors duration-150 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand-ring',
                )}
              >
                <span className="grid h-9 w-9 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg transition-transform duration-150 group-hover:-translate-y-0.5">
                  <Icon aria-hidden className="h-[18px] w-[18px]" />
                </span>
                <span className="mt-3 block">
                  <span className="block truncate text-sm font-semibold text-foreground">{action.label}</span>
                  <span className="block truncate text-[12px] text-faint">{action.hint}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Continue studying */}
      <section aria-labelledby="continue">
        <SectionHeader
          id="continue"
          title="Continue studying"
          subtitle="Pick up where you left off"
          action={
            <Link to="/library" className="text-[13px] font-semibold text-brand hover:underline">
              Browse library
            </Link>
          }
        />
        {data.continueStudying.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.continueStudying.map((item) => {
              const accent = subjectAccent(item.subjectId)
              return (
                <Link
                  key={item.id}
                  to={`/library/cbse/class-12/${item.subjectId}/${item.chapterSlug}`}
                  className={cn(
                    'group rounded-card border border-border bg-surface p-4 shadow-card outline-none transition-colors duration-150',
                    'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand-ring',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-tile text-xs font-bold',
                        accent.soft,
                        accent.text,
                      )}
                    >
                      {item.subjectName.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-snug text-foreground">
                            {item.chapter}
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-muted">
                            {item.subjectName} · last opened {item.lastStudied}
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden
                          className="mt-1 h-4 w-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar
                          value={item.progress}
                          size="sm"
                          className="flex-1"
                          valueText={`${item.progress}%`}
                        />
                        <span className="shrink-0 text-[12px] tabular text-faint">
                          {formatDuration(item.minutesLeft)} left
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <EmptyState
            compact
            title="Nothing in progress yet"
            description="Chapters you open from the library show up here so you can pick up where you left off."
          />
        )}
      </section>

      {/* Progress snapshot */}
      <section aria-labelledby="snapshot">
        <SectionHeader
          id="snapshot"
          title="Progress snapshot"
          subtitle="Your last 7 days across every subject"
          action={
            <Link to="/progress" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
              Full report <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="Day streak"
            value={<span ref={streak}>{data.snapshot.streak}</span>}
            unit="days"
            icon={<Flame />}
            accent="warning"
            trend="Personal best: 21"
            trendTone="positive"
          />
          <StatCard
            label="Study time"
            value={<span ref={minutes}>{data.snapshot.weekMinutes}</span>}
            unit="min"
            icon={<Timer />}
            trend="+12% vs last week"
            trendTone="positive"
          />
          <StatCard
            label="Questions solved"
            value={<span ref={solved}>{data.snapshot.questionsSolved}</span>}
            icon={<Crosshair />}
            trend="+9% vs last week"
            trendTone="positive"
          />
          <StatCard
            label="Accuracy"
            value={<span ref={accuracy}>{data.snapshot.accuracy}</span>}
            unit="%"
            icon={<TrendingUp />}
            accent="success"
            trend="Up 6 points"
            trendTone="positive"
          />
          <div className="col-span-2 lg:col-span-1">
            <Card padded className="flex h-full items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-muted">Syllabus</p>
                <p className="mt-1 text-[13px] leading-snug text-faint">
                  {data.syllabus.completed} of {data.syllabus.total} chapters
                  <br />
                  completed
                </p>
                <Link to="/progress" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">
                  See breakdown
                </Link>
              </div>
              <ProgressRing value={data.syllabus.percent} size={76} stroke={7} label="Syllabus covered" />
            </Card>
          </div>
        </div>
      </section>

      {/* Weak chapters + exams */}
      <div className="grid gap-7 lg:grid-cols-2 lg:gap-6">
        <section aria-labelledby="weak">
          <SectionHeader
            id="weak"
            title="Weak chapters"
            subtitle="Lowest accuracy — start here for the biggest gains"
            action={
              <Link to="/mistakebook" className="text-[13px] font-semibold text-brand hover:underline">
                MistakeBook
              </Link>
            }
          />
          {weak.length ? (
            <Card padded={false} className="divide-y divide-border overflow-hidden">
              {weak.map((row) => {
              const accent = subjectAccent(row.subjectId)
              return (
                <Link
                  key={row.id}
                  to={`/library/cbse/class-12/${row.subjectId}/${row.slug}`}
                  className="flex items-center gap-3 px-4 py-3.5 outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:-ring-inset"
                >
                  <span
                    aria-hidden
                    className={cn('h-8 w-1.5 shrink-0 rounded-full', accent.solid)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{row.chapter}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {row.subjectName} · {row.progress}% done
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        'block text-sm font-bold tabular',
                        row.accuracy < 50 ? 'text-danger' : 'text-warning',
                      )}
                    >
                      {row.accuracy}%
                    </span>
                    <span className="block text-[11px] text-faint">accuracy</span>
                  </div>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                </Link>
              )
            })}
            </Card>
          ) : (
            <EmptyState
              compact
              title="No weak chapters yet"
              description="Chapters where your accuracy dips will show up here — keep practising."
            />
          )}
        </section>

        <section aria-labelledby="exams">
          <SectionHeader
            id="exams"
            title="Upcoming exams"
            subtitle={exam ? `${exam.name} in ${daysUntil(exam.date)} days` : 'No exams scheduled'}
            action={
              <Link to="/planner" className="text-[13px] font-semibold text-brand hover:underline">
                Plan revision
              </Link>
            }
          />
          <div className="space-y-3">
            {upcoming.slice(0, 3).map((item) => (
              <ExamCard key={item.id} exam={item} compact />
            ))}
            {!upcoming.length && (
              <Card padded className="flex items-center gap-3 text-sm text-muted">
                <Trophy aria-hidden className="h-4 w-4 text-success" />
                No exams on the calendar right now.
              </Card>
            )}
          </div>
        </section>
      </div>

      {/* Streak / goal footer strip */}
      <section aria-labelledby="goal" className="pb-2">
        <Card padded className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-warning-soft text-warning">
              <CalendarDays aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <h2 id="goal" className="text-[15px] font-semibold text-foreground">
                Daily goal · {formatDuration(answers?.dailyGoalMinutes ?? 120)}
              </h2>
              <p className="text-[13px] text-muted">
                You’ve studied {data.todayMinutes} of {data.goalMinutes} minutes today. One more session keeps the{' '}
                {profile?.streak ?? data.snapshot.streak}-day streak alive.
              </p>
            </div>
          </div>
          <LinkButton to="/planner" variant="soft" size="md" iconRight={<ArrowRight />}>
            Plan tomorrow
          </LinkButton>
        </Card>
      </section>
    </div>
  )
}
