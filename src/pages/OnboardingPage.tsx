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
import {
  BackgroundArt,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconTile,
  Illustration,
  IconButton,
  Input,
  SkeletonList,
  Slider,
} from '@/components/ui'
import { Logo } from '@/components/LogoMark'
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
import { subjectTheme, themeColors, themeRing, type ThemeKey } from '@/config/visual'
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

/** Streams borrow their subject's identity so the three choices differ in hue. */
const STREAM_THEMES: Record<StreamId, ThemeKey> = {
  science: 'physics',
  commerce: 'mathematics',
  humanities: 'english',
}

/** Each step owns an identity so the numbered tile reads as a journey. */
const STEP_META: Record<StepKey, { eyebrow: string; theme: ThemeKey }> = {
  welcome: { eyebrow: 'Getting started', theme: 'brand' },
  board: { eyebrow: 'Your syllabus', theme: 'reference' },
  class: { eyebrow: 'Your level', theme: 'profile' },
  stream: { eyebrow: 'Your direction', theme: 'planner' },
  subjects: { eyebrow: 'Your papers', theme: 'notes' },
  exam: { eyebrow: 'Your countdown', theme: 'exam' },
  finish: { eyebrow: 'All set', theme: 'success' },
}

const VALUES: { icon: typeof ScrollText; theme: ThemeKey; title: string; detail: string }[] = [
  {
    icon: ScrollText,
    theme: 'pyq',
    title: 'PYQ-first practice',
    detail: 'Fifteen years of papers ranked by what boards actually repeat.',
  },
  {
    icon: Bot,
    theme: 'ai',
    title: 'An AI tutor on call',
    detail: 'Doubts answered in steps, at exactly the difficulty your class expects.',
  },
  {
    icon: BookX,
    theme: 'mistakes',
    title: 'A mistake book',
    detail: 'Slips are logged and resurfaced until they stop happening.',
  },
]

