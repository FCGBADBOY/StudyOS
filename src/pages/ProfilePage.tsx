import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Lock,
  LogOut,
  Pencil,
  RotateCcw,
  Settings,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LinkButton,
  Modal,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  Skeleton,
  Slider,
} from '@/components/ui'
import { celebrate } from '@/animations'
import {
  useAuth,
  useBoards,
  useClasses,
  useCountUp,
  useIsMobile,
  useProfile,
  useProgress,
  useStagger,
  useStreams,
  useSubjects,
} from '@/hooks'
import { useApp, useToast } from '@/context/AppProvider'
import { formatDate, formatDuration, formatShortDate, daysUntil, titleCase } from '@/utils/format'
import { subjectAccent } from '@/utils/subject'
import { cn } from '@/utils/cn'
import type {
  Achievement,
  Board,
  ClassOption,
  OnboardingAnswers,
  ProfileUser,
  StreamOption,
  Subject,
} from '@/types'

/* ------------------------------- helpers -------------------------------- */

const ACHIEVEMENT_ICONS: Record<Achievement['icon'], ReactNode> = {
  flame: <Flame />,
  target: <Target />,
  trophy: <Trophy />,
  book: <BookOpen />,
  zap: <Zap />,
  star: <Star />,
}

/** Onboarding answers win; profile data is the fallback for fresh installs. */
function academicLabels(
  answers: OnboardingAnswers,
  profile: ProfileUser | undefined,
  boards: Board[],
  classes: ClassOption[],
  streams: StreamOption[],
) {
  const boardId = answers.board ?? profile?.board
  const classId = answers.classId ?? profile?.classId
  const board = boards.find((entry) => entry.id === boardId)?.name ?? profile?.boardName ?? '—'
  const classLabel = classes.find((entry) => entry.id === classId)?.name ?? profile?.className ?? '—'
  const stream = answers.streamId
    ? streams.find((entry) => entry.id === answers.streamId)?.name ?? profile?.streamName
    : profile?.streamName
  /* ids drive URLs, labels drive copy. */
  return { board, classLabel, stream, boardId, classId }
}

/** Subject display name from the loaded library (slug-tolerant). */
function subjectNameOf(id: string, subjects: Subject[]): string {
  const match = subjects.find((entry) => entry.id === id || entry.slug === id)
  return match?.name ?? titleCase(id.replace(/-/g, ' '))
}

/** `alcohols-phenols-and-ethers` → `Alcohols Phenols And Ethers` (search fallback). */
function humanise(slug: string): string {
  return titleCase(slug.replace(/-/g, ' '))
}

interface FavoriteItem {
  id: string
  to: string
  title: string
  meta: string
}

/** Favourite ids look like `chapter:<subject>:<slug>`. */
function resolveFavorite(id: string, boardId: string, classId: string, subjects: Subject[]): FavoriteItem {
  const [kind, subject, slug] = id.split(':')
  if (kind === 'chapter' && subject && slug) {
    const match = subjects.flatMap((entry) => entry.chapters).find((chapter) => chapter.slug === slug)
    return {
      id,
      to: `/library/${boardId}/${classId}/${subject}/${slug}`,
      title: match?.title ?? humanise(slug),
      meta: subjectNameOf(subject, subjects),
    }
  }
  if (kind === 'pyq') {
    return { id, to: '/pyq', title: humanise(slug ?? 'pyq practice'), meta: 'PYQ Intelligence' }
  }
  return { id, to: '/library', title: humanise(kind ?? 'Saved item'), meta: 'Library' }
}

/* -------------------------------- stat ---------------------------------- */

