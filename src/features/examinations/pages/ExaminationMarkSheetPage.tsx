import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import GroupsIcon from '@mui/icons-material/Groups'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { formatDate } from '@/lib/dates'
import { getErrorStatus } from '@/lib/serverErrors'
import { ExaminationFormDialog } from '../components/ExaminationFormDialog'
import { MarkSheetTable } from '../components/MarkSheetTable'
import { useGetExaminationQuery, useGetExaminationResultsQuery } from '../examinationsApi'
import { formatDuration, formatPercentage, markSheetSummary } from '../examinationRules'

/** One label/value pair in the examination header. */
function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  )
}

/**
 * `/examinations/:examinationId` — the mark sheet, ranked, with the examination above it.
 *
 * Two requests, and the split matters. `GET {id}/results` returns an empty array both for an
 * examination that does not exist and for one whose class has no students, so it cannot tell
 * "deleted" from "empty" on its own. `GET {id}` answers 404 for a soft-deleted exam, and that
 * is what this screen checks first — otherwise a stale link would render a plausible-looking
 * empty sheet for an examination that was withdrawn along with all its marks.
 *
 * Read-only. Marks are written through ResultsController, which is Phase 11; everything here
 * reports on what those writes have produced so far.
 */
export default function ExaminationMarkSheetPage() {
  const params = useParams<{ examinationId: string }>()
  const examinationId = Number(params.examinationId)
  const validId = Number.isInteger(examinationId) && examinationId > 0

  const [editOpen, setEditOpen] = useState(false)

  const {
    data: exam,
    isLoading: loadingExam,
    error: examError,
    refetch: refetchExam,
  } = useGetExaminationQuery(examinationId, { skip: !validId })

  const {
    data: rows,
    isLoading: loadingRows,
    isFetching: fetchingRows,
    error: rowsError,
    refetch: refetchRows,
  } = useGetExaminationResultsQuery(examinationId, { skip: !validId })

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid examination reference.</Alert>
      </Box>
    )
  }

  if (loadingExam) return <FullPageLoader label="Loading the examination…" />

  if (examError) {
    // 404 is the interesting one: the exam was deleted, which also withdrew its marks. Saying
    // that is more use than "not found", because the marks are the thing someone came for.
    if (getErrorStatus(examError) === 404) {
      return (
        <Box sx={{ py: 4 }}>
          <EmptyState
            title="This examination no longer exists"
            description="It was deleted, which withdrew every mark entered against it. Deleted examinations cannot be reopened from here."
            action={
              <Button component={RouterLink} to="/examinations" startIcon={<ArrowBackIcon />}>
                Back to examinations
              </Button>
            }
          />
        </Box>
      )
    }
    return <ErrorState error={examError} onRetry={() => void refetchExam()} />
  }

  if (!exam) return null

  const summary = markSheetSummary(rows ?? [])

  return (
    <Box>
      <PageHeader
        title={exam.examName}
        subtitle={`${exam.subjectName} · ${exam.className} · ${formatDate(exam.examDate)}`}
        actions={
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/examinations" startIcon={<ArrowBackIcon />}>
              All examinations
            </Button>
            <Can module="Examinations" action="Edit">
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            </Can>
          </Stack>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
          }}
        >
          <HeaderFact label="Type" value={exam.examType} />
          <HeaderFact
            label="Subject"
            value={exam.subjectCode ? `${exam.subjectName} (${exam.subjectCode})` : exam.subjectName}
          />
          <HeaderFact label="Class" value={`${exam.className} · grade ${exam.grade}`} />
          <HeaderFact label="Date" value={formatDate(exam.examDate)} />
          <HeaderFact label="Marks" value={`${exam.maxMarks}, pass at ${exam.passingMarks}`} />
          <HeaderFact label="Duration" value={formatDuration(exam.duration)} />
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          label="Marked"
          value={`${summary.marked} of ${summary.onRoll}`}
          caption="Students on the class roll with a mark entered"
          icon={GroupsIcon}
        />
        <StatCard
          label="Pass rate"
          // Over the marked students, not the class. A third-marked exam reporting a third of
          // its real pass rate would read as a disaster rather than as unfinished work.
          value={formatPercentage(summary.passRate)}
          caption={
            summary.marked === 0
              ? 'Nothing marked yet'
              : `${summary.passed} passed, ${summary.failed} failed of ${summary.marked} marked`
          }
          icon={TrendingUpIcon}
          iconColor={summary.passRate !== null && summary.passRate < 50 ? 'warning.main' : 'success.main'}
        />
        <StatCard
          label="Average"
          value={formatPercentage(summary.averagePercentage)}
          caption="Mean percentage across the marked students"
          icon={TrendingUpIcon}
        />
        <StatCard
          label="Highest"
          value={
            summary.highest === null ? '—' : `${summary.highest.obtainedMarks} / ${exam.maxMarks}`
          }
          caption={
            summary.highest === null
              ? 'No marks entered'
              : `${summary.highest.firstName} ${summary.highest.lastName}`
          }
          icon={EmojiEventsIcon}
          iconColor={summary.highest === null ? 'text.disabled' : 'warning.main'}
        />
      </Box>

      {summary.unmarked > 0 && (
        <Alert
          severity={summary.marked === 0 ? 'info' : 'warning'}
          icon={<PendingActionsIcon />}
          sx={{ mb: 2 }}
          action={
            <Chip
              size="small"
              label={`${summary.unmarked} outstanding`}
              color={summary.marked === 0 ? 'info' : 'warning'}
            />
          }
        >
          {summary.marked === 0
            ? 'No marks have been entered for this examination yet. Every student below shows as not marked, which is not the same as a zero.'
            : `${summary.unmarked} of ${summary.onRoll} students have no mark yet. They appear at the end of the sheet without a rank, and the figures above are over the ${summary.marked} that are marked.`}
        </Alert>
      )}

      <MarkSheetTable
        rows={rows}
        loading={loadingRows || fetchingRows}
        error={rowsError}
        onRetry={() => void refetchRows()}
      />

      <ExaminationFormDialog
        open={editOpen}
        editing={exam}
        onClose={() => setEditOpen(false)}
      />
    </Box>
  )
}
