import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { animate } from 'animejs'
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  Bot,
  BookX,
  Calculator,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  GraduationCap,
  Grid2x2,
  Landmark,
  Layers,
  ScrollText,
  Sparkles,
} from 'lucide-react'
import { Button, Card, EmptyState, ErrorState, IconButton, Input, SkeletonList, Slider } from '@/components/ui'
import {
  MOTION,
  canAnimate,
  celebrate,
  dur,
  enterStep,
  exitStep,
  stop,
  type TransitionDirection,
} from '@/animations'
import { useOnboardingAnswers, useToast } from '@/context/AppProvider'
import { useAuth, useBoards, useClasses, useStreams, useSubjects } from '@/hooks'
import type { BoardId, ClassId, StreamId, SubjectId } from '@/types'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'

/* ----------------------------------------------------------------- types -- */

type StepKey = 'welcome' | 'board' | 'class' | 'stream' | 'subjects' | 'exam' | 'finish'

const DEFAULT_EXAM_NAME = 'CBSE Class 12 Board Examination'

const SUBJECT_ICONS: Record<SubjectId, ReactNode> = {
  physics: <Atom />,
  chemistry: <FlaskConical />,
  mathematics: <Calculator />,
  english: <BookOpen />,
  'computer-science': <Grid2x2 />,
}

const STREAM_ICONS: Record<StreamId, ReactNode> = {
  science: <Atom />,
  commerce: <Calculator />,
  humanities: <Landmark />,
}

const VALUES = [
  {
    icon: ScrollText,
    title: 'PYQ-first practice',
    detail: 'Fifteen years of papers ranked by what boards actually repeat.',
  },
  {
    icon: Bot,
    title: 'An AI tutor on call',
    detail: 'Doubts answered in steps, at exactly the difficulty your class expects.',
  },
  {
    icon: BookX,
    title: 'A mistake book',
    detail: 'Slips are logged and resurfaced until they stop happening.',
  },
]

/** 120 -> "2h 0m" */
function formatGoal(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-tile bg-brand text-[15px] font-bold text-brand-fg shadow-card"
      >
        S
      </span>
      <span className="text-[17px] font-bold tracking-tight text-foreground">StudyOS</span>
    </span>
  )
}

/* ------------------------------------------------------------ option card -- */

function OptionCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  icon,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description?: string
  meta?: string
  icon?: ReactNode
}) {
  const checkRef = useRef<HTMLSpanElement>(null)

  /* the check pops in whenever a choice becomes selected */
  useLayoutEffect(() => {
    const el = checkRef.current
    if (!el || !canAnimate()) return
    const instance = animate(el, {
      keyframes: [
        { scale: 0.3, opacity: 0, duration: 1, ease: 'linear' },
        { scale: 1.18, opacity: 1, duration: 200, ease: MOTION.ease.soft },
        { scale: 1, duration: 280, ease: MOTION.ease.spring },
      ],
    })
    return stop(instance)
  }, [selected])

  return (
    <Card
      interactive
      padded={false}
      className={cn('overflow-hidden', selected && 'border-brand bg-brand-soft')}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex h-full w-full items-start gap-3 p-4 text-left sm:p-5"
      >
        {icon && (
          <span
            aria-hidden
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-tile [&_svg]:h-[18px] [&_svg]:w-[18px]',
              selected ? 'bg-brand text-brand-fg' : 'bg-surface-muted text-muted',
            )}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight text-foreground">
            {title}
          </span>
          {description && (
            <span className="mt-1 block text-[13px] leading-snug text-muted clamp-2">
              {description}
            </span>
          )}
          {meta && (
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-faint">
              {meta}
            </span>
          )}
        </span>
        {selected && (
          <span
            ref={checkRef}
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-brand-fg"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </button>
    </Card>
  )
}

/* ------------------------------------------------------------------ page -- */

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { answers, saveAnswers, completeOnboarding } = useOnboardingAnswers()
  const { toast } = useToast()
  const { saveAcademicChoices, user } = useAuth()
  const userName = user?.name.split(' ')[0] ?? ''

  /* Option lists come from the academic service (boards → classes → streams
     → subjects); each step shows skeletons until its list arrives. */
  const boardsQuery = useBoards()
  const classesQuery = useClasses()
  const streamsQuery = useStreams()
  const subjectsQuery = useSubjects()

  const boards = useMemo(() => boardsQuery.data ?? [], [boardsQuery.data])
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data])
  const streams = useMemo(() => streamsQuery.data ?? [], [streamsQuery.data])
  const subjectOptions = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data])

  /* ---------------------------------------------------------- step model */
  const [step, setStep] = useState<StepKey>('welcome')
  const [direction, setDirection] = useState<TransitionDirection>('forward')
  const stepRef = useRef<HTMLDivElement>(null)

  const classOption = classes.find((entry) => entry.id === answers.classId)
  const isSenior = classOption?.senior ?? false

  const flow = useMemo<StepKey[]>(
    () => [
      'welcome',
      'board',
      'class',
      ...(isSenior ? (['stream'] as StepKey[]) : []),
      'subjects',
      'exam',
      'finish',
    ],
    [isSenior],
  )

  const resolvedIndex = flow.indexOf(step)
  const index = resolvedIndex === -1 ? flow.length - 1 : resolvedIndex
  const isFirst = index === 0
  const percent = Math.round(((index + 1) / flow.length) * 100)

  /* ------------------------------------------------- animated progress bar */
  const fillRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const fill = fillRef.current
    if (!fill) return
    const target = Math.max(0, Math.min(100, percent))

    if (!canAnimate()) {
      fill.style.width = `${target}%`
      return
    }

    const state = { width: parseFloat(fill.style.width) || 0 }
    const instance = animate(state, {
      width: target,
      duration: dur(MOTION.duration.slow),
      ease: MOTION.ease.enter,
      onUpdate: () => {
        fill.style.width = `${state.width}%`
      },
      onComplete: () => {
        fill.style.width = `${target}%`
      },
    })
    return stop(instance)
  }, [percent])

  /* ------------------------------------------------- enter/exit transitions */
  useLayoutEffect(() => enterStep(stepRef.current, direction), [step, direction])

  /* --------------------------------------------------------- finish flourish */
  useLayoutEffect(() => {
    if (step !== 'finish') return
    return celebrate(stepRef.current)
  }, [step])

  /* ------------------------------------------------------------- selections */
  const pickBoard = useCallback(
    (id: BoardId) => saveAnswers({ ...answers, board: id }),
    [answers, saveAnswers],
  )

  const pickClass = useCallback(
    (id: ClassId) => {
      const option = classes.find((entry) => entry.id === id)
      saveAnswers({
        ...answers,
        classId: id,
        streamId: option?.senior ? answers.streamId : undefined,
      })
    },
    [answers, saveAnswers, classes],
  )

  const pickStream = useCallback(
    (id: StreamId) => {
      const option = streams.find((entry) => entry.id === id)
      const allowed = option?.subjects ?? []
      saveAnswers({
        ...answers,
        streamId: id,
        subjects: answers.subjects.filter((subject) => allowed.includes(subject)),
      })
    },
    [answers, saveAnswers, streams],
  )

  const toggleSubject = useCallback(
    (id: SubjectId) => {
      const has = answers.subjects.includes(id)
      saveAnswers({
        ...answers,
        subjects: has
          ? answers.subjects.filter((subject) => subject !== id)
          : [...answers.subjects, id],
      })
    },
    [answers, saveAnswers],
  )

  /* ------------------------------------------------------------ exam fields */
  const todayISO = useMemo(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${month}-${day}`
  }, [])

  const [examName, setExamName] = useState(
    () => answers.examName?.trim() || DEFAULT_EXAM_NAME,
  )
  const [examDate, setExamDate] = useState(() => answers.examDate ?? '')
  const [goal, setGoal] = useState(() =>
    answers.dailyGoalMinutes > 0 ? answers.dailyGoalMinutes : 120,
  )

  /* --------------------------------------------------------------- derived */
  const streamOption = streams.find((entry) => entry.id === answers.streamId)
  const subjectChoices = streamOption
    ? subjectOptions.filter((subject) => streamOption.subjects.includes(subject.slug))
    : subjectOptions
  const boardOption = boards.find((entry) => entry.id === answers.board)
  const selectedSubjects = subjectOptions
    .filter((option) => answers.subjects.includes(option.id))
    .map((option) => option.name)

  const canContinue = useMemo(() => {
    switch (step) {
      case 'welcome':
      case 'finish':
        return true
      case 'board':
        return Boolean(answers.board)
      case 'class':
        return Boolean(answers.classId)
      case 'stream':
        return Boolean(answers.streamId)
      case 'subjects':
        return subjectChoices.length > 0 && answers.subjects.length > 0
      case 'exam':
        return examName.trim().length > 0 && examDate.length > 0
      default:
        return false
    }
  }, [step, answers, subjectChoices, examName, examDate])

  /* ------------------------------------------------------------ navigation */
  const goTo = useCallback(
    (target: TransitionDirection) => {
      const current = flow.indexOf(step)
      const from = current === -1 ? flow.length - 1 : current
      const next = target === 'forward' ? flow[from + 1] : flow[from - 1]
      if (!next) return
      exitStep(stepRef.current, target, () => {
        setDirection(target)
        setStep(next)
      })
    },
    [flow, step],
  )

  const handleContinue = () => {
    if (!canContinue) return
    if (step === 'exam') {
      saveAnswers({
        ...answers,
        examName: examName.trim(),
        examDate,
        dailyGoalMinutes: goal,
      })
    }
    goTo('forward')
  }

  const handleFinish = async () => {
    const finalExamName = examName.trim() || DEFAULT_EXAM_NAME
    saveAnswers({
      ...answers,
      examName: finalExamName,
      examDate,
      dailyGoalMinutes: goal,
    })
    try {
      /* Persist board / class / stream / subjects / goal to the profile. */
      await saveAcademicChoices({
        boardId: answers.board,
        classId: answers.classId,
        streamId: answers.streamId,
        dailyGoalMinutes: goal,
        examDate: examDate || null,
        examName: finalExamName,
      })
    } catch {
      toast({
        title: 'Choices saved on this device',
        description: 'We could not sync them to your account yet — they will sync when you are back online.',
        variant: 'warning',
      })
    }
    completeOnboarding()
    toast({
      title: 'Setup complete',
      description: 'Your StudyOS workspace is ready.',
      variant: 'success',
    })
    navigate('/dashboard')
  }

  const showActionBar = step !== 'welcome' && step !== 'finish'

  /* ------------------------------------------------------------------ view */
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ------------------------------------------------------------- header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <IconButton
              label="Go back"
              size="lg"
              onClick={() => goTo('back')}
              disabled={isFirst}
              className="disabled:opacity-40"
            >
              <ArrowLeft />
            </IconButton>

            <Link to="/" aria-label="StudyOS home">
              <Wordmark />
            </Link>

            <span
              aria-live="polite"
              className="tabular min-w-[88px] text-right text-[13px] font-semibold text-muted"
            >
              Step {index + 1} of {flow.length}
            </span>
          </div>

          <div className="pb-3">
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
            >
              <div ref={fillRef} className="h-full rounded-full bg-brand" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------- main */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        <div ref={stepRef}>
          {/* ------------------------------------------------------- welcome */}
          {step === 'welcome' && (
            <section aria-labelledby="step-title">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent-fg">
                <Sparkles aria-hidden className="h-3 w-3" />
                Six quick questions
              </span>

              <h1
                id="step-title"
                className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                Welcome to StudyOS
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                Everything you need to study smarter — in one place that already knows your board,
                your subjects and your exam date.
              </p>

              <ul className="mt-6 space-y-3">
                {VALUES.map((value) => {
                  const Icon = value.icon
                  return (
                    <li
                      key={value.title}
                      className="flex items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-card"
                    >
                      <span
                        aria-hidden
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg [&_svg]:h-[18px] [&_svg]:w-[18px]"
                      >
                        <Icon />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">
                          {value.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                          {value.detail}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>

              <Button
                size="lg"
                fullWidth
                className="mt-7"
                icon={<ArrowRight />}
                onClick={() => goTo('forward')}
              >
                Start setup
              </Button>
              <p className="mt-3 text-center text-[12px] text-faint">
                About a minute · Saved on this device
              </p>
            </section>
          )}

          {/* --------------------------------------------------------- board */}
          {step === 'board' && (
            <section aria-labelledby="step-title">
              <h1
                id="step-title"
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                Which board do you follow?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                This decides your syllabus, the papers we show you and how questions are ordered.
              </p>

              <div className="mt-6">
                {boardsQuery.loading ? (
                  <SkeletonList count={4} label="Loading boards" />
                ) : boardsQuery.error ? (
                  <ErrorState
                    compact
                    title="Couldn't load boards"
                    description="We could not load the board list. Check your connection and try again."
                    onRetry={boardsQuery.refetch}
                  />
                ) : boards.length === 0 ? (
                  <EmptyState
                    compact
                    title="No boards available yet"
                    description="Board options will appear here as soon as they are available."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {boards.map((board) => (
                      <OptionCard
                        key={board.id}
                        selected={answers.board === board.id}
                        onSelect={() => pickBoard(board.id)}
                        icon={<ScrollText />}
                        title={board.name}
                        description={board.description}
                        meta={`${board.resourceCount.toLocaleString('en-IN')} resources`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-3 text-[12px] text-faint">
                {boardOption ? `${boardOption.name} selected` : 'Select a board to continue.'}
              </p>
            </section>
          )}

          {/* --------------------------------------------------------- class */}
          {step === 'class' && (
            <section aria-labelledby="step-title">
              <h1
                id="step-title"
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                Which class are you in?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                Chapters, difficulty and PYQs are tuned to your class.
              </p>

              <div className="mt-6">
                {classesQuery.loading ? (
                  <SkeletonList count={4} label="Loading classes" />
                ) : classesQuery.error ? (
                  <ErrorState
                    compact
                    title="Couldn't load classes"
                    description="We could not load the class list. Check your connection and try again."
                    onRetry={classesQuery.refetch}
                  />
                ) : classes.length === 0 ? (
                  <EmptyState
                    compact
                    title="No classes available yet"
                    description="Class options will appear here as soon as they are available."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {classes.map((entry) => (
                      <OptionCard
                        key={entry.id}
                        selected={answers.classId === entry.id}
                        onSelect={() => pickClass(entry.id)}
                        icon={<GraduationCap />}
                        title={entry.name}
                        description={entry.description}
                      />
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-3 text-[12px] text-faint">
                {classOption
                  ? `${classOption.name} selected`
                  : 'Select a class to continue.'}
              </p>
            </section>
          )}

          {/* -------------------------------------------------------- stream */}
          {step === 'stream' && (
            <section aria-labelledby="step-title">
              <h1
                id="step-title"
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                Pick your stream
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {classOption ? `${classOption.name} students choose one of three streams.` : ''}
                We&apos;ll line up the right subjects next.
              </p>

              <div className="mt-6">
                {streamsQuery.loading ? (
                  <SkeletonList count={3} label="Loading streams" />
                ) : streamsQuery.error ? (
                  <ErrorState
                    compact
                    title="Couldn't load streams"
                    description="We could not load the stream list. Check your connection and try again."
                    onRetry={streamsQuery.refetch}
                  />
                ) : streams.length === 0 ? (
                  <EmptyState
                    compact
                    title="No streams available yet"
                    description="Stream options will appear here as soon as they are available."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {streams.map((stream) => (
                      <OptionCard
                        key={stream.id}
                        selected={answers.streamId === stream.id}
                        onSelect={() => pickStream(stream.id)}
                        icon={STREAM_ICONS[stream.id]}
                        title={stream.name}
                        description={stream.description}
                      />
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-3 text-[12px] text-faint">
                {streamOption
                  ? `${streamOption.name} selected`
                  : 'Select a stream to continue.'}
              </p>
            </section>
          )}

          {/* ------------------------------------------------------ subjects */}
          {step === 'subjects' && (
            <section aria-labelledby="step-title">
              <h1
                id="step-title"
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                Which subjects are you appearing for?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {streamOption
                  ? `${streamOption.name} stream · ${subjectChoices.length} subject${subjectChoices.length === 1 ? '' : 's'} available`
                  : 'Pick at least one — you can change this any time in Preferences.'}
              </p>

              <div className="mt-6">
                {subjectsQuery.loading ? (
                  <SkeletonList count={4} label="Loading subjects" />
                ) : subjectsQuery.error ? (
                  <ErrorState
                    compact
                    title="Couldn't load subjects"
                    description="We could not load the subject list. Check your connection and try again."
                    onRetry={subjectsQuery.refetch}
                  />
                ) : subjectChoices.length === 0 ? (
                  <EmptyState
                    compact
                    title="No subjects available yet"
                    description="Subjects for your stream will appear here as soon as they are available."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {subjectChoices.map((option) => (
                      <OptionCard
                        key={option.id}
                        selected={answers.subjects.includes(option.id)}
                        onSelect={() => toggleSubject(option.id)}
                        icon={SUBJECT_ICONS[option.id]}
                        title={option.name}
                        description={option.description}
                      />
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-3 text-[12px] text-faint">
                {answers.subjects.length > 0
                  ? `${answers.subjects.length} selected`
                  : 'Select at least one subject to continue.'}
              </p>
            </section>
          )}

          {/* ---------------------------------------------------------- exam */}
          {step === 'exam' && (
            <section aria-labelledby="step-title">
              <h1
                id="step-title"
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                When is your exam?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                StudyOS works backwards from this date to build your revision runway.
              </p>

              <div className="mt-6 space-y-5">
                <Input
                  label="Exam name"
                  value={examName}
                  onChange={(event) => setExamName(event.target.value)}
                  placeholder={DEFAULT_EXAM_NAME}
                  icon={<FileText />}
                  required
                />

                <div>
                  <label
                    htmlFor="exam-date"
                    className="mb-1.5 block text-[13px] font-medium text-muted"
                  >
                    Exam date
                  </label>
                  <input
                    id="exam-date"
                    type="date"
                    min={todayISO}
                    value={examDate}
                    onChange={(event) => setExamDate(event.target.value)}
                    aria-describedby="exam-date-hint"
                    className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition-colors focus:border-brand"
                  />
                  <p id="exam-date-hint" className="mt-1.5 text-[12px] text-faint">
                    {examDate
                      ? `Countdown starts ${formatDate(examDate)}`
                      : 'Pick the date of your first paper.'}
                  </p>
                </div>

                <div className="rounded-card border border-border bg-surface-muted p-4">
                  <Slider
                    label="Daily study goal"
                    min={30}
                    max={300}
                    step={15}
                    value={goal}
                    onChange={setGoal}
                    valueText={formatGoal(goal)}
                  />
                  <p className="mt-3 text-[12px] leading-snug text-faint">
                    {formatGoal(goal)} a day — sessions are split into 25-minute blocks you can
                    actually finish.
                  </p>
                </div>
              </div>

              {!examDate && (
                <p className="mt-3 text-[12px] text-warning">Pick your exam date to continue.</p>
              )}
            </section>
          )}

          {/* -------------------------------------------------------- finish */}
          {step === 'finish' && (
            <section aria-labelledby="step-title">
              <span
                data-celebrate-icon
                aria-hidden
                className="grid h-14 w-14 place-items-center rounded-full bg-brand text-brand-fg shadow-raised"
              >
                <Check className="h-7 w-7" strokeWidth={2.6} />
              </span>

              <h1
                id="step-title"
                className="mt-5 text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                You&apos;re all set{userName ? `, ${userName}` : ''}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                Here is what StudyOS will build your dashboard around — you can change any of it
                later from Preferences.
              </p>

              <dl className="mt-6 overflow-hidden rounded-card border border-border bg-surface shadow-card">
                <div className="flex items-start gap-3 border-b border-border p-4">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-tile bg-surface-muted text-muted [&_svg]:h-4 [&_svg]:w-4"
                  >
                    <GraduationCap />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[13px] text-muted">Board &amp; class</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {boardOption?.name ?? 'Board not set'} · {classOption?.name ?? 'Class not set'}
                      {streamOption ? ` · ${streamOption.name}` : ''}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-b border-border p-4">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-tile bg-surface-muted text-muted [&_svg]:h-4 [&_svg]:w-4"
                  >
                    <Layers />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[13px] text-muted">Subjects</dt>
                    <dd className="text-sm font-semibold break-words text-foreground">
                      {selectedSubjects.length > 0
                        ? selectedSubjects.join(', ')
                        : 'No subjects selected'}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-b border-border p-4">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-tile bg-surface-muted text-muted [&_svg]:h-4 [&_svg]:w-4"
                  >
                    <CalendarDays />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[13px] text-muted">Exam</dt>
                    <dd className="text-sm font-semibold break-words text-foreground">
                      {examName.trim() || DEFAULT_EXAM_NAME}
                      {examDate ? ` · ${formatDate(examDate)}` : ''}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-tile bg-surface-muted text-muted [&_svg]:h-4 [&_svg]:w-4"
                  >
                    <Clock />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[13px] text-muted">Daily goal</dt>
                    <dd className="tabular text-sm font-semibold text-foreground">
                      {formatGoal(goal)} · {goal} min
                    </dd>
                  </div>
                </div>
              </dl>

              <Button
                size="lg"
                fullWidth
                className="mt-6"
                iconRight={<ArrowRight />}
                onClick={handleFinish}
              >
                Go to dashboard
              </Button>
              <p className="mt-3 text-center text-[12px] text-faint">
                Your answers are saved on this device.
              </p>
            </section>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------ action bar */}
      {showActionBar && (
        <div className="sticky bottom-0 z-30 mt-auto safe-bottom border-t border-border bg-background/90 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
            <Button
              size="lg"
              fullWidth
              onClick={handleContinue}
              disabled={!canContinue}
              iconRight={<ChevronRight />}
            >
              Continue
            </Button>
            {!canContinue && (
              <p className="mt-2 text-center text-[12px] text-faint">
                {step === 'subjects'
                  ? 'Select at least one subject to continue.'
                  : 'Make a choice to continue.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
