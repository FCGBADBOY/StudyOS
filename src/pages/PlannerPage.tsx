/**
 * Study Planner — a week strip, live daily stats and a timeline of tasks.
 *
 * The week itself comes from the planner service. Completing, removing and
 * adding a task writes through the service and invalidates the planner
 * queries (the local copy repaints from the canonical rows), while
 * "Generate plan" re-sequences the day by priority after a short loading
 * state.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { CalendarDays, Check, Clock, Plus, Sparkles, Timer, Trash2 } from 'lucide-react'
import {
  BackgroundArt,
  Badge,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Illustration,
  Input,
  SectionHeader,
  Select,
  SkeletonList,
  Slider,
  StatCard,
  TabPanel,
} from '@/components/ui'
import type { BadgeVariant } from '@/components/ui'
import { useCountUp, usePlanner, useStagger, useSubjects } from '@/hooks'
import { celebrate, checkComplete, successPop } from '@/animations'
import { useToast } from '@/context/AppProvider'
import { invalidateQueries } from '@/lib/query'
import {
  createStudySession,
  deleteStudySession,
  markSessionComplete,
  updateStudySession,
} from '@/services/planner.service'
import { themeColors } from '@/config/visual'
import { formatDuration, formatShortDate } from '@/utils/format'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'
import type { Priority, StudySession, Subject, SubjectId, WeeklyPlanDay } from '@/types'

/* --------------------------------- helpers -------------------------------- */

function isoToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

