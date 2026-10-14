import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate } from 'animejs'
import {
  ArrowRight,
  BookOpen,
  Clock,
  Flame,
  ListChecks,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import type { ProgressReport, ProgressSnapshot, SubjectId, TopicStat } from '@/types'
import type { WeakChapter } from '@/services/progress.service'
import {
  BackgroundArt,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  IconTile,
  Illustration,
  LinkButton,
  LoadingState,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  SegmentedControl,
  SkeletonList,
  StatCard,
} from '@/components/ui'
import { useCountUp, useProgress, useReveal, useSnapshot, useStagger, useWeakChapters } from '@/hooks'
import { MOTION, canAnimate, staggerDelay, stop } from '@/animations'
import { subjectAccent, subjectInitial } from '@/utils/subject'
import { themeColors } from '@/config/visual'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

type Period = 'week' | 'month'

const PERIOD_OPTIONS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

/** Deterministic mock scaling for the Month view (4.2 weeks ≈ a month). */
const MONTH_FACTOR = 4.2

function scaleMonth(value: number): number {
  return Math.round(value * MONTH_FACTOR)
}

/* -------------------------------- topic row ------------------------------- */

function TopicRow({ topic, tone }: { topic: TopicStat; tone: 'success' | 'danger' }) {
  const accent = subjectAccent(topic.subjectId)

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full', accent.solid)} />
          <span className="truncate">{topic.topic}</span>
        </span>
        <span className="tabular shrink-0 text-[13px] font-semibold text-muted">{topic.value}%</span>
      </div>
      <ProgressBar
        className="mt-1.5"
        size="xs"
        variant={tone}
        value={topic.value}
        label={`${topic.topic} mastery`}
      />
    </div>
  )
}

/* ------------------------------ progress body ----------------------------- */

interface ProgressBodyProps {
  report: ProgressReport
  snapshot?: ProgressSnapshot
  weakChapters: WeakChapter[]
  weakLoading: boolean
  weakError: boolean
  onWeakRetry: () => void
  period: Period
}