function ProfileStat({
  icon,
  label,
  value,
  suffix,
  decimals = 0,
}: {
  icon: ReactNode
  label: string
  value: number
  suffix?: string
  decimals?: number
}) {
  const countRef = useCountUp<HTMLSpanElement>(value, { decimals })

  return (
    <Card className="flex flex-col gap-2 p-4">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg [&_svg]:h-[18px] [&_svg]:w-[18px]"
      >
        {icon}
      </span>
      <div className="flex items-baseline gap-1">
        <span ref={countRef} aria-hidden className="tabular text-2xl font-bold leading-none text-foreground">
          0
        </span>
        <span className="sr-only">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </span>
        {suffix && <span className="text-[13px] font-semibold text-muted">{suffix}</span>}
      </div>
      <p className="text-[12px] font-medium text-muted">{label}</p>
    </Card>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 clamp-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

/* --------------------------------- page --------------------------------- */

export default function ProfilePage() {
  const { answers, saveAnswers, favorites, toggleFavorite, resetOnboarding } = useApp()
  const { toast } = useToast()
  const { signOut, saveProfile: persistProfile } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const profileQuery = useProfile()
  const progressQuery = useProgress()
  const boardsQuery = useBoards()
  const classesQuery = useClasses()
  const streamsQuery = useStreams()
  const subjectsQuery = useSubjects()

  const profile = profileQuery.data
  const progress = progressQuery.data
  const boards = useMemo(() => boardsQuery.data ?? [], [boardsQuery.data])
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data])
  const streams = useMemo(() => streamsQuery.data ?? [], [streamsQuery.data])
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data])

  const pageRef = useStagger<HTMLDivElement>({ step: 60, distance: 18 })
  const statsRef = useStagger<HTMLDivElement>({ step: 55, distance: 14 })
  const achievementsRef = useStagger<HTMLUListElement>({ selector: '[data-achievement]', step: 70, distance: 16 })
  const activityRef = useStagger<HTMLOListElement>({ selector: 'li', step: 55, distance: 14 })
  const favoritesRef = useStagger<HTMLUListElement>({ selector: 'li', step: 55, distance: 14 })

  /* Editable profile — local state, persisted answers go through context. */
  const [name, setName] = useState<string | null>(null)
  const [examDate, setExamDate] = useState(answers.examDate ?? '')
  const [dailyGoal, setDailyGoal] = useState(answers.dailyGoalMinutes)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', examDate: '', goal: 120 })
  const [signOutOpen, setSignOutOpen] = useState(false)

  const displayName = name ?? profile?.name ?? 'Student'
  const labels = useMemo(
    () => academicLabels(answers, profile, boards, classes, streams),
    [answers, profile, boards, classes, streams],
  )

  const trackedSubjects = useMemo(
    () => subjects.filter((subject) => profile?.subjects.includes(subject.id)),
    [subjects, profile],
  )
  const overall = useMemo(
    () =>
      trackedSubjects.length
        ? Math.round(trackedSubjects.reduce((sum, subject) => sum + subject.progress, 0) / trackedSubjects.length)
        : 0,
    [trackedSubjects],
  )
  const weekHours = Math.round(((progress?.weekMinutes ?? 0) / 60) * 10) / 10

  const unlocked = (profile?.achievements ?? []).filter((entry) => entry.earned)

  const favoriteItems = useMemo(
    () => favorites.map((id) => resolveFavorite(id, labels.boardId ?? 'cbse', labels.classId ?? 'class-12', subjects)),
    [favorites, labels.boardId, labels.classId, subjects],
  )

  /* Unlocked badges celebrate after their stagger finishes. */
  useEffect(() => {
    const container = achievementsRef.current
    if (!container) return
    const earned = Array.from(container.querySelectorAll<HTMLElement>('[data-earned="true"]'))
    if (!earned.length) return

    const timers: number[] = []
    const cleanups: Array<() => void> = []

    earned.forEach((node, index) => {
      timers.push(
        window.setTimeout(() => {
          cleanups.push(celebrate(node))
        }, 420 + index * 130),
      )
    })

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      cleanups.forEach((cleanup) => cleanup())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openEditor = () => {
    setDraft({ name: displayName, examDate, goal: dailyGoal })
    setEditing(true)
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = draft.name.trim()
    if (!nextName) return
    setName(nextName)
    setExamDate(draft.examDate)
    setDailyGoal(draft.goal)
    saveAnswers({
      ...answers,
      examDate: draft.examDate || undefined,
      dailyGoalMinutes: draft.goal,
    })
    setEditing(false)
    try {
      await persistProfile({
        full_name: nextName,
        exam_date: draft.examDate || null,
        daily_goal_minutes: draft.goal,
      })
      profileQuery.refetch()
      toast({
        title: 'Profile updated',
        description: 'Your details and daily goal were saved.',
        variant: 'success',
      })
    } catch {
      toast({
        title: 'Could not save changes',
        description: 'Check your connection and try again.',
        variant: 'danger',
      })
    }
  }

  const rerunOnboarding = () => {
    resetOnboarding()
    toast({
      title: 'Onboarding restarted',
      description: 'Answer the setup questions again to re-personalise StudyOS.',
    })
    navigate('/onboarding')
  }

  const confirmSignOut = async () => {
    setSignOutOpen(false)
    await signOut()
    toast({
      title: 'Signed out',
      description: 'Your progress is synced — sign in again to pick up where you left off.',
    })
  }

  /* ------------------------------- states -------------------------------- */
  if (profileQuery.loading) {
    return (
      <div role="status" aria-live="polite" className="space-y-6 sm:space-y-8">
        <span className="sr-only">Loading your profile…</span>
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (profileQuery.error) {
    return <ErrorState onRetry={profileQuery.refetch} />
  }

  if (!profile) {
    return (
      <EmptyState
        title="No profile yet"
        description="Finish setup and your profile, stats and achievements will appear here."
        action={
          <LinkButton to="/onboarding" variant="outline" size="md">
            Run setup
          </LinkButton>
        }
      />
    )
  }

  const Editor = isMobile ? BottomSheet : Modal
  const targetLabel = examDate
    ? `${formatDate(examDate)} · ${daysUntil(examDate)} days to go`
    : profile.targetExam

  return (
    <div ref={pageRef} className="space-y-6 sm:space-y-8">
      {/* ------------------------------ identity ------------------------------ */}
      <section aria-labelledby="profile-name" className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar name={displayName} initials={profile.initials} src={profile.avatar || undefined} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 id="profile-name" className="clamp-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {displayName}
                </h1>
                <p className="mt-1 clamp-1 text-sm text-muted">
                  @{profile.username} · {profile.school}
                </p>
              </div>
              <IconButton label="Edit profile" variant="outline" size="lg" onClick={openEditor}>
                <Pencil />
              </IconButton>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="brand" icon={<GraduationCap />}>
                {labels.board} · {labels.classLabel}
              </Badge>
              {labels.stream && <Badge variant="neutral">{labels.stream}</Badge>}
              <Badge variant="success" icon={<Flame />}>
                <span className="tabular">{profile.streak}</span> day streak
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <InfoItem label="Target exam" value={targetLabel} />
          <InfoItem label="Daily goal" value={formatDuration(dailyGoal)} />
          <InfoItem label="School" value={profile.school} />
          <InfoItem label="Member since" value={formatDate(profile.joined)} />
        </div>
      </section>

      {/* -------------------------------- stats -------------------------------- */}
      <section aria-labelledby="profile-stats">
        <SectionHeader
          id="profile-stats"
          title="Your numbers"
          subtitle="Streak, study time and problem solving"
        />
        {progressQuery.error ? (
          <ErrorState
            compact
            title="Stats unavailable"
            description="We could not load your study numbers. Check your connection and try again."
            onRetry={progressQuery.refetch}
          />
        ) : (
          <div ref={statsRef} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProfileStat icon={<Flame />} label="Study streak" value={profile.streak} suffix="days" />
            <ProfileStat icon={<Clock />} label="Hours this week" value={weekHours} suffix="hrs" decimals={1} />
            <ProfileStat icon={<BookOpen />} label="Chapters completed" value={profile.chaptersCompleted} />
            <ProfileStat icon={<Target />} label="Questions solved" value={profile.questionsSolved} />
          </div>
        )}
      </section>

      {/* ------------------------------- progress ------------------------------ */}
      <section aria-labelledby="profile-progress">
        <SectionHeader
          id="profile-progress"
          title="Syllabus progress"
          subtitle={`${labels.board} ${labels.classLabel} · ${trackedSubjects.length} subjects tracked`}
        />
        {trackedSubjects.length === 0 ? (
          <EmptyState
            compact
            title="No subjects tracked yet"
            description="Practise in the library or answer a few setup questions and your syllabus progress will show up here."
          />
        ) : (
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex shrink-0 flex-col items-center gap-2 sm:w-44">
              <ProgressRing value={overall} size={112} stroke={9} label={`Overall syllabus ${overall}%`}>
                <span className="tabular text-2xl font-bold leading-none text-foreground">{overall}%</span>
                <span className="mt-1 text-[11px] font-medium text-muted">syllabus</span>
              </ProgressRing>
              <p className="text-center text-[12px] text-muted">
                <span className="tabular font-semibold text-foreground">{profile.chaptersCompleted}</span>{' '}
                chapters fully completed
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              {trackedSubjects.map((subject) => {
                const accent = subjectAccent(subject.id)
                return (
                  <div key={subject.id} className={accent.text}>
                    <ProgressBar
                      variant="current"
                      size="sm"
                      value={subject.progress}
                      label={subject.name}
                      valueText={`${subject.progress}%`}
                    />
                    <p className="mt-1 text-[12px] text-muted">
                      <span className="tabular">
                        {subject.completedChapters}/{subject.totalChapters}
                      </span>{' '}
                      chapters · <span className="tabular">{subject.accuracy}%</span> accuracy
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
        )}
      </section>

      {/* ----------------------------- achievements ---------------------------- */}
      <section aria-labelledby="profile-achievements">
        <SectionHeader
          id="profile-achievements"
          title="Achievements"
          subtitle="Badges for consistency and mastery"
          action={
            <Badge variant="brand" icon={<Trophy />}>
              <span className="tabular">{unlocked.length}</span> of {profile.achievements.length}
            </Badge>
          }
        />
        {profile.achievements.length === 0 ? (
          <EmptyState
            compact
            title="No badges yet"
            description="Keep your streak alive and complete chapters — badges unlock as you go."
          />
        ) : (
        <ul ref={achievementsRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {profile.achievements.map((entry) => (
            <li
              key={entry.id}
              data-achievement
              data-earned={entry.earned ? 'true' : undefined}
              className={cn(
                'rounded-card border p-4 shadow-card',
                entry.earned ? 'border-border bg-surface' : 'border-border bg-surface-muted',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  data-celebrate-icon
                  aria-hidden
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-tile [&_svg]:h-[18px] [&_svg]:w-[18px]',
                    entry.earned ? 'bg-brand-soft text-brand-soft-fg' : 'bg-surface-sunken text-faint',
                  )}
                >
                  {entry.earned ? ACHIEVEMENT_ICONS[entry.icon] : <Lock />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight text-foreground">{entry.title}</p>
                  <p className="mt-1 clamp-2 text-[12px] leading-snug text-muted">{entry.description}</p>
                </div>
              </div>
              {entry.earned ? (
                <div className="mt-3">
                  <Badge variant="success" icon={<Trophy />}>
                    Unlocked
                  </Badge>
                </div>
              ) : typeof entry.progress === 'number' ? (
                <ProgressBar
                  className="mt-3"
                  size="xs"
                  variant="warning"
                  value={entry.progress}
                  label={`${entry.title} progress`}
                  valueText={`${entry.progress}%`}
                />
              ) : null}
            </li>
          ))}
        </ul>
        )}
      </section>

      {/* ------------------------------- activity ------------------------------ */}
      <section aria-labelledby="profile-activity">
        <SectionHeader
          id="profile-activity"
          title="Recent activity"
          subtitle="Your last study sessions, newest first"
        />
        {profile.history.length === 0 ? (
          <EmptyState
            compact
            title="No activity yet"
            description="Your recent study sessions will show up here, newest first."
          />
        ) : (
        <Card padded={false}>
          <ol ref={activityRef}>
            {profile.history.map((entry) => {
              const accent = subjectAccent(entry.subjectId)
              return (
                <li key={entry.id} className="border-t border-border first:border-t-0">
                  <Link
                    to={`/library/${labels.boardId}/${labels.classId}/${entry.subjectId}`}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-muted"
                  >
                    <span aria-hidden className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', accent.solid)} />
                    <span className="min-w-0 flex-1">
                      <span className="block clamp-1 text-sm font-medium text-foreground">{entry.title}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {subjectNameOf(entry.subjectId, subjects)} · {formatShortDate(entry.date)} ·{' '}
                        <span className="tabular">{entry.questions}</span> questions
                      </span>
                    </span>
                    <Badge variant="neutral" className="tabular shrink-0">
                      {formatDuration(entry.minutes)}
                    </Badge>
                  </Link>
                </li>
              )
            })}
          </ol>
        </Card>
        )}
      </section>

      {/* ------------------------------- favourites ---------------------------- */}
      <section aria-labelledby="profile-favorites">
        <SectionHeader
          id="profile-favorites"
          title="Favourites"
          subtitle="Chapters you pinned for quick recall"
          action={
            <LinkButton to="/pyq" variant="ghost" size="md" iconRight={<ArrowRight />}>
              PYQ archive
            </LinkButton>
          }
        />
        {favoriteItems.length === 0 ? (
          <EmptyState
            compact
            title="No favourites yet"
            description="Bookmark chapters, notes and PYQ papers and they will show up here."
            action={
              <LinkButton to="/library" variant="outline" size="md" icon={<Bookmark />}>
                Browse library
              </LinkButton>
            }
          />
        ) : (
          <Card padded={false}>
            <ul ref={favoritesRef}>
              {favoriteItems.map((item) => (
                <li key={item.id} className="border-t border-border first:border-t-0">
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-muted"
                  >
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-soft-fg [&_svg]:h-[18px] [&_svg]:w-[18px]"
                    >
                      <Bookmark />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block clamp-1 text-sm font-medium text-foreground">{item.title}</span>
                      <span className="mt-0.5 block text-[12px] text-muted">{item.meta}</span>
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* -------------------------------- account ------------------------------ */}
      <section aria-labelledby="profile-account">
        <SectionHeader
          id="profile-account"
          title="Account"
          subtitle="Replay setup, tune preferences or end the session"
        />
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="secondary"
              fullWidth
              className="sm:w-auto"
              icon={<RotateCcw />}
              onClick={rerunOnboarding}
            >
              Re-run onboarding
            </Button>
            <LinkButton to="/settings" variant="outline" fullWidth className="sm:w-auto" icon={<Settings />}>
              Settings
            </LinkButton>
            <Button
              variant="outline"
              fullWidth
              className="sm:w-auto"
              icon={<LogOut />}
              onClick={() => setSignOutOpen(true)}
            >
              Sign out
            </Button>
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Signed in as <span className="font-medium text-foreground">@{profile.username}</span> ·{' '}
            {formatDuration(answers.dailyGoalMinutes)} daily goal
          </p>
        </Card>
      </section>

      {/* ------------------------------ edit sheet ----------------------------- */}
      <Editor
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit profile"
        description="Changes sync to your StudyOS account."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="profile-edit-form"
              disabled={!draft.name.trim()}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="profile-edit-form" onSubmit={saveProfile} className="space-y-4">
          <Input
            label="Display name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            maxLength={48}
            autoComplete="name"
          />
          <Input
            label="Exam target date"
            type="date"
            value={draft.examDate}
            onChange={(event) => setDraft({ ...draft, examDate: event.target.value })}
            hint={
              draft.examDate
                ? `${formatDate(draft.examDate)} · ${daysUntil(draft.examDate)} days left`
                : 'Powers the countdown shown on your profile.'
            }
          />
          <Slider
            label="Daily study goal"
            min={30}
            max={360}
            step={15}
            value={draft.goal}
            onChange={(value) => setDraft({ ...draft, goal: value })}
            valueText={formatDuration(draft.goal)}
          />
        </form>
      </Editor>

      {/* ------------------------------ sign out ------------------------------- */}
      <Modal
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out of StudyOS?"
        description="You will need to sign in again to sync progress across devices."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSignOutOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmSignOut()}>
              Sign out
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Your streak, achievements and saved chapters stay synced to your account — nothing is
          deleted when you sign out.
        </p>
      </Modal>
    </div>
  )
}
