import { useMemo, useState, type ReactNode } from 'react'
import {
  Bell,
  Bookmark,
  CalendarDays,
  Clock,
  Database,
  FileText,
  Flame,
  GraduationCap,
  Info,
  Layers,
  Palette,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  Trash,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconTile,
  LinkButton,
  Modal,
  PageHeader,
  SectionHeader,
  SegmentedControl,
  Select,
  Skeleton,
  Slider,
  Switch,
} from '@/components/ui'
import { useBoards, useClasses, useProfile, useStagger, useStreams } from '@/hooks'
import { useApp, useTheme, useToast } from '@/context/AppProvider'
import type { ThemeKey } from '@/config/visual'
import { formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Board, ClassOption, OnboardingAnswers, ProfileUser, StreamOption, ThemePreference } from '@/types'

/* ------------------------------- constants -------------------------------- */

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

const REMINDER_SLOTS = ['06:30', '13:00', '19:30', '21:30']

const OPEN_SOURCE = [
  { name: 'React', version: '19.3', license: 'MIT', detail: 'UI runtime' },
  { name: 'React Router', version: '7.18', license: 'MIT', detail: 'Client-side routing' },
  { name: 'Vite', version: '7.3', license: 'MIT', detail: 'Dev server and bundler' },
  { name: 'Tailwind CSS', version: '4.3', license: 'MIT', detail: 'Design-token styling' },
  { name: 'Anime.js', version: '4.5', license: 'MIT', detail: 'Every animation in the app' },
  { name: 'Lucide', version: '1.52', license: 'ISC', detail: 'Interface icons' },
]

type ConfirmKind = 'searches' | 'favorites' | 'onboarding'

/* -------------------------------- helpers --------------------------------- */

/** Onboarding answers first, profile data as the fallback. */
function academicLabels(
  answers: OnboardingAnswers,
  profile: ProfileUser | undefined,
  boards: Board[],
  classes: ClassOption[],
  streams: StreamOption[],
) {
  const board =
    boards.find((entry) => entry.id === (answers.board ?? profile?.board))?.name ?? profile?.boardName ?? '—'
  const classLabel =
    classes.find((entry) => entry.id === (answers.classId ?? profile?.classId))?.name ??
    profile?.className ??
    '—'
  const stream = answers.streamId
    ? streams.find((entry) => entry.id === answers.streamId)?.name ?? profile?.streamName
    : profile?.streamName
  return { board, classLabel, stream }
}