function ProgressBody({
  report,
  snapshot,
  weakChapters,
  weakLoading,
  weakError,
  onWeakRetry,
  period,
}: ProgressBodyProps) {
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const statsRef = useStagger<HTMLDivElement>({ step: 55, distance: 16 })
  const lowerRef = useReveal<HTMLDivElement>({ selector: '[data-reveal]' })

  const stats = useMemo(() => {
    const month = period === 'month'
    /* The snapshot carries the same four headline numbers, freshly computed. */
    const minutes = snapshot?.weekMinutes ?? report.weekMinutes
    const questions = snapshot?.questionsSolved ?? report.questionsSolved
    const accuracy = snapshot?.accuracy ?? report.averageAccuracy
    const streak = snapshot?.streak ?? report.streak
    return {
      minutes: month ? scaleMonth(minutes) : minutes,
      questions: month ? scaleMonth(questions) : questions,
      chapters: month ? scaleMonth(report.chaptersCompleted) : report.chaptersCompleted,
      accuracy,
      streak,
    }
  }, [report, snapshot, period])

  /* Weakest chapters arrive as service rows — mapped onto the topic rows. */
  const weakTopics = useMemo<TopicStat[]>(
    () =>
      weakChapters.map((entry) => ({
        topic: entry.chapter,
        subjectId: entry.subjectId as SubjectId,
        value: entry.accuracy,
      })),
    [weakChapters],
  )

  const minutesCount = useCountUp<HTMLSpanElement>(stats.minutes)
  const questionsCount = useCountUp<HTMLSpanElement>(stats.questions)
  const accuracyCount = useCountUp<HTMLSpanElement>(stats.accuracy)
  const chaptersCount = useCountUp<HTMLSpanElement>(stats.chapters)
  const streakCount = useCountUp<HTMLSpanElement>(stats.streak)

  const daily = report.daily
  const maxMinutes = Math.max(...daily.map((day) => day.minutes))
  const maxQuestions = Math.max(...daily.map((day) => day.questions))

  /* Bars grow from the baseline, one column after another (60ms apart). */
  useLayoutEffect(() => {
    const bars = chartRef.current
      ? Array.from(chartRef.current.querySelectorAll<HTMLElement>('[data-bar]'))
      : []
    if (!bars.length || !canAnimate()) return

    for (const bar of bars) bar.style.transformOrigin = 'bottom'

    const instance = animate(bars, {
      scaleY: [0, 1],
      duration: MOTION.duration.epic,
      delay: staggerDelay(MOTION.stagger.base),
      ease: MOTION.ease.enter,
    })
    return stop(instance)
  }, [period, report])

  const goalPercent = (report.completedGoalMinutes / report.monthlyGoalMinutes) * 100
  const goalRemaining = Math.max(0, report.monthlyGoalMinutes - report.completedGoalMinutes)
  const formatInt = (value: number) => value.toLocaleString('en-IN')

  const progressColors = themeColors('progress')
  const accuracyUp = report.accuracyTrend >= 0

  return (
    <>
      {/* -------------------------------------------------------------- */}
      {/* Overview — one dominant ring, four quiet stats                   */}
      {/* -------------------------------------------------------------- */}
      <section aria-labelledby="pr-overview">
        <SectionHeader
          id="pr-overview"
          eyebrow="At a glance"
          title={period === 'week' ? 'This week at a glance' : 'This month at a glance'}
          subtitle={period === 'week' ? 'Last 7 days' : 'Last 30 days'}
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,330px)_1fr]">
          {/* the ring: the single focus of this screen */}
          <Card tone="progress" elevation="hero" className="relative isolate overflow-hidden">
            <span
              aria-hidden
              className={cn('pointer-events-none absolute inset-0 opacity-70', progressColors.field)}
            />
            <div className="relative flex flex-col items-center gap-4 py-2 text-center">
              <ProgressRing
                value={stats.accuracy}
                size={196}
                stroke={16}
                color={progressColors.accentVar}
                label="Average accuracy"
              >
                <span className="flex flex-col items-center">
                  <span
                    ref={accuracyCount}
                    aria-hidden
                    className="tabular text-display text-[40px] leading-none text-foreground"
                  >
                    0
                  </span>
                  <span className="sr-only">{stats.accuracy}%</span>
                  <span className="eyebrow mt-1.5">accuracy</span>
                </span>
              </ProgressRing>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge
                  variant={accuracyUp ? 'success' : 'danger'}
                  icon={accuracyUp ? <TrendingUp /> : <TrendingDown />}
                >
                  {report.accuracyTrend}%
                </Badge>
                <Badge variant="neutral">{period === 'week' ? 'Last 7 days' : 'Last 30 days'}</Badge>
              </div>
            </div>
          </Card>

          <div ref={statsRef} className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <StatCard
              label={period === 'week' ? 'Weekly study time' : 'Monthly study time'}
              value={
                <>
                  <span ref={minutesCount} aria-hidden>
                    0
                  </span>
                  <span className="sr-only">{stats.minutes}</span>
                </>
              }
              unit="min"
              icon={<Clock />}
              accent="planner"
              trend={`${report.weekMinutesTrend}%`}
              trendTone={report.weekMinutesTrend >= 0 ? 'positive' : 'negative'}
            />
            <StatCard
              label="Questions solved"
              value={
                <>
                  <span ref={questionsCount} aria-hidden>
                    0
                  </span>
                  <span className="sr-only">{stats.questions}</span>
                </>
              }
              icon={<ListChecks />}
              accent="pyq"
              trend={`${report.questionsTrend}%`}
              trendTone={report.questionsTrend >= 0 ? 'positive' : 'negative'}
            />
            <StatCard
              label="Chapters completed"
              value={
                <>
                  <span ref={chaptersCount} aria-hidden>
                    0
                  </span>
                  <span className="sr-only">{stats.chapters}</span>
                </>
              }
              icon={<BookOpen />}
              accent="library"
              trend="+2"
              trendTone="positive"
            />
            <StatCard
              label="Study streak"
              value={
                <>
                  <span ref={streakCount} aria-hidden>
                    0
                  </span>
                  <span className="sr-only">{stats.streak}</span>
                </>
              }
              unit="days"
              icon={<Flame />}
              accent="streak"
              trend="+3"
              trendTone="positive"
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Weekly chart — soft ground, rounded bars, minimal grid           */}
      {/* -------------------------------------------------------------- */}
      <section aria-labelledby="pr-chart">
        <SectionHeader
          id="pr-chart"
          eyebrow="Weekly activity"
          title="Weekly study time"
          subtitle="Mon–Sun · minutes studied, questions solved"
        />
        <Card padded={false} className="overflow-hidden">
          <div className="bg-cream px-3 pb-3 pt-6 sm:px-5">
            <div ref={chartRef} className="relative flex items-end gap-1.5 sm:gap-3">
              {/* hairline grid — just enough to read the heights against */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex flex-col justify-between"
              >
                <span className="border-t border-border" />
                <span className="border-t border-border" />
                <span className="border-t border-border" />
                <span className="border-t border-border" />
              </span>

              {daily.map((day, index) => {
                const minutesHeight = (day.minutes / maxMinutes) * 100
                const questionsHeight = (day.questions / maxQuestions) * 100
                const active = activeDay === index

                return (
                  <button
                    key={day.day}
                    type="button"
                    aria-label={`${day.day}: ${day.minutes} minutes studied, ${day.questions} questions solved`}
                    onMouseEnter={() => setActiveDay(index)}
                    onMouseLeave={() => setActiveDay((current) => (current === index ? null : current))}
                    onFocus={() => setActiveDay(index)}
                    onBlur={() => setActiveDay((current) => (current === index ? null : current))}
                    onClick={() => setActiveDay(active ? null : index)}
                    className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-t-tile outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  >
                    <span className="relative flex h-44 w-full items-end justify-center rounded-t-tile bg-surface-muted/70 p-1">
                      {active && (
                        <span className="tabular absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-control bg-surface px-2 py-1 text-[11px] font-semibold text-foreground shadow-pop">
                          {day.minutes} min · {day.questions} Qs
                        </span>
                      )}
                      <span
                        data-bar
                        className="flex h-full w-full items-end justify-center gap-1"
                        style={{ transformOrigin: 'bottom' }}
                      >
                        <span
                          className={cn('rounded-t-tile', progressColors.solid)}
                          style={{ height: `${minutesHeight}%`, flex: 2 }}
                        />
                        <span
                          className="rounded-t-tile bg-amber"
                          style={{ height: `${questionsHeight}%`, flex: 1 }}
                        />
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold text-faint">{day.day}</span>
                    <span className="tabular text-[11px] font-semibold text-foreground">
                      {day.minutes}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-surface px-3 py-3 text-[11px] font-medium text-muted sm:px-5">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn('h-2 w-2 rounded-full', progressColors.solid)} />
              Study minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-amber" />
              Questions solved
            </span>
          </div>
        </Card>
      </section>

      {/* lower sections reveal on scroll */}
      <div ref={lowerRef} className="space-y-6 sm:space-y-8">
        {/* rings */}
        <section data-reveal aria-labelledby="pr-rings">
          <SectionHeader
            id="pr-rings"
            eyebrow="Goals"
            title="Goal rings"
            subtitle="Syllabus, weekly target and PYQs"
          />
          <Card padded tone="cream">
            <div className="grid grid-cols-3 gap-2 sm:gap-6">
              {report.rings.map((ring) => (
                <div key={ring.label} className="flex flex-col items-center gap-2.5 text-center">
                  <ProgressRing
                    value={ring.value}
                    size={96}
                    stroke={9}
                    label={ring.label}
                    variant={ring.color as 'brand' | 'accent' | 'warning'}
                  />
                  <p className="clamp-2 text-[12px] font-medium leading-tight text-muted">
                    {ring.label}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* subject comparison — every subject in its own hue */}
        <section data-reveal aria-labelledby="pr-subjects">
          <SectionHeader
            id="pr-subjects"
            eyebrow="By subject"
            title="Subject comparison"
            subtitle="Accuracy, volume and trend vs last week"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.subjectStats.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  compact
                  title="Not enough data yet"
                  description="Solve questions or log study time and the subject comparison fills in."
                  illustration="target"
                  theme="progress"
                />
              </div>
            ) : (
              report.subjectStats.map((stat) => {
                const accent = subjectAccent(stat.subjectId)
                const positive = stat.trend >= 0

                return (
                  <Card
                    key={stat.subjectId}
                    tone={accent.theme}
                    className="relative isolate overflow-hidden"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute inset-0 opacity-70',
                        themeColors(accent.theme).field,
                      )}
                    />
                    <div className="relative space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <IconTile
                            icon={
                              <span className="text-[11px] font-extrabold">
                                {subjectInitial(stat.subjectId)}
                              </span>
                            }
                            theme={accent.theme}
                            variant="filled"
                            size="sm"
                          />
                          <h3 className={cn('clamp-1 truncate text-sm font-semibold', accent.text)}>
                            {stat.subjectName}
                          </h3>
                        </div>
                        <Badge
                          variant={positive ? 'success' : 'danger'}
                          icon={positive ? <TrendingUp /> : <TrendingDown />}
                        >
                          {positive ? '+' : ''}
                          {stat.trend}%
                        </Badge>
                      </div>

                      {/* the subject hue drives the fill through `currentColor` */}
                      <ProgressBar
                        size="sm"
                        variant="current"
                        className={accent.text}
                        value={stat.accuracy}
                        label="Accuracy"
                        valueText={`${stat.accuracy}%`}
                      />

                      <div className="flex items-center justify-between gap-2 text-[12px] text-muted">
                        <span className="tabular">{formatInt(stat.questions)} solved</span>
                        <span className="tabular">{formatDuration(stat.minutes)} studied</span>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </section>

        {/* strongest / weakest */}
        <div data-reveal className="grid gap-3 sm:grid-cols-2">
          <Card as="section" aria-labelledby="pr-strongest">
            <SectionHeader
              id="pr-strongest"
              title="Strongest topics"
              subtitle="Mastery you can rely on"
              action={<Badge variant="success" icon={<Trophy />}>Top</Badge>}
            />
            <div className="space-y-3">
              {report.strongest.length === 0 ? (
                <EmptyState
                  compact
                  title="Not enough data yet"
                  description="Answer a few PYQ questions and your strongest topics show up here."
                  illustration="graduation"
                  theme="success"
                />
              ) : (
                report.strongest.map((topic) => (
                  <TopicRow key={topic.topic} topic={topic} tone="success" />
                ))
              )}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <LinkButton to="/pyq" variant="outline" size="sm" fullWidth iconRight={<ArrowRight />}>
                Practise PYQs
              </LinkButton>
            </div>
          </Card>

          <Card as="section" aria-labelledby="pr-weakest">
            <SectionHeader
              id="pr-weakest"
              title="Weakest topics"
              subtitle="Where your marks are leaking"
              action={<Badge variant="danger" icon={<TrendingDown />}>Fix</Badge>}
            />
            <div className="space-y-3">
              {weakLoading ? (
                <SkeletonList count={2} label="Loading weak topics" />
              ) : weakError ? (
                <ErrorState
                  compact
                  title="Weakest topics unavailable"
                  onRetry={onWeakRetry}
                  illustration="notebook"
                  theme="progress"
                />
              ) : weakTopics.length === 0 ? (
                <EmptyState
                  compact
                  title="Not enough data yet"
                  description="Answer a few PYQ questions and your weakest topics show up here."
                  illustration="target"
                  theme="mistakes"
                />
              ) : (
                weakTopics.map((topic) => (
                  <TopicRow key={topic.topic} topic={topic} tone="danger" />
                ))
              )}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <LinkButton to="/mistakebook" variant="primary" size="sm" fullWidth iconRight={<ArrowRight />}>
                Fix weak topics
              </LinkButton>
            </div>
          </Card>
        </div>

        {/* monthly goal */}
        <Card as="section" data-reveal tone="cream" aria-labelledby="pr-goal">
          <SectionHeader
            id="pr-goal"
            eyebrow="Goals"
            title="Monthly goal"
            subtitle={`${formatDuration(goalRemaining)} left in this month`}
          />
          <ProgressBar
            value={goalPercent}
            label="Monthly goal"
            valueText={`${formatInt(report.completedGoalMinutes)} / ${formatInt(report.monthlyGoalMinutes)} min`}
          />
          <p className="mt-2 text-[12px] text-muted">
            You are{' '}
            <span className="tabular font-semibold text-foreground">{Math.round(goalPercent)}%</span>{' '}
            of the way there — keep the daily sessions coming.
          </p>
        </Card>
      </div>
    </>
  )
}

/* --------------------------------- page ---------------------------------- */

export default function ProgressPage() {
  const progressQuery = useProgress()
  const snapshotQuery = useSnapshot()
  const weakQuery = useWeakChapters()
  const [period, setPeriod] = useState<Period>('week')

  const report = progressQuery.data
  /* The very first paint happens before the query subscribes — read it as loading. */
  const loading = progressQuery.loading || (!report && !progressQuery.error && !progressQuery.source)
  const weakLoading = weakQuery.loading || (!weakQuery.data && !weakQuery.error && !weakQuery.source)

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the study journey                                          */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="progress-hero"
        className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card"
      >
        <BackgroundArt theme="progress" variant="band" geometry intensity="subtle" />

        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:p-10">
          <div className="min-w-0">
            <p className="eyebrow">Progress report</p>
            <h1
              id="progress-hero"
              className="text-display mt-2 text-[32px] leading-[0.98] text-foreground sm:text-[44px] lg:text-[52px]"
            >
              YOUR STUDY
              <br />
              <span className={themeColors('progress').onSoft}>JOURNEY</span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              {period === 'week'
                ? 'Last 7 days · updated just now'
                : 'Last 30 days · updated just now'}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <SegmentedControl<Period>
                options={PERIOD_OPTIONS}
                value={period}
                onChange={setPeriod}
                label="Reporting period"
              />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[300px] lg:max-w-none">
            <Illustration name="journey" theme="progress" decorative className="w-full" />
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingState label="Loading your progress" />
      ) : progressQuery.error && !report ? (
        <ErrorState
          title="We could not load your progress"
          description="Your stats are taking a moment to arrive. Check your connection and try again."
          onRetry={progressQuery.refetch}
          illustration="notebook"
          theme="progress"
        />
      ) : report ? (
        <ProgressBody
          report={report}
          snapshot={snapshotQuery.data}
          weakChapters={weakQuery.data ?? []}
          weakLoading={weakLoading}
          weakError={Boolean(weakQuery.error)}
          onWeakRetry={weakQuery.refetch}
          period={period}
        />
      ) : (
        <EmptyState
          title="Not enough data yet"
          description="Answer a few questions or log a study session and your report fills in."
          illustration="journey"
          theme="progress"
        />
      )}
    </div>
  )
}
