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
  ActionCard,
  BackgroundArt,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FeatureCard,
  IconTile,
  Illustration,
  InsightCard,
  LinkButton,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  Skeleton,
  StatCard,
} from '@/components/ui'
import { ExamCard } from '@/components/ExamCard'
import { subjectAccent } from '@/utils/subject'
import { subjectTheme, themeColors, type ThemeKey } from '@/config/visual'
import type { IllustrationName } from '@/components/ui'
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

/** Each shortcut owns a colour so the row reads as six different doors. */
const ACTION_THEMES: Record<QuickAction['icon'], ThemeKey> = {
  sparkles: 'ai',
  scan: 'scan',
  'file-text': 'pyq',
  sigma: 'formula',
  'book-marked': 'mistakes',
}

/** Subject-specific hero art — decorative, never load-bearing. */
const SUBJECT_ART: Record<string, IllustrationName> = {
  physics: 'target',
  chemistry: 'molecule',
  mathematics: 'formula',
  english: 'book',
  'computer-science': 'notebook',
}

function artFor(subjectId?: string, fallback: IllustrationName = 'desk'): IllustrationName {
  return SUBJECT_ART[subjectId ?? ''] ?? fallback
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
      (exam: { date: string }) =>
        new Date(`${exam.date}T00:00:00`) >= new Date(new Date().toDateString()),
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
        <Skeleton className="h-48 w-full rounded-hero sm:h-56" />
        <Skeleton className="h-64 w-full rounded-hero sm:h-72" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px] rounded-card" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-card" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    )
  }

  if (dashboard.error) {
    return <ErrorState onRetry={dashboard.refetch} illustration="notebook" />
  }

  if (!data) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Finish setup and start studying — your personalised dashboard will appear here."
        illustration="graduation"
        action={
          <LinkButton to="/onboarding" variant="primary" size="sm">
            Finish setup
          </LinkButton>
        }
      />
    )
  }

  const focusTheme = focus ? subjectTheme(focus.subjectId) : 'brand'
  const focusArt = focus ? artFor(focus.subjectId, 'book') : 'book'

  return (
    <div ref={sectionsRef} className="space-y-8 sm:space-y-10">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the editorial opening                                     */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="greeting"
        className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card"
      >
        <BackgroundArt theme="brand" geometry intensity="subtle" />
        <span
          aria-hidden
          className="pattern-dots pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-[0.35]"
        />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:p-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">
              {greetingForHour()}, {name} 👋
            </p>
            <h1
              id="greeting"
              className="text-display mt-2 text-[32px] leading-[0.98] text-foreground sm:text-[44px] lg:text-[52px]"
            >
              READY WHEN
              <br />
              <span className="text-brand">YOU ARE.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              Your personalised study space is ready. Continue where you left off, or start
              today&apos;s recommended session.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge theme="brand" variant="brand" dot>
                {data.syllabus.percent}% syllabus covered
              </Badge>
              <Badge variant="neutral">
                {data.syllabus.completed} of {data.syllabus.total} chapters
              </Badge>
              {focus && (
                <Badge theme={focusTheme} dot>
                  {focus.subjectName} needs attention
                </Badge>
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[300px] lg:max-w-none">
            <Illustration name="desk" theme="brand" decorative className="w-full" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Today's study — the visual centrepiece                            */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="today-focus">
        <SectionHeader
          id="today-focus"
          title="Today’s study"
          subtitle="Picked from your weak chapters and past-year weightage"
          action={
            <Link
              to="/planner"
              className="text-[13px] font-semibold text-brand hover:underline"
            >
              Open planner
            </Link>
          }
        />

        {focus ? (
          <FeatureCard
            tone={focusTheme}
            eyebrow="Today’s focus"
            title={focus.title}
            description={focus.reason}
            meta={
              <>
                <Badge theme={focusTheme} dot uppercase>
                  {focus.subjectName}
                </Badge>
                <Badge variant="neutral">{focus.difficulty}</Badge>
                <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold tabular text-muted">
                  <Timer aria-hidden className="h-3.5 w-3.5" />
                  {formatDuration(focus.minutes)}
                </span>
                <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold tabular text-muted">
                  <TrendingUp aria-hidden className="h-3.5 w-3.5" />
                  {focus.progress}% complete
                </span>
                <ProgressBar
                  value={focus.progress}
                  size="sm"
                  variant="accent"
                  label="Chapter progress"
                  valueText={`${focus.progress}%`}
                  className="mt-1 w-full basis-full"
                />
              </>
            }
            action={
              <>
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
                    toast({
                      title: 'AI Tutor opened',
                      description: `Ask anything about ${focus.title}.`,
                    })
                    navigate('/ai-tutor')
                  }}
                >
                  Explain with AI
                </Button>
              </>
            }
            media={
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-card opacity-60"
                  style={{ backgroundColor: themeColors(focusTheme).accentVar, maskImage: 'radial-gradient(circle at 50% 45%, black, transparent 72%)', WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black, transparent 72%)' }}
                />
                <Illustration name={focusArt} theme={focusTheme} decorative className="relative w-full" />
              </div>
            }
          />
        ) : (
          <EmptyState
            compact
            title="No recommendation yet"
            description="Solve a few questions or open a chapter and StudyOS will pick today's focus for you."
            illustration="target"
          />
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Continue studying                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="continue">
        <SectionHeader
          id="continue"
          title="Continue studying"
          subtitle="Pick up where you left off"
          action={
            <Link
              to="/library"
              className="text-[13px] font-semibold text-brand hover:underline"
            >
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
                    'group rounded-card bg-surface p-4 shadow-card outline-none transition-shadow duration-150',
                    'hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand-ring',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <IconTile
                      icon={<span className="text-[13px] font-extrabold">
                        {item.subjectName.slice(0, 2)}
                      </span>}
                      theme={accent.theme}
                      size="md"
                    />
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
                          variant="accent"
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
            illustration="book"
          />
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Quick actions                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="quick-actions">
        <SectionHeader
          id="quick-actions"
          title="Quick actions"
          subtitle="Jump straight into a study mode"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.quickActions.map((action) => {
            const Icon = ACTION_ICONS[action.icon]
            return (
              <Link
                key={action.id}
                to={action.to}
                className="group rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <ActionCard
                  icon={<Icon />}
                  title={action.label}
                  description={action.hint}
                  theme={ACTION_THEMES[action.icon]}
                  trailing={<ArrowRight />}
                  className="h-full"
                />
              </Link>
            )
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Progress overview                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="snapshot">
        <SectionHeader
          id="snapshot"
          title="Your progress"
          subtitle="The last 7 days across every subject"
          action={
            <Link
              to="/progress"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
            >
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
            accent="streak"
            trend="Keep it alive today"
            trendTone="positive"
          />
          <StatCard
            label="Study time"
            value={<span ref={minutes}>{data.snapshot.weekMinutes}</span>}
            unit="min"
            icon={<Timer />}
            accent="planner"
            trend="This week"
          />
          <StatCard
            label="Questions solved"
            value={<span ref={solved}>{data.snapshot.questionsSolved}</span>}
            icon={<Crosshair />}
            accent="pyq"
            trend="All subjects"
          />
          <StatCard
            label="Accuracy"
            value={<span ref={accuracy}>{data.snapshot.accuracy}</span>}
            unit="%"
            icon={<TrendingUp />}
            accent="success"
            trend="Last 7 days"
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
                <Link
                  to="/progress"
                  className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline"
                >
                  See breakdown
                </Link>
              </div>
              <ProgressRing
                value={data.syllabus.percent}
                size={76}
                stroke={7}
                label="Syllabus covered"
              />
            </Card>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Weak areas + exams                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
        <section aria-labelledby="weak">
          <SectionHeader
            id="weak"
            title="Weak areas"
            subtitle="Lowest accuracy — the biggest gains live here"
            action={
              <Link
                to="/mistakebook"
                className="text-[13px] font-semibold text-brand hover:underline"
              >
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
                      <p className="truncate text-sm font-semibold text-foreground">
                        {row.chapter}
                      </p>
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
              illustration="target"
            />
          )}
        </section>

        <section aria-labelledby="exams">
          <SectionHeader
            id="exams"
            title="Upcoming exams"
            subtitle={exam ? `${exam.name} in ${daysUntil(exam.date)} days` : 'No exams scheduled'}
            action={
              <Link
                to="/planner"
                className="text-[13px] font-semibold text-brand hover:underline"
              >
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

      {/* ---------------------------------------------------------------- */}
      {/* Recommendations — every reason shows its points                   */}
      {/* ---------------------------------------------------------------- */}
      {data.recommendations.length > 0 && (
        <section aria-labelledby="recommended">
          <SectionHeader
            id="recommended"
            title="Recommended for you"
            subtitle="The same rules as Today’s study — every reason shows its points"
          />
          <ul role="list" className="grid gap-3 sm:grid-cols-2">
            {data.recommendations.map((item, index) => (
              <li key={item.id}>
                <InsightCard
                  marker={index + 1}
                  tone={subjectTheme(item.subjectSlug)}
                  title={item.title}
                  body={
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge theme={subjectTheme(item.subjectSlug)} dot>
                        {item.subjectName}
                      </Badge>
                      <Badge variant="neutral">{item.difficulty}</Badge>
                      <span className="tabular text-[12px] text-faint">
                        {formatDuration(item.minutes)}
                      </span>
                    </span>
                  }
                  detail={
                    <ul role="list" className="mt-1 space-y-1">
                      {item.reasons.map((reason) => (
                        <li
                          key={reason.label}
                          className="flex items-center justify-between gap-3 text-[12px] text-muted"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Sparkles aria-hidden className="h-3 w-3 shrink-0 text-brand" />
                            <span className="min-w-0 truncate">{reason.label}</span>
                          </span>
                          <span className="tabular shrink-0 font-semibold text-faint">
                            +{reason.points}
                          </span>
                        </li>
                      ))}
                    </ul>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Daily goal footer                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="goal" className="pb-2">
        <Card padded className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={<CalendarDays />} theme="exam" size="lg" />
            <div>
              <h2 id="goal" className="text-[15px] font-semibold text-foreground">
                Daily goal · {formatDuration(answers?.dailyGoalMinutes ?? 120)}
              </h2>
              <p className="text-[13px] text-muted">
                You’ve studied {data.todayMinutes} of {data.goalMinutes} minutes today. One more
                session keeps the {profile?.streak ?? data.snapshot.streak}-day streak alive.
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