/** `19:30` → `7:30 PM` */
function formatTime(value: string): string {
  const [rawHour, rawMinute] = value.split(':')
  const hour = Number(rawHour)
  const minute = rawMinute ?? '00'
  if (Number.isNaN(hour)) return value
  const period = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minute} ${period}`
}

function reminderOptions(current: string): { id: string; label: string }[] {
  const slots = REMINDER_SLOTS.includes(current) ? REMINDER_SLOTS : [current, ...REMINDER_SLOTS]
  return slots.map((slot) => ({ id: slot, label: formatTime(slot) }))
}

/* --------------------------------- rows ----------------------------------- */

/**
 * One preference row: a designed icon tile, then the label/description and the
 * control. Separation comes from a hairline divider and the card tone — the
 * row itself never draws a box.
 */
function RowShell({
  icon,
  theme = 'settings',
  children,
  className,
}: {
  icon?: ReactNode
  theme?: ThemeKey
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('border-t border-border px-4 py-4 first:border-t-0 sm:px-5', className)}>
      <div className="flex items-start gap-3 sm:gap-4">
        {icon && <IconTile icon={icon} theme={theme} size="sm" className="mt-0.5" />}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

/** Label + description on the left, control on the right (full width on phones). */
function SettingRow({
  title,
  description,
  icon,
  theme,
  children,
  controlClassName,
}: {
  title: string
  description?: string
  icon?: ReactNode
  theme?: ThemeKey
  children: ReactNode
  controlClassName?: string
}) {
  return (
    <RowShell icon={icon} theme={theme}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
        </div>
        <div className={cn('w-full sm:w-64 sm:shrink-0', controlClassName)}>{children}</div>
      </div>
    </RowShell>
  )
}

/* --------------------------------- page ----------------------------------- */

export default function SettingsPage() {
  const {
    preferences,
    updatePreference,
    answers,
    saveAnswers,
    favorites,
    toggleFavorite,
    recentSearches,
    clearRecentSearches,
    resetOnboarding,
  } = useApp()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const boardsQuery = useBoards()
  const classesQuery = useClasses()
  const streamsQuery = useStreams()
  const profileQuery = useProfile()

  const boards = useMemo(() => boardsQuery.data ?? [], [boardsQuery.data])
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data])
  const streams = useMemo(() => streamsQuery.data ?? [], [streamsQuery.data])
  const profile = profileQuery.data

  const pageRef = useStagger<HTMLDivElement>({ step: 55, distance: 16 })
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)
  const [licensesOpen, setLicensesOpen] = useState(false)

  const labels = useMemo(
    () => academicLabels(answers, profile, boards, classes, streams),
    [answers, profile, boards, classes, streams],
  )

  /* Board / class / stream selectors — one reload covers every option list. */
  const optionsLoading =
    boardsQuery.loading || classesQuery.loading || streamsQuery.loading || profileQuery.loading
  const optionsError =
    boardsQuery.error ?? classesQuery.error ?? streamsQuery.error ?? profileQuery.error
  const retryOptions = () => {
    boardsQuery.refetch()
    classesQuery.refetch()
    streamsQuery.refetch()
    profileQuery.refetch()
  }

  const confirmConfig =
    confirm === 'searches'
      ? {
          title: 'Clear recent searches?',
          description: `Removes all ${recentSearches.length} recent ${
            recentSearches.length === 1 ? 'search' : 'searches'
          } stored on this device.`,
          body: 'Nothing else is touched — you can build a new history with your very next search.',
          confirmLabel: 'Clear searches',
          action: () => {
            clearRecentSearches()
            toast({
              title: 'Recent searches cleared',
              description: 'Your search history is empty again.',
              variant: 'success',
            })
          },
        }
      : confirm === 'favorites'
        ? {
            title: 'Clear favourites?',
            description: `Removes all ${favorites.length} saved ${
              favorites.length === 1 ? 'item' : 'items'
            } from your favourites list.`,
            body: 'The chapters and papers themselves stay in the library — only the quick list is cleared.',
            confirmLabel: 'Clear favourites',
            action: () => {
              favorites.forEach((id) => toggleFavorite(id))
              toast({
                title: 'Favourites cleared',
                description: 'Everything was removed from your saved list.',
                variant: 'success',
              })
            },
          }
        : confirm === 'onboarding'
          ? {
              title: 'Reset onboarding?',
              description: 'Board, class, subjects and daily goal return to their defaults.',
              body: 'Run setup again to re-answer the questions — study data, streaks and favourites are kept.',
              confirmLabel: 'Reset setup',
              action: () => {
                resetOnboarding()
                toast({
                  title: 'Onboarding reset',
                  description: 'Replay setup from the landing page whenever you are ready.',
                  variant: 'success',
                })
              },
            }
          : null

  return (
    <div ref={pageRef} className="space-y-7 sm:space-y-9">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Appearance, study preferences, stored data and app info"
        actions={
          <LinkButton to="/profile" variant="outline" size="md">
            View profile
          </LinkButton>
        }
      />

      {/* ------------------------------ appearance ----------------------------- */}
      <section aria-labelledby="settings-appearance">
        <SectionHeader
          id="settings-appearance"
          eyebrow="Look & feel"
          title="Appearance"
          subtitle="Theme and motion across the whole app"
        />
        <Card padded={false}>
          <SettingRow
            title="Theme"
            description="System follows your device setting live."
            icon={<Palette />}
            theme="settings"
            controlClassName="sm:w-72"
          >
            <SegmentedControl<ThemePreference>
              options={THEME_OPTIONS}
              value={theme}
              onChange={(next) => setTheme(next)}
              label="Colour theme"
            />
          </SettingRow>

          <RowShell icon={<Sparkles />} theme="ai">
            <Switch
              checked={preferences.reduceMotion}
              onChange={(checked) => {
                updatePreference('reduceMotion', checked)
                toast({
                  title: checked ? 'Motion reduced' : 'Motion enabled',
                  description: checked
                    ? 'Transitions now snap instantly everywhere in StudyOS.'
                    : 'Anime.js motion is back across every screen.',
                  variant: checked ? 'warning' : 'success',
                })
              }}
              label="Reduce motion"
              description="Switches off entrance animations app-wide — useful for motion sensitivity."
            />
          </RowShell>
        </Card>
      </section>

      {/* -------------------------------- study -------------------------------- */}
      <section aria-labelledby="settings-study">
        <SectionHeader
          id="settings-study"
          eyebrow="Your routine"
          title="Study"
          subtitle="Goal, curriculum and what we notify you about"
        />
        <Card padded={false}>
          <RowShell icon={<Target />} theme="planner">
            <Slider
              label="Daily study goal"
              min={30}
              max={360}
              step={15}
              value={answers.dailyGoalMinutes}
              onChange={(value) => saveAnswers({ ...answers, dailyGoalMinutes: value })}
              valueText={formatDuration(answers.dailyGoalMinutes)}
            />
            <p className="mt-2 text-[13px] leading-snug text-muted">
              Paces your planner load, home ring and reminder scheduling. Saved as you drag.
            </p>
          </RowShell>

          <SettingRow
            title="Board & class"
            description={`${labels.stream ?? 'Custom stream'} · used for every library and PYQ path`}
            icon={<GraduationCap />}
            theme="profile"
          >
            {optionsLoading ? (
              <Skeleton className="h-11 w-full" />
            ) : optionsError ? (
              <ErrorState
                compact
                illustration="graduation"
                theme="profile"
                title="Couldn't load your classes"
                description="We could not load the board and class options. Try again."
                onRetry={retryOptions}
              />
            ) : boards.length === 0 || classes.length === 0 ? (
              <EmptyState
                compact
                illustration="graduation"
                theme="profile"
                title="No options yet"
                description="Board and class options will appear here once they are available."
              />
            ) : (
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-sm font-medium text-foreground">
                  {labels.board} · {labels.classLabel}
                </span>
                <LinkButton to="/onboarding" variant="outline" size="md">
                  Change
                </LinkButton>
              </div>
            )}
          </SettingRow>

          <RowShell icon={<Clock />} theme="exam">
            <Select
              id="reminder-time"
              label="Reminder time"
              options={reminderOptions(preferences.reminderTime)}
              value={preferences.reminderTime}
              onChange={(value) => {
                updatePreference('reminderTime', value)
                toast({
                  title: 'Reminder time updated',
                  description: `Daily reminders now arrive at ${formatTime(value)}.`,
                  variant: 'success',
                })
              }}
            />
            <p className="mt-2 text-[13px] leading-snug text-muted">
              When the daily study reminder lands on this device.
            </p>
          </RowShell>

          <RowShell icon={<Bell />} theme="planner">
            <Switch
              checked={preferences.studyReminders}
              onChange={(checked) => {
                updatePreference('studyReminders', checked)
                toast({
                  title: checked ? 'Daily reminders on' : 'Daily reminders off',
                  description: checked
                    ? `A nudge at ${formatTime(preferences.reminderTime)} every day.`
                    : 'You will not get the daily study nudge.',
                  variant: checked ? 'success' : 'default',
                })
              }}
              label="Daily reminder"
              description="A single push at your reminder time to protect the streak."
            />
          </RowShell>

          <RowShell icon={<CalendarDays />} theme="exam">
            <Switch
              checked={preferences.notifications}
              onChange={(checked) => {
                updatePreference('notifications', checked)
                toast({
                  title: checked ? 'Exam alerts on' : 'Exam alerts off',
                  description: checked
                    ? 'Countdowns, date sheets and syllabus changes will reach you.'
                    : 'Exam-related alerts are muted.',
                  variant: checked ? 'success' : 'default',
                })
              }}
              label="Exam alerts"
              description="Countdowns and timetable changes for your target exam."
            />
          </RowShell>

          <RowShell icon={<Flame />} theme="streak">
            <Switch
              checked={preferences.haptics}
              onChange={(checked) => {
                updatePreference('haptics', checked)
                toast({
                  title: checked ? 'Streak nudge on' : 'Streak nudge off',
                  description: checked
                    ? 'A short buzz when today’s streak is close to expiring.'
                    : 'No more buzz for a streak about to expire.',
                  variant: checked ? 'success' : 'default',
                })
              }}
              label="Streak nudge"
              description="Vibration when today’s streak is still at risk."
            />
          </RowShell>
        </Card>
      </section>

      {/* --------------------------------- data -------------------------------- */}
      {/* The only section that removes things, so it gets its own calm, warm
          ground instead of an alarming one. */}
      <section aria-labelledby="settings-data">
        <SectionHeader
          id="settings-data"
          eyebrow="Local storage"
          title="Data"
          subtitle="Everything here lives locally on this device"
          action={
            <Badge variant="neutral" icon={<Database />}>
              Local
            </Badge>
          }
        />
        <Card padded={false} tone="cream">
          <SettingRow
            title="Recent searches"
            description={
              recentSearches.length
                ? `${recentSearches.length} ${recentSearches.length === 1 ? 'entry' : 'entries'} in your search history`
                : 'No recent searches stored'
            }
            icon={<Search />}
            theme="search"
            controlClassName="sm:flex sm:justify-end"
          >
            <Button
              variant="outline"
              size="md"
              icon={<Trash />}
              disabled={recentSearches.length === 0}
              onClick={() => setConfirm('searches')}
            >
              Clear searches
            </Button>
          </SettingRow>

          <SettingRow
            title="Favourites"
            description={
              favorites.length
                ? `${favorites.length} saved ${favorites.length === 1 ? 'item' : 'items'} in your quick list`
                : 'Nothing saved yet'
            }
            icon={<Bookmark />}
            theme="library"
            controlClassName="sm:flex sm:justify-end"
          >
            <Button
              variant="outline"
              size="md"
              icon={<Trash />}
              disabled={favorites.length === 0}
              onClick={() => setConfirm('favorites')}
            >
              Clear favourites
            </Button>
          </SettingRow>

          <SettingRow
            title="Onboarding answers"
            description="Board, class, subjects, exam date and daily goal"
            icon={<Layers />}
            theme="reference"
            controlClassName="sm:flex sm:justify-end"
          >
            <Button variant="outline" size="md" icon={<RotateCcw />} onClick={() => setConfirm('onboarding')}>
              Reset setup
            </Button>
          </SettingRow>
        </Card>
      </section>

      {/* -------------------------------- about -------------------------------- */}
      <section aria-labelledby="settings-about">
        <SectionHeader
          id="settings-about"
          eyebrow="The app"
          title="About"
          subtitle="Version, licences and feedback"
        />
        <Card padded={false}>
          <SettingRow title="Version" description="StudyOS · Android-first study companion" icon={<Info />} theme="neutral">
            <span className="tabular text-sm font-semibold text-foreground sm:text-right">0.1.0</span>
          </SettingRow>

          <SettingRow
            title="Open-source licences"
            description="React, Tailwind CSS, Anime.js and friends"
            icon={<FileText />}
            theme="reference"
            controlClassName="sm:flex sm:justify-end"
          >
            <Button variant="outline" size="md" icon={<FileText />} onClick={() => setLicensesOpen(true)}>
              View credits
            </Button>
          </SettingRow>

          <SettingRow
            title="Send feedback"
            description="Bugs, requests and study-tool ideas"
            icon={<Send />}
            theme="coral"
            controlClassName="sm:flex sm:justify-end"
          >
            <Button
              variant="outline"
              size="md"
              icon={<Send />}
              onClick={() =>
                toast({
                  title: 'Feedback sent',
                  description: 'Thanks — the StudyOS team reads every note.',
                  variant: 'success',
                })
              }
            >
              Share feedback
            </Button>
          </SettingRow>
        </Card>
      </section>

      {/* ------------------------------- confirm -------------------------------- */}
      <Modal
        open={confirmConfig !== null}
        onClose={() => setConfirm(null)}
        title={confirmConfig?.title ?? 'Confirm'}
        description={confirmConfig?.description}
        className="sm:rounded-hero"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                confirmConfig?.action()
                setConfirm(null)
              }}
            >
              {confirmConfig?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">{confirmConfig?.body}</p>
      </Modal>

      {/* ------------------------------- licences -------------------------------- */}
      <Modal
        open={licensesOpen}
        onClose={() => setLicensesOpen(false)}
        title="Open-source licences"
        description="StudyOS ships with these projects."
        className="sm:rounded-hero"
        footer={
          <Button variant="primary" onClick={() => setLicensesOpen(false)}>
            Close
          </Button>
        }
      >
        <ul>
          {OPEN_SOURCE.map((entry) => (
            <li
              key={entry.name}
              className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {entry.name} <span className="tabular text-muted">v{entry.version}</span>
                </p>
                <p className="mt-0.5 text-[12px] text-muted">{entry.detail}</p>
              </div>
              <Badge variant="neutral" className="shrink-0">
                {entry.license}
              </Badge>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
