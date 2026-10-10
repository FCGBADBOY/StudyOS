/**
 * Admin → Analytics: user and content growth series, popularity rankings and
 * per-subject question accuracy.
 *
 * Every series is computed server-side by the `admin_*()` RPCs (see
 * `adminAnalytics.service`); those functions are SECURITY DEFINER and re-check
 * `analytics.view`, so a role without the permission makes them throw. That is
 * surfaced as an ErrorState with retry rather than an empty dashboard.
 */
import { useState, type ReactNode } from 'react'
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionHeader,
  SegmentedControl,
} from '@/components/ui'
import { useQuery, type UseQueryResult } from '@/hooks/useQuery'
import { BarChart, LineChart, MeterRow } from '../components/Charts'
import { DataTable, type Column } from '../components/DataTable'
import {
  getContentGrowth,
  getPopularChapters,
  getPopularSubjects,
  getQuestionAccuracy,
  getUserGrowth,
} from '../services/adminAnalytics.service'
import type {
  GrowthPeriod,
  GrowthPoint,
  PopularChapterRow,
  PopularSubjectRow,
  QuestionAccuracyRow,
} from '../types/admin'

const PERIOD_OPTIONS: { id: GrowthPeriod; label: string }[] = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
]

const PERIOD_NOUN: Record<GrowthPeriod, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
}

const ACCURACY_COLUMNS: Column<QuestionAccuracyRow>[] = [
  {
    key: 'subject_name',
    header: 'Subject',
    render: (row) => <span className="font-medium text-foreground">{row.subject_name}</span>,
  },
  {
    key: 'attempted',
    header: 'Attempted',
    align: 'right',
    render: (row) => row.attempted.toLocaleString('en-IN'),
  },
  {
    key: 'correct',
    header: 'Correct',
    align: 'right',
    render: (row) => row.correct.toLocaleString('en-IN'),
  },
  {
    key: 'incorrect',
    header: 'Incorrect',
    align: 'right',
    render: (row) => row.incorrect.toLocaleString('en-IN'),
  },
  {
    key: 'accuracy',
    header: 'Accuracy',
    align: 'right',
    render: (row) => (row.accuracy == null ? '—' : `${row.accuracy.toLocaleString('en-IN')}%`),
  },
]

/**
 * Card shell that owns its query states: the card is only rendered once data
 * exists, so loading and error replace it instead of nesting inside it.
 */