function toClock(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0')
  const minutes = String(wrapped % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

/** First free slot after the latest session of the day. */
function nextSlot(sessions: StudySession[]): string {
  if (!sessions.length) return '18:00'
  const sorted = [...sessions].sort(
    (a, b) => toMinutes(a.time ?? '18:00') - toMinutes(b.time ?? '18:00'),
  )
  const last = sorted[sorted.length - 1]
  return toClock(toMinutes(last.time ?? '18:00') + last.duration + 15)
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

/** "Generate plan" — keeps the day's content but re-runs it by priority. */
function resequence(day: WeeklyPlanDay): WeeklyPlanDay {
  const ordered = [...day.sessions].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  )
  const earliest = [...day.sessions].sort(
    (a, b) => toMinutes(a.time ?? '18:00') - toMinutes(b.time ?? '18:00'),
  )[0]
  let cursor = earliest ? toMinutes(earliest.time ?? '18:00') : 18 * 60
  const sessions = ordered.map((session) => {
    const time = toClock(cursor)
    cursor += session.duration + 15
    return { ...session, time }
  })
  return { ...day, sessions }
}

/**
 * Fallback plan for a day with nothing left on it, so "Generate plan" is
 * never a dead end. Three focus blocks, priority-ordered, starting 18:00.
 */
function starterPlan(subjects: Subject[]): StudySession[] {
  const templates: Array<{ focus: string; duration: number; priority: Priority }> = [
    { focus: 'concept revision sprint', duration: 50, priority: 'High' },
    { focus: 'numericals & PYQ practice', duration: 40, priority: 'Medium' },
    { focus: 'formula recall drill', duration: 25, priority: 'Low' },
  ]
  let cursor = 18 * 60
  return subjects.slice(0, templates.length).map((subject, index) => {
    const template = templates[index]
    const session: StudySession = {
      id: `gen-${Date.now()}-${index}`,
      subjectId: subject.id,
      subjectName: subject.name,
      topic: `${subject.name} — ${template.focus}`,
      duration: template.duration,
      priority: template.priority,
      completed: false,
      time: toClock(cursor),
    }
    cursor += template.duration + 15
    return session
  })
}

/** Session "type" derived from the topic — drives the row's type badge. */
function sessionKind(topic: string): { label: string; tone: BadgeVariant } {
  if (/revis/i.test(topic)) return { label: 'Revision', tone: 'brand' }
  if (/mock|pyq|practice|queries|set \d/i.test(topic))
    return { label: 'Practice', tone: 'accent' }
  if (/numerical|integral|solved|probability/i.test(topic))
    return { label: 'Problem solving', tone: 'warning' }
  return { label: 'Study', tone: 'neutral' }
}

const PRIORITY_TONE: Record<Priority, BadgeVariant> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
}

/** The first render happens before a query subscribes — read it as loading. */
function isPending(query: { data: unknown; error: string | null; source: string | undefined }): boolean {
  return query.data === undefined && !query.error && !query.source
}

/* ------------------------------- stat tiles ------------------------------- */

/** Live daily stat — the number counts up, the hint stays honest. */
function DayStat({
  value,
  label,
  hint,
  icon,
  accent,
  decimals = 0,
}: {
  value: number
  label: string
  hint: string
  icon: ReactNode
  accent: 'planner' | 'success' | 'brand'
  decimals?: number
}) {
  const counter = useCountUp<HTMLSpanElement>(value, { decimals })

  return (
    <StatCard
      className="h-full"
      label={label}
      icon={icon}
      accent={accent}
      trend={hint}
      value={
        <>
          <span ref={counter} aria-hidden>
            0
          </span>
          <span className="sr-only">
            {value} {label}
          </span>
        </>
      }
    />
  )
}

/* -------------------------------- task row -------------------------------- */

function TaskRow({
  session,
  onToggle,
  onRemove,
}: {
  session: StudySession
  onToggle: (sessionId: string, next: boolean) => void
  onRemove: (sessionId: string) => void
}) {
  const { toast } = useToast()
  const controlRef = useRef<HTMLButtonElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const celebrationRef = useRef<HTMLSpanElement>(null)
  const accent = subjectAccent(session.subjectId)
  const kind = sessionKind(session.topic)

  /* Reset the drawn tick whenever the task goes back to pending. */
  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path || session.completed) return
    path.style.strokeDasharray = ''
    path.style.strokeDashoffset = ''
  }, [session.completed])

  const toggle = () => {
    const next = !session.completed
    onToggle(session.id, next)

    if (next) {
      checkComplete(controlRef.current, pathRef.current)
      celebrate(celebrationRef.current)
      successPop(celebrationRef.current, { intensity: 0.5 })
      toast({
        title: 'Session complete',
        description: `${session.topic} · ${formatDuration(session.duration)} logged`,
        variant: 'success',
      })
    } else {
      toast({ title: 'Moved back to pending', description: session.topic })
    }
  }

  return (
    <li
      data-task
      className={cn(
        'relative overflow-hidden rounded-card shadow-card transition-colors duration-200',
        session.completed ? 'bg-success-soft' : 'bg-surface',
      )}
    >
      {/* the subject rail — every block reads as its own hue at a glance */}
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1.5', session.completed ? 'bg-success' : accent.solid)}
      />

      <span
        ref={celebrationRef}
        aria-hidden
        className="pointer-events-none absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2"
      >
        <span
          data-celebrate-ring
          className="absolute inset-0 rounded-full border-2 border-success opacity-0"
        />
        <span
          data-celebrate-ring
          className="absolute inset-0 rounded-full border-2 border-brand opacity-0"
        />
        <span
          data-celebrate-particle
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-brand opacity-0"
        />
        <span
          data-celebrate-particle
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-success opacity-0"
        />
        <span
          data-celebrate-particle
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-warning opacity-0"
        />
        <span
          data-celebrate-particle
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-accent opacity-0"
        />
      </span>

      <div className="flex items-start gap-2 py-3.5 pl-5 pr-3 sm:gap-3 sm:py-4 sm:pl-6 sm:pr-4">
        <button
          ref={controlRef}
          type="button"
          role="checkbox"
          aria-checked={session.completed}
          aria-label={`Mark ${session.topic} as ${session.completed ? 'not done' : 'done'}`}
          onClick={toggle}
          className={cn(
            'mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-tile border-2 transition-colors duration-200',
            'outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
            session.completed
              ? 'border-success bg-success'
              : 'border-border-strong bg-surface-muted hover:border-brand',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="var(--brand-fg)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path
              ref={pathRef}
              d="M5 12.5l4.5 4.5L19 7"
              style={{ visibility: session.completed ? 'visible' : 'hidden' }}
            />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge theme={accent.theme} dot>
              {session.subjectName}
            </Badge>
            <Badge variant={kind.tone}>{kind.label}</Badge>
            {session.time && (
              <span className="inline-flex items-center gap-1 text-[12px] text-faint">
                <Clock aria-hidden className="h-3 w-3" />
                <span className="tabular">{session.time}</span>
              </span>
            )}
          </div>

          <p
            className={cn(
              'mt-1.5 text-sm font-semibold leading-snug text-foreground transition-colors duration-200',
              session.completed && 'text-muted line-through decoration-success/60',
            )}
          >
            {session.topic}
          </p>

          {session.notes && <p className="clamp-1 mt-0.5 text-[13px] text-muted">{session.notes}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-faint">
            <span className="tabular font-medium text-muted">
              {formatDuration(session.duration)}
            </span>
            <span aria-hidden>·</span>
            <Badge variant={PRIORITY_TONE[session.priority]}>{session.priority}</Badge>
          </div>
        </div>

        <IconButton
          label={`Remove ${session.topic}`}
          size="lg"
          variant="ghost"
          className="shrink-0"
          onClick={() => onRemove(session.id)}
        >
          <Trash2 />
        </IconButton>
      </div>
    </li>
  )
}

/* -------------------------------- task list ------------------------------- */

function TaskList({
  dayId,
  sessions,
  onToggle,
  onRemove,
}: {
  dayId: string
  sessions: StudySession[]
  onToggle: (sessionId: string, next: boolean) => void
  onRemove: (sessionId: string) => void
}) {
  const listRef = useStagger<HTMLUListElement>({ selector: '[data-task]', step: 70, distance: 16 })

  return (
    <ul ref={listRef} role="list" className="space-y-3">
      {sessions.map((session) => (
        <TaskRow
          key={`${dayId}-${session.id}`}
          session={session}
          onToggle={onToggle}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}

/* ---------------------------------- page ---------------------------------- */

export default function PlannerPage() {
  const { toast } = useToast()

  /* data layer: the week (today + Mon–Sun) and the subject picker options */
  const planner = usePlanner()
  const subjectsQuery = useSubjects()
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data])

  const [days, setDays] = useState<WeeklyPlanDay[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState<string>('chemistry')
  const [duration, setDuration] = useState(45)
  const [generating, setGenerating] = useState(false)

  const generateTimer = useRef<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  /* Server week → local copy. Mutations edit the copy optimistically, then
     invalidate the query so the canonical rows repaint it. */
  const serverWeek = planner.data?.week
  useEffect(() => {
    if (serverWeek) setDays(serverWeek)
  }, [serverWeek])

  useEffect(
    () => () => {
      if (generateTimer.current !== null) window.clearTimeout(generateTimer.current)
    },
    [],
  )

  const day =
    days.find((entry) => entry.id === selectedId) ??
    days.find((entry) => entry.date === isoToday()) ??
    days[0]
  const activeId = day?.id ?? ''
  const planned = day?.sessions.length ?? 0
  const completed = day?.sessions.filter((session) => session.completed).length ?? 0
  const plannedMinutes = day?.sessions.reduce((sum, session) => sum + session.duration, 0) ?? 0
  const focusHours = Math.round((plannedMinutes / 60) * 10) / 10
  const isToday = day?.date === isoToday()

  const toggleTask = (sessionId: string, next: boolean) => {
    const session = day!.sessions.find((entry) => entry.id === sessionId)
    if (!session) return
    const delta = next ? session.duration : -session.duration
    setDays((prev) =>
      prev.map((entry) =>
        entry.id !== day!.id
          ? entry
          : {
              ...entry,
              doneMinutes: Math.max(0, entry.doneMinutes + delta),
              sessions: entry.sessions.map((item) =>
                item.id === sessionId ? { ...item, completed: next } : item,
              ),
            },
      ),
    )

    void markSessionComplete(sessionId, next, {
      title: session.topic,
      minutes: session.duration,
      subjectId: session.subjectId,
    })
      .catch(() =>
        toast({
          title: 'Could not save that session',
          description: 'Check your connection and try again.',
          variant: 'warning',
        }),
      )
      .finally(() => invalidateQueries('planner'))
  }

  const removeTask = (sessionId: string) => {
    const session = day!.sessions.find((entry) => entry.id === sessionId)
    if (!session) return
    setDays((prev) =>
      prev.map((entry) =>
        entry.id !== day!.id
          ? entry
          : {
              ...entry,
              plannedMinutes: Math.max(0, entry.plannedMinutes - session.duration),
              doneMinutes: session.completed
                ? Math.max(0, entry.doneMinutes - session.duration)
                : entry.doneMinutes,
              sessions: entry.sessions.filter((item) => item.id !== sessionId),
            },
      ),
    )
    toast({
      title: 'Task removed',
      description: `${session.topic} is no longer on ${day!.day}'s plan.`,
      variant: 'warning',
    })

    void deleteStudySession(sessionId)
      .catch(() =>
        toast({
          title: 'Could not remove that task',
          description: 'Check your connection and try again.',
          variant: 'warning',
        }),
      )
      .finally(() => invalidateQueries('planner'))
  }

  const generatePlan = () => {
    if (generating || !day) return
    const dayId = day.id
    const scheduledDate = day.date
    const label = `${day.day}, ${formatShortDate(day.date)}`
    const starter = day.sessions.length === 0 ? starterPlan(subjects) : null
    const resequenced = starter ? null : resequence(day)
    setGenerating(true)
    if (generateTimer.current !== null) window.clearTimeout(generateTimer.current)
    generateTimer.current = window.setTimeout(
      () => {
        if (starter) {
          setDays((prev) =>
            prev.map((entry) => {
              if (entry.id !== dayId) return entry
              return {
                ...entry,
                sessions: starter,
                plannedMinutes: starter.reduce((sum, session) => sum + session.duration, 0),
                doneMinutes: 0,
              }
            }),
          )
          void Promise.all(
            starter.map((session) =>
              createStudySession({
                subjectId: session.subjectId,
                title: session.topic,
                scheduledDate,
                startTime: session.time ?? null,
                durationMinutes: session.duration,
                priority: session.priority,
              }),
            ),
          )
            .catch(() =>
              toast({
                title: 'Could not save the generated plan',
                description: 'Check your connection and try again.',
                variant: 'warning',
              }),
            )
            .finally(() => invalidateQueries('planner'))
        } else if (resequenced) {
          setDays((prev) => prev.map((entry) => (entry.id === dayId ? resequenced : entry)))
          void Promise.all(
            resequenced.sessions.map((session) =>
              updateStudySession(session.id, { startTime: session.time ?? null }),
            ),
          )
            .catch(() =>
              toast({
                title: 'Could not save the new timings',
                description: 'Check your connection and try again.',
                variant: 'warning',
              }),
            )
            .finally(() => invalidateQueries('planner'))
        }
        setGenerating(false)
        generateTimer.current = null
        toast({
          title: starter ? 'Plan generated' : 'Plan regenerated',
          description: starter
            ? `${starter.length} focus blocks lined up for ${label}, ordered by priority.`
            : `${label} re-sequenced by priority — high-yield topics run first.`,
          variant: 'success',
        })
      },
      900,
    )
  }

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const topic = title.trim()
    if (!topic || !day) return

    const time = nextSlot(day.sessions)
    const session: StudySession = {
      id: `ts-${Date.now()}`,
      subjectId: subjectId as SubjectId,
      subjectName: subjects.find((entry) => entry.id === subjectId)?.name ?? 'Study',
      topic,
      duration,
      priority: 'Medium',
      completed: false,
      time,
    }

    setDays((prev) =>
      prev.map((entry) =>
        entry.id !== day.id
          ? entry
          : {
              ...entry,
              plannedMinutes: entry.plannedMinutes + duration,
              sessions: [...entry.sessions, session],
            },
      ),
    )
    setSheetOpen(false)
    setTitle('')

    void createStudySession({
      subjectId,
      title: topic,
      scheduledDate: day.date,
      startTime: time,
      durationMinutes: duration,
      priority: 'Medium',
    })
      .then(() => {
        toast({
          title: 'Task added',
          description: `${topic} · ${formatDuration(duration)} at ${time} on ${day.day}.`,
          variant: 'success',
        })
      })
      .catch(() =>
        toast({
          title: 'Could not add that task',
          description: 'Check your connection and try again.',
          variant: 'warning',
        }),
      )
      .finally(() => invalidateQueries('planner'))
  }

  const onStripKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return
    event.preventDefault()

    const index = days.findIndex((entry) => entry.id === activeId)
    let next = index
    if (key === 'ArrowLeft') next = Math.max(0, index - 1)
    if (key === 'ArrowRight') next = Math.min(days.length - 1, index + 1)
    if (key === 'Home') next = 0
    if (key === 'End') next = days.length - 1
    if (next === index) return

    setSelectedId(days[next].id)
    window.requestAnimationFrame(() => {
      const tabs = stripRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      tabs?.[next]?.focus()
    })
  }

  const header = (
    <section
      aria-labelledby="planner-hero"
      className="relative isolate overflow-hidden rounded-hero bg-cream shadow-card"
    >
      <BackgroundArt theme="planner" variant="band" geometry intensity="subtle" />

      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:p-10">
        <div className="min-w-0">
          <p className="eyebrow">Your week</p>
          <h1
            id="planner-hero"
            className="text-display mt-2 text-[32px] leading-[0.98] text-foreground sm:text-[44px]"
          >
            Study <span className={themeColors('planner').onSoft}>Planner</span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
            One week, one timeline. Protect your focus blocks, tick them off and let the planner
            re-sequence the rest.
          </p>

          <div className="mt-5">
            <Button icon={<Plus />} disabled={!day} onClick={() => setSheetOpen(true)}>
              Add task
            </Button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[280px] lg:max-w-none">
          <Illustration name="calendar" theme="planner" decorative className="w-full" />
        </div>
      </div>
    </section>
  )

  /* -------------------------------- states -------------------------------- */

  if (planner.loading || isPending(planner)) {
    return (
      <div className="space-y-6 sm:space-y-8">
        {header}
        <SkeletonList count={3} label="Loading your week" />
      </div>
    )
  }

  if (planner.error && !planner.data) {
    return (
      <div className="space-y-6 sm:space-y-8">
        {header}
        <ErrorState
          title="We could not load your week"
          description="Your planner did not respond. Check your connection and try again."
          onRetry={planner.refetch}
          illustration="notebook"
          theme="planner"
        />
      </div>
    )
  }

  if (!day) {
    return (
      <div className="space-y-6 sm:space-y-8">
        {header}
        <EmptyState
          title="Your week is empty — add a session"
          description="Plan one focus block and the timeline fills up around it."
          illustration="calendar"
          theme="planner"
          action={
            <Button icon={<Plus />} onClick={() => setSheetOpen(true)}>
              Add a session
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {header}

      {/* live daily stats */}
      <section
        aria-label={`${isToday ? 'Today' : day.day} summary`}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <DayStat
          value={planned}
          label="Tasks planned"
          hint={formatShortDate(day.date)}
          icon={<CalendarDays />}
          accent="planner"
        />
        <DayStat
          value={completed}
          label="Completed"
          hint={`of ${planned}`}
          icon={<Check />}
          accent="success"
        />
        <DayStat
          value={focusHours}
          label="Focus hours"
          hint={`${plannedMinutes} min blocked`}
          icon={<Timer />}
          accent="brand"
          decimals={1}
        />
      </section>

      {/* week strip */}
      <section aria-labelledby="week-strip-heading" className="space-y-3">
        <SectionHeader
          id="week-strip-heading"
          eyebrow="Week strip"
          title="This week"
          subtitle={isToday ? 'You are looking at today' : 'Pick a day to see its timeline'}
        />
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Days of the week"
          onKeyDown={onStripKeyDown}
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          {days.map((entry) => {
            const active = entry.id === activeId
            const allDone = entry.sessions.length > 0 && entry.sessions.every((s) => s.completed)
            return (
              <button
                key={entry.id}
                id={`day-tab-${entry.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${entry.day} ${entry.date.slice(8, 10)} — ${entry.sessions.length} tasks, ${entry.sessions.filter((s) => s.completed).length} done`}
                tabIndex={active ? 0 : -1}
                onClick={() => setSelectedId(entry.id)}
                className={cn(
                  'flex h-16 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-tile px-2.5 outline-none transition-shadow duration-150',
                  'focus-visible:ring-2 focus-visible:ring-brand-ring',
                  active
                    ? 'bg-brand-soft text-brand-soft-fg shadow-raised'
                    : 'bg-surface text-muted shadow-card hover:text-foreground hover:shadow-raised',
                )}
              >
                <span className="text-[11px] font-semibold">{entry.day}</span>
                <span className="tabular text-sm font-bold">
                  {entry.date.slice(8, 10).replace(/^0/, '')}
                </span>
                {allDone ? (
                  <Check aria-hidden className="h-3.5 w-3.5 text-success" />
                ) : (
                  <span
                    aria-hidden
                    className={cn('h-1 w-1 rounded-full', active ? 'bg-brand' : 'bg-border-strong')}
                  />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* timeline */}
      <section aria-labelledby="timeline-heading" className="space-y-3">
        <SectionHeader
          id="timeline-heading"
          eyebrow="Timeline"
          title={`${day.day} timeline`}
          subtitle={
            isToday
              ? `Today · ${completed} of ${planned} done`
              : `${formatShortDate(day.date)} · ${completed} of ${planned} done`
          }
          action={
            <Button icon={<Sparkles />} loading={generating} onClick={generatePlan}>
              Generate plan
            </Button>
          }
        />

        <TabPanel id={day.id}>
          {planned === 0 ? (
            <EmptyState
              compact
              title={`Nothing planned for ${day.day}`}
              description="Add a task by hand or let the planner generate a priority-ordered plan for the day."
              illustration="calendar"
              theme="planner"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button icon={<Plus />} onClick={() => setSheetOpen(true)}>
                    Add a task
                  </Button>
                  <Button
                    variant="outline"
                    icon={<Sparkles />}
                    loading={generating}
                    onClick={generatePlan}
                  >
                    Generate plan
                  </Button>
                </div>
              }
            />
          ) : (
            <TaskList
              dayId={day.id}
              sessions={day.sessions}
              onToggle={toggleTask}
              onRemove={removeTask}
            />
          )}
        </TabPanel>
      </section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Add a study task"
        description={`Drops into ${day.day}, ${formatShortDate(day.date)} at the next free slot.`}
        className="rounded-t-hero"
      >
        <form onSubmit={submitTask} className="space-y-4">
          <Input
            label="Task title"
            placeholder="e.g. Waves — numericals"
            value={title}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => setTitle(event.target.value)}
          />

          <Select
            label="Subject"
            options={subjects.map((subject) => ({ id: subject.id, label: subject.name }))}
            value={subjectId}
            onChange={setSubjectId}
          />

          <Slider
            label="Duration"
            min={15}
            max={120}
            step={5}
            value={duration}
            onChange={setDuration}
            valueText={`${duration} min`}
          />

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon={<Plus />} fullWidth disabled={!title.trim()}>
              Add task
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  )
}