/** 120 -> "2h 0m" */
function formatGoal(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/* ------------------------------------------------------------ step heading -- */

/**
 * Numbered tile + editorial heading. Every step after the welcome screen uses
 * it, so the flow always shows where you are and what is being asked.
 */
function StepHeading({
  step,
  index,
  title,
  lead,
  tile,
  children,
}: {
  step: StepKey
  index: number
  title: string
  lead?: ReactNode
  /** Swap the numbered tile for a custom one (the finish celebration). */
  tile?: ReactNode
  children?: ReactNode
}) {
  const meta = STEP_META[step]

  return (
    <header className="flex items-start gap-3 sm:gap-4">
      {tile ?? (
        <IconTile
          icon={<span className="tabular text-[13px] font-extrabold">{index + 1}</span>}
          theme={meta.theme}
          variant="gradient"
          size="md"
          className="mt-1 shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{meta.eyebrow}</p>
        <h1 id="step-title" className="text-display mt-1.5 text-[26px] text-foreground sm:text-[33px]">
          {title}
        </h1>
        {lead && <p className="mt-2.5 text-sm leading-relaxed text-muted sm:text-[15px]">{lead}</p>}
        {children}
      </div>
    </header>
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
  theme = 'brand',
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description?: string
  meta?: string
  icon?: ReactNode
  theme?: ThemeKey
}) {
  const checkRef = useRef<HTMLSpanElement>(null)
  const tone = themeColors(theme)

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
      tone={selected ? theme : 'default'}
      elevation={selected ? 'raised' : 'card'}
      className={cn('overflow-hidden', selected && 'ring-2', selected && themeRing(theme))}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex h-full w-full items-start gap-3 p-4 text-left outline-none sm:p-5"
      >
        {icon && (
          <IconTile
            icon={icon}
            theme={theme}
            variant={selected ? 'gradient' : 'soft'}
            size="md"
            className="shrink-0"
          />
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
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              {meta}
            </span>
          )}
        </span>
        {selected && (
          <span
            ref={checkRef}
            aria-hidden
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full',
              tone.solid,
              tone.onSolid,
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </button>
    </Card>
  )
}

/** Shared hint line under every option grid — never faint, always legible. */
function StepHint({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[12px] font-medium leading-snug text-muted">{children}</p>
}

/** Focus halo for the hand-built exam date field. */
const FIELD_FOCUS = 'focus:ring-2 focus:ring-brand-ring focus:ring-inset'

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
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
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

            <Link to="/" aria-label="StudyOS home" className="rounded-control outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
              <Logo size={30} />
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-8 sm:px-6 sm:pt-11">
        <div ref={stepRef}>
          {/* ------------------------------------------------------- welcome */}
          {step === 'welcome' && (
            <section aria-labelledby="step-title">
              <Badge variant="accent" icon={<Sparkles />} size="md">
                Six quick questions
              </Badge>

              <h1
                id="step-title"
                className="text-display mt-4 text-[30px] leading-[1.03] text-foreground sm:text-[40px]"
              >
                Welcome to StudyOS
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Everything you need to study smarter — in one place that already knows your board,
                your subjects and your exam date.
              </p>

              <ul className="mt-7 space-y-3">
                {VALUES.map((value) => {
                  const Icon = value.icon
                  return (
                    <li key={value.title}>
                      <Card padded className="flex items-start gap-3.5">
                        <IconTile icon={<Icon />} theme={value.theme} size="md" variant="soft" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {value.title}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                            {value.detail}
                          </span>
                        </span>
                      </Card>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-7 max-w-[300px]">
                <Illustration name="journey" theme="brand" decorative className="w-full" />
              </div>

              <Button
                size="lg"
                fullWidth
                className="mt-6"
                icon={<ArrowRight />}
                onClick={() => goTo('forward')}
              >
                Start setup
              </Button>
              <p className="mt-3 text-center text-[12px] font-medium text-muted">
                About a minute · Saved on this device
              </p>
            </section>
          )}

          {/* --------------------------------------------------------- board */}
          {step === 'board' && (
            <section aria-labelledby="step-title" className="space-y-6">
              <StepHeading
                step={step}
                index={index}
                title="Which board do you follow?"
                lead="This decides your syllabus, the papers we show you and how questions are ordered."
              />

              <div>
                {boardsQuery.loading ? (
                  <SkeletonList count={4} label="Loading boards" />
                ) : boardsQuery.error ? (
                  <ErrorState
                    compact
                    illustration="graduation"
                    theme="reference"
                    title="Couldn't load boards"
                    description="We could not load the board list. Check your connection and try again."
                    onRetry={boardsQuery.refetch}
                  />
                ) : boards.length === 0 ? (
                  <EmptyState
                    compact
                    illustration="graduation"
                    theme="reference"
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
                        theme="reference"
                        title={board.name}
                        description={board.description}
                        meta={`${board.resourceCount.toLocaleString('en-IN')} resources`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <StepHint>
                {boardOption ? `${boardOption.name} selected` : 'Select a board to continue.'}
              </StepHint>
            </section>
          )}

          {/* --------------------------------------------------------- class */}
          {step === 'class' && (
            <section aria-labelledby="step-title" className="space-y-6">
              <StepHeading
                step={step}
                index={index}
                title="Which class are you in?"
                lead="Chapters, difficulty and PYQs are tuned to your class."
              />

              <div>
                {classesQuery.loading ? (
                  <SkeletonList count={4} label="Loading classes" />
                ) : classesQuery.error ? (
                  <ErrorState
                    compact
                    illustration="graduation"
                    theme="profile"
                    title="Couldn't load classes"
                    description="We could not load the class list. Check your connection and try again."
                    onRetry={classesQuery.refetch}
                  />
                ) : classes.length === 0 ? (
                  <EmptyState
                    compact
                    illustration="graduation"
                    theme="profile"
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
                        theme="profile"
                        title={entry.name}
                        description={entry.description}
                      />
                    ))}
                  </div>
                )}
              </div>

              <StepHint>
                {classOption ? `${classOption.name} selected` : 'Select a class to continue.'}
              </StepHint>
            </section>
          )}

          {/* -------------------------------------------------------- stream */}
          {step === 'stream' && (
            <section aria-labelledby="step-title" className="space-y-6">
              <StepHeading
                step={step}
                index={index}
                title="Pick your stream"
                lead={
                  <>
                    {classOption ? `${classOption.name} students choose one of three streams.` : ''}
                    We&apos;ll line up the right subjects next.
                  </>
                }
              />

              <div>
                {streamsQuery.loading ? (
                  <SkeletonList count={3} label="Loading streams" />
                ) : streamsQuery.error ? (
                  <ErrorState
                    compact
                    illustration="book"
                    theme="planner"
                    title="Couldn't load streams"
                    description="We could not load the stream list. Check your connection and try again."
                    onRetry={streamsQuery.refetch}
                  />
                ) : streams.length === 0 ? (
                  <EmptyState
                    compact
                    illustration="book"
                    theme="planner"
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
                        theme={STREAM_THEMES[stream.id]}
                        title={stream.name}
                        description={stream.description}
                      />
                    ))}
                  </div>
                )}
              </div>

              <StepHint>
                {streamOption ? `${streamOption.name} selected` : 'Select a stream to continue.'}
              </StepHint>
            </section>
          )}

          {/* ------------------------------------------------------ subjects */}
          {step === 'subjects' && (
            <section aria-labelledby="step-title" className="space-y-6">
              <StepHeading
                step={step}
                index={index}
                title="Which subjects are you appearing for?"
                lead={
                  streamOption
                    ? `${streamOption.name} stream · ${subjectChoices.length} subject${subjectChoices.length === 1 ? '' : 's'} available`
                    : 'Pick at least one — you can change this any time in Preferences.'
                }
              />

              <div>
                {subjectsQuery.loading ? (
                  <SkeletonList count={4} label="Loading subjects" />
                ) : subjectsQuery.error ? (
                  <ErrorState
                    compact
                    illustration="book"
                    theme="notes"
                    title="Couldn't load subjects"
                    description="We could not load the subject list. Check your connection and try again."
                    onRetry={subjectsQuery.refetch}
                  />
                ) : subjectChoices.length === 0 ? (
                  <EmptyState
                    compact
                    illustration="book"
                    theme="notes"
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
                        theme={subjectTheme(option.id)}
                        title={option.name}
                        description={option.description}
                      />
                    ))}
                  </div>
                )}
              </div>

              <StepHint>
                {answers.subjects.length > 0
                  ? `${answers.subjects.length} selected`
                  : 'Select at least one subject to continue.'}
              </StepHint>
            </section>
          )}

          {/* ---------------------------------------------------------- exam */}
          {step === 'exam' && (
            <section aria-labelledby="step-title" className="space-y-6">
              <StepHeading
                step={step}
                index={index}
                title="When is your exam?"
                lead="StudyOS works backwards from this date to build your revision runway."
              />

              <div className="space-y-5">
                <Input
                  label="Exam name"
                  value={examName}
                  onChange={(event) => setExamName(event.target.value)}
                  placeholder={DEFAULT_EXAM_NAME}
                  icon={<FileText />}
                  required
                  className="[&_div:focus-within]:ring-2 [&_div:focus-within]:ring-brand-ring [&_div:focus-within]:ring-inset"
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
                    className={cn(
                      'h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm text-foreground transition-colors focus:border-brand',
                      FIELD_FOCUS,
                    )}
                  />
                  <p id="exam-date-hint" className="mt-1.5 text-[12px] font-medium text-muted">
                    {examDate
                      ? `Countdown starts ${formatDate(examDate)}`
                      : 'Pick the date of your first paper.'}
                  </p>
                </div>

                <Card tone="cream">
                  <Slider
                    label="Daily study goal"
                    min={30}
                    max={300}
                    step={15}
                    value={goal}
                    onChange={setGoal}
                    valueText={formatGoal(goal)}
                  />
                  <p className="mt-3 text-[12px] leading-snug text-muted">
                    {formatGoal(goal)} a day — sessions are split into 25-minute blocks you can
                    actually finish.
                  </p>
                </Card>
              </div>

              {!examDate && (
                <p className="text-[12px] font-semibold text-warning">
                  Pick your exam date to continue.
                </p>
              )}
            </section>
          )}

          {/* -------------------------------------------------------- finish */}
          {step === 'finish' && (
            <section aria-labelledby="step-title">
              <div className="relative isolate overflow-hidden rounded-hero bg-cream p-5 shadow-card sm:p-8">
                <BackgroundArt theme="success" intensity="subtle" />

                <div className="relative">
                  <StepHeading
                    step={step}
                    index={index}
                    title={`You're all set${userName ? `, ${userName}` : ''}`}
                    lead="Here is what StudyOS will build your dashboard around — you can change any of it later from Preferences."
                    tile={
                      <span data-celebrate-icon className="block shrink-0">
                        <IconTile icon={<Check strokeWidth={2.6} />} theme="success" variant="gradient" size="xl" />
                      </span>
                    }
                  />

                  <dl className="mt-6 overflow-hidden rounded-card bg-surface shadow-card">
                    <div className="flex items-start gap-3 border-b border-border p-4">
                      <IconTile icon={<GraduationCap />} theme="library" size="sm" />
                      <div className="min-w-0 flex-1">
                        <dt className="text-[13px] text-muted">Board &amp; class</dt>
                        <dd className="text-sm font-semibold text-foreground">
                          {boardOption?.name ?? 'Board not set'} · {classOption?.name ?? 'Class not set'}
                          {streamOption ? ` · ${streamOption.name}` : ''}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 border-b border-border p-4">
                      <IconTile icon={<Layers />} theme="notes" size="sm" />
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
                      <IconTile icon={<CalendarDays />} theme="exam" size="sm" />
                      <div className="min-w-0 flex-1">
                        <dt className="text-[13px] text-muted">Exam</dt>
                        <dd className="text-sm font-semibold break-words text-foreground">
                          {examName.trim() || DEFAULT_EXAM_NAME}
                          {examDate ? ` · ${formatDate(examDate)}` : ''}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4">
                      <IconTile icon={<Clock />} theme="planner" size="sm" />
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
                  <p className="mt-3 text-center text-[12px] font-medium text-muted">
                    Your answers are saved on this device.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------ action bar */}
      {showActionBar && (
        <div className="sticky bottom-0 z-30 mt-auto safe-bottom border-t border-border bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="sm:hidden"
                onClick={() => goTo('back')}
                disabled={isFirst}
                icon={<ArrowLeft />}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={handleContinue}
                disabled={!canContinue}
                iconRight={<ChevronRight />}
              >
                Continue
              </Button>
            </div>
            {!canContinue && (
              <p className="mt-2 text-center text-[12px] font-medium text-muted">
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