function CardQuery<T>({
  query,
  title,
  subtitle,
  label,
  children,
}: {
  query: UseQueryResult<T>
  title: string
  subtitle?: string
  /** Lower-case name used in the loading / error copy. */
  label: string
  children: (data: T) => ReactNode
}) {
  if (query.data === undefined) {
    if (query.error) {
      return <ErrorState title={`Could not load ${label}`} description={query.error} onRetry={query.refetch} />
    }
    return <LoadingState label={`Loading ${label}`} />
  }

  return (
    <Card as="section">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="mt-4">{children(query.data)}</div>
    </Card>
  )
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<GrowthPeriod>('month')

  const userGrowth = useQuery<GrowthPoint[]>(`admin:analytics:user-growth:${period}`, () => getUserGrowth(period))
  const contentGrowth = useQuery<GrowthPoint[]>(`admin:analytics:content-growth:${period}`, () =>
    getContentGrowth(period),
  )
  const subjects = useQuery<PopularSubjectRow[]>('admin:analytics:popular-subjects', () => getPopularSubjects(8))
  const chapters = useQuery<PopularChapterRow[]>('admin:analytics:popular-chapters', () => getPopularChapters(8))
  const accuracy = useQuery<QuestionAccuracyRow[]>('admin:analytics:question-accuracy', () => getQuestionAccuracy())

  const queries = [userGrowth, contentGrowth, subjects, chapters, accuracy]
  const firstError = queries.find((query) => query.error !== null)?.error ?? null
  /* A role without `analytics.view` makes every RPC throw — gate the page. */
  const blocked = firstError !== null && queries.every((query) => query.data === undefined)

  function retryAll() {
    for (const query of queries) query.refetch()
  }

  const periodNoun = PERIOD_NOUN[period]

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Platform growth, content trends and question performance." />

      {blocked ? (
        <ErrorState
          title="Analytics are unavailable"
          description={firstError ?? 'Your account does not have access to platform analytics.'}
          onRetry={retryAll}
        />
      ) : (
        <>
          <div className="flex justify-end">
            <SegmentedControl<GrowthPeriod>
              label="Growth period"
              options={PERIOD_OPTIONS}
              value={period}
              onChange={setPeriod}
            />
          </div>

          {/* ---------------------------------------------------- growth */}
          <div className="grid gap-4 lg:grid-cols-2">
            <CardQuery
              query={userGrowth}
              title="User growth"
              subtitle={`Accounts added per ${periodNoun}`}
              label="user growth"
            >
              {(data) => (
                <LineChart
                  title={`User growth per ${periodNoun}`}
                  data={data.map((point) => ({ label: point.label, value: Number(point.total) }))}
                />
              )}
            </CardQuery>

            <CardQuery
              query={contentGrowth}
              title="Content growth"
              subtitle={`Resources and PYQs added per ${periodNoun}`}
              label="content growth"
            >
              {(data) => (
                <BarChart
                  title={`Content growth per ${periodNoun}`}
                  primaryLabel="Resources added"
                  data={data.map((point) => ({
                    label: point.label,
                    value: Number(point.resources),
                    secondary: Number(point.pyqs),
                    secondaryLabel: 'PYQs added',
                  }))}
                />
              )}
            </CardQuery>
          </div>

          {/* ------------------------------------------------ popularity */}
          <div className="grid gap-4 lg:grid-cols-2">
            <CardQuery
              query={subjects}
              title="Popular subjects"
              subtitle="Students active in each subject"
              label="popular subjects"
            >
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState
                    compact
                    title="No subject activity yet"
                    description="Subject popularity appears once students start studying."
                  />
                ) : (
                  <ul className="space-y-3.5">
                    {rows.map((row) => (
                      <MeterRow
                        key={row.subject_id}
                        label={row.subject_name}
                        value={row.students}
                        max={rows[0].students}
                        detail={`${row.students.toLocaleString('en-IN')} students`}
                      />
                    ))}
                  </ul>
                )
              }
            </CardQuery>

            <CardQuery
              query={chapters}
              title="Popular chapters"
              subtitle="The chapters students open most"
              label="popular chapters"
            >
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState
                    compact
                    title="No chapter activity yet"
                    description="Chapter popularity appears once students start studying."
                  />
                ) : (
                  <ul className="space-y-3.5">
                    {rows.map((row) => (
                      <MeterRow
                        key={row.chapter_id}
                        label={row.chapter_name}
                        value={row.students}
                        max={rows[0].students}
                        detail={row.subject_name}
                      />
                    ))}
                  </ul>
                )
              }
            </CardQuery>
          </div>

          {/* -------------------------------------- question performance */}
          <section aria-label="Question performance" className="space-y-3">
            <SectionHeader
              title="Question performance"
              subtitle="Attempt volume and accuracy for each subject."
            />

            {accuracy.data === undefined ? (
              accuracy.error ? (
                <ErrorState
                  title="Could not load question performance"
                  description={accuracy.error}
                  onRetry={accuracy.refetch}
                />
              ) : (
                <LoadingState label="Loading question performance" />
              )
            ) : (
              <DataTable
                caption="Question performance by subject"
                columns={ACCURACY_COLUMNS}
                rows={accuracy.data}
                rowKey={(row) => row.subject_name}
                empty={
                  <EmptyState
                    compact
                    title="No attempts recorded yet"
                    description="Accuracy appears once students start attempting questions."
                  />
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}
