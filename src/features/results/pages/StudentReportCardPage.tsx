import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import PersonIcon from '@mui/icons-material/Person'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useMemo } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan } from '@/features/auth/permissions'
import { SubjectBreakdownTable } from '../components/SubjectBreakdownTable'
import { useGetStudentResultsQuery } from '../resultsApi'
import { formatPercent, percentTone, reportCardSummary, subjectBreakdown } from '../resultRules'

/**
 * `/results/student/:studentId` — every mark one student has been given.
 *
 * `studentId` is `Students.Id`, matching the endpoint and the write DTOs. Not `Users.Id`, which is
 * what the Teachers and Parents profile routes take — those procedures are keyed on the user, this
 * one is keyed on the student record.
 *
 * The screen carries no student name of its own beyond what the results supply, because the
 * endpoint returns only marks: an empty result set is indistinguishable from a student who does not
 * exist. That is stated rather than papered over — see the empty case below. Fetching the student
 * separately would mean a second request and `Students:View`, which a teacher holding
 * `Results:View` does not necessarily have.
 */
export default function StudentReportCardPage() {
  const params = useParams<{ studentId: string }>()
  const studentId = Number(params.studentId)
  const validId = Number.isInteger(studentId) && studentId > 0

  const canViewStudents = useCan('Students', 'View')

  const { data, isLoading, error, refetch } = useGetStudentResultsQuery(studentId, {
    skip: !validId,
  })

  const summary = useMemo(() => reportCardSummary(data ?? []), [data])
  const groups = useMemo(() => subjectBreakdown(data ?? []), [data])

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid student reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the report card…" />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  const rows = data ?? []
  // Every row carries the same student, so the first is as good as any for the heading.
  const first = rows[0]

  const backButton = (
    <Button component={RouterLink} to="/results" startIcon={<ArrowBackIcon />}>
      Grade entry
    </Button>
  )

  if (rows.length === 0) {
    return (
      <Box>
        <PageHeader title="Report card" actions={backButton} />
        <EmptyState
          title="No marks recorded"
          description={
            // Deliberately ambiguous, because the API is: sp_GetStudentResults returns an empty set
            // both for a student with no marks and for a student id that does not exist in this
            // school. There is no endpoint that distinguishes them without Students:View.
            'This student has no results yet — or this student reference does not belong to your school. The results endpoint answers the same way to both, so there is no telling from here.'
          }
          action={
            <Stack direction="row" spacing={1}>
              {backButton}
              {canViewStudents && (
                <Button component={RouterLink} to={`/students/${studentId}`}>
                  Open the student record
                </Button>
              )}
            </Stack>
          }
        />
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Report card"
        subtitle={
          first
            ? `${summary.count} result${summary.count === 1 ? '' : 's'} across ${summary.subjects} subject${summary.subjects === 1 ? '' : 's'}`
            : undefined
        }
        actions={
          <Stack direction="row" spacing={1}>
            {backButton}
            {canViewStudents && (
              <Button
                variant="outlined"
                component={RouterLink}
                to={`/students/${studentId}`}
                startIcon={<PersonIcon />}
              >
                Student record
              </Button>
            )}
          </Stack>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          label="Average"
          // Of the percentages, not of the raw marks: a 40-mark quiz and a 100-mark final are not
          // comparable as marks, and averaging those would weight the final more heavily by
          // accident rather than by intent.
          value={formatPercent(summary.averagePercentage)}
          caption="Mean of the percentages, not of the marks"
          icon={TrendingUpIcon}
          iconColor={`${percentTone(summary.averagePercentage)}.main`}
        />
        <StatCard
          label="Passed"
          value={`${summary.passed} of ${summary.count}`}
          caption={summary.failed === 0 ? 'Every examination passed' : `${summary.failed} not passed`}
          icon={EmojiEventsIcon}
          iconColor={summary.failed === 0 ? 'success.main' : 'warning.main'}
        />
        <StatCard
          label="Best"
          value={summary.best ? formatPercent(summary.best.percentage) : '—'}
          caption={summary.best ? `${summary.best.subjectName} · ${summary.best.examName}` : undefined}
          icon={TrendingUpIcon}
          iconColor="success.main"
        />
        <StatCard
          label="Weakest"
          value={summary.worst ? formatPercent(summary.worst.percentage) : '—'}
          caption={
            summary.worst ? `${summary.worst.subjectName} · ${summary.worst.examName}` : undefined
          }
          icon={TrendingDownIcon}
          iconColor={summary.worst && summary.worst.isPass ? 'text.secondary' : 'error.main'}
        />
      </Box>

      {summary.failed > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>What this card does and does not show</AlertTitle>
          Only examinations this student has been marked for appear. An examination they sat but
          nobody has marked yet is absent entirely rather than showing as a zero — so a short card is
          not evidence of a short term. The mark sheet for an examination shows who is still
          unmarked.
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
        <MenuBookIcon fontSize="small" color="action" />
        <Typography variant="subtitle1">By subject</Typography>
      </Stack>

      <SubjectBreakdownTable groups={groups} />
    </Box>
  )
}
