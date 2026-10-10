import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { animate } from 'animejs'
import {
  ArrowRight,
  BookOpen,
  Clock,
  Flame,
  ListChecks,
  Percent,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import type { ProgressReport, ProgressSnapshot, SubjectId, TopicStat } from '@/types'
import type { WeakChapter } from '@/services/progress.service'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  SegmentedControl,
  SkeletonList,
} from '@/components/ui'
import { useCountUp, useProgress, useReveal, useSnapshot, useStagger, useWeakChapters } from '@/hooks'
import { MOTION, canAnimate, staggerDelay, stop } from '@/animations'
import { subjectAccent } from '@/utils/subject'
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

/* -------------------------------- stat card ------------------------------- */

interface StatCardProps {
  icon: ReactNode
  label: string
  value: number
  countRef: RefObject<HTMLSpanElement | null>
  suffix?: string
  trend?: number
  trendLabel?: string
  className?: string
  children?: ReactNode
}

function StatCard({
  icon,
  label,
  value,
  countRef,
  suffix,
  trend,
  trendLabel,
  className,
  children,
}: StatCardProps) {
  const down = typeof trend === 'number' && trend < 0

  return (
    <Card className={cn('flex flex-col gap-2 p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg [&_svg]:h-[18px] [&_svg]:w-[18px]"
        >
          {icon}
        </span>
        {trendLabel && (
          <Badge variant={down ? 'danger' : 'success'} icon={down ? <TrendingDown /> : <TrendingUp />}>
            {trendLabel}
          </Badge>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span ref={countRef} aria-hidden className="tabular text-2xl font-bold leading-none text-foreground">
          0
        </span>
        <span className="sr-only">{value}</span>
        {suffix && <span className="text-[13px] font-semibold text-muted">{suffix}</span>}
      </div>

      <p className="text-[12px] font-medium text-muted">{label}</p>
      {children}
    </Card>
  )
}

/* -------------------------------- topic row ------------------------------- */

function TopicRow({ topic, tone }: { topic: TopicStat; tone: 'success' | 'danger' }) {
  const accent = subjectAccent(topic.subjectId)

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', accent.solid)} />
          <span className="truncate">{topic.topic}</span>
        </span>
        <span className="tabular shrink-0 text-[13px] font-semibold text-muted">{topic.value}%</span>
      </div>
      <ProgressBar className="mt-1.5" size="xs" variant={tone} value={topic.value} label={`${topic.topic} mastery`} />
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

  return (
    <>
      {/* top stats */}
      <section aria-labelledby="pr-stats">
        <SectionHeader
          id="pr-stats"
          title={period === 'week' ? 'This week at a glance' : 'This month at a glance'}
          subtitle={period === 'week' ? 'Last 7 days' : 'Last 30 days'}
        />
        <div ref={statsRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={<Clock />}
            label={period === 'week' ? 'Weekly study time' : 'Monthly study time'}
            value={stats.minutes}
            countRef={minutesCount}
            suffix="min"
            trend={report.weekMinutesTrend}
            trendLabel={`${report.weekMinutesTrend}%`}
          />
          <StatCard
            icon={<ListChecks />}
            label="Questions solved"
            value={stats.questions}
            countRef={questionsCount}
            trend={report.questionsTrend}
            trendLabel={`${report.questionsTrend}%`}
          />
          <StatCard
            icon={<Percent />}
            label="Average accuracy"
            value={stats.accuracy}
            countRef={accuracyCount}
            suffix="%"
            trend={report.accuracyTrend}
            trendLabel={`${report.accuracyTrend}%`}
          >
            <ProgressBar className="mt-1" size="sm" value={stats.accuracy} label="Average accuracy" />
          </StatCard>
          <StatCard
            icon={<BookOpen />}
            label="Chapters completed"
            value={stats.chapters}
            countRef={chaptersCount}
            trend={2}
            trendLabel="+2"
          />
          <StatCard
            icon={<Flame />}
            label="Study streak"
            value={stats.streak}
            countRef={streakCount}
            suffix="days"
            trend={3}
            trendLabel="+3"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </section>

      {/* weekly chart */}
      <section aria-labelledby="pr-chart">
        <SectionHeader
          id="pr-chart"
          title="Weekly study time"
          subtitle="Mon–Sun · minutes studied, questions solved"
        />
        <Card>
          <div ref={chartRef} className="flex items-end gap-1.5 sm:gap-3">
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
                  className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-t-tile"
                >
                  <span className="relative flex h-44 w-full items-end justify-center">
                    {active && (
                      <span className="tabular absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-control border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground shadow-raised">
                        {day.minutes} min · {day.questions} Qs
                      </span>
                    )}
                    <span
                      data-bar
                      className="flex h-40 w-full items-end justify-center gap-1"
                      style={{ transformOrigin: 'bottom' }}
                    >
                      <span
                        className="flex-[2] rounded-t-tile bg-brand"
                        style={{ height: `${minutesHeight}%` }}
                      />
                      <span
                        className="flex-1 rounded-t-tile bg-accent/50"
                        style={{ height: `${questionsHeight}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-[10px] font-semibold text-faint">{day.day}</span>
                  <span className="tabular text-[11px] font-semibold text-foreground">{day.minutes}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[11px] font-medium text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-brand" />
              Study minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent/50" />
              Questions solved
            </span>
          </div>
        </Card>
      </section>

      {/* lower sections reveal on scroll */}
      <div ref={lowerRef} className="space-y-6 sm:space-y-8">
        {/* rings */}
        <section data-reveal aria-labelledby="pr-rings">
          <SectionHeader id="pr-rings" title="Goal rings" subtitle="Syllabus, weekly target and PYQs" />
          <Card>
            <div className="grid grid-cols-3 gap-2 sm:gap-6">
              {report.rings.map((ring) => (
                <div key={ring.label} className="flex flex-col items-center gap-2 text-center">
                  <ProgressRing
                    value={ring.value}
                    size={84}
                    stroke={7}
                    label={ring.label}
                    variant={ring.color as 'brand' | 'accent' | 'warning'}
                  />
                  <p className="clamp-2 text-[12px] font-medium leading-tight text-muted">{ring.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* subject comparison */}
        <section data-reveal aria-labelledby="pr-subjects">
          <SectionHeader
            id="pr-subjects"
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
                />
              </div>
            ) : (
              report.subjectStats.map((stat) => {
                const accent = subjectAccent(stat.subjectId)
                const positive = stat.trend >= 0
                const accuracyVariant =
                  stat.accuracy >= 80 ? 'success' : stat.accuracy >= 65 ? 'brand' : 'warning'

                return (
                  <Card key={stat.subjectId} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full', accent.solid)} />
                        <h3 className={cn('truncate text-sm font-semibold', accent.text)}>{stat.subjectName}</h3>
                      </div>
                      <Badge
                        variant={positive ? 'success' : 'danger'}
                        icon={positive ? <TrendingUp /> : <TrendingDown />}
                      >
                        {positive ? '+' : ''}
                        {stat.trend}%
                      </Badge>
                    </div>

                    <ProgressBar
                      size="sm"
                      variant={accuracyVariant}
                      value={stat.accuracy}
                      label="Accuracy"
                      valueText={`${stat.accuracy}%`}
                    />

                    <div className="flex items-center justify-between gap-2 text-[12px] text-muted">
                      <span className="tabular">{formatInt(stat.questions)} solved</span>
                      <span className="tabular">{formatDuration(stat.minutes)} studied</span>
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
                />
              ) : weakTopics.length === 0 ? (
                <EmptyState
                  compact
                  title="Not enough data yet"
                  description="Answer a few PYQ questions and your weakest topics show up here."
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
        <Card as="section" data-reveal aria-labelledby="pr-goal">
          <SectionHeader
            id="pr-goal"
            title="Monthly goal"
            subtitle={`${formatDuration(goalRemaining)} left in this month`}
          />
          <ProgressBar
            value={goalPercent}
            label="Monthly goal"
            valueText={`${formatInt(report.completedGoalMinutes)} / ${formatInt(report.monthlyGoalMinutes)} min`}
          />
          <p className="mt-2 text-[12px] text-muted">
            You are <span className="tabular font-semibold text-foreground">{Math.round(goalPercent)}%</span> of the way
            there — keep the daily sessions coming.
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
      <PageHeader
        title="Your progress"
        subtitle={period === 'week' ? 'Last 7 days · updated just now' : 'Last 30 days · updated just now'}
        actions={
          <SegmentedControl<Period>
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
            label="Reporting period"
          />
        }
      />

      {loading ? (
        <LoadingState label="Loading your progress" />
      ) : progressQuery.error && !report ? (
        <ErrorState
          title="We could not load your progress"
          description="Your stats are taking a moment to arrive. Check your connection and try again."
          onRetry={progressQuery.refetch}
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
        />
      )}
    </div>
  )
}
