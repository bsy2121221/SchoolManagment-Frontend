import GradingIcon from '@mui/icons-material/Grading'
import LockPersonIcon from '@mui/icons-material/LockPerson'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan, useModulePermissions } from '@/features/auth/permissions'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { useGetExaminationsQuery } from '@/features/examinations/examinationsApi'
import { formatDate } from '@/lib/dates'
import { getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { GradeEntryTable } from '../components/GradeEntryTable'
import { useBulkGradeEntryMutation, useGetGradeEntryRollQuery } from '../resultsApi'
import { draftsFromRows, entryProgress, pendingRecord } from '../resultRules'
import type { GradeDraft } from '../resultRules'

/**
 * `/results` — entering marks for one examination's class.
 *
 * The picker is **class then examination**, not class-then-subject-then-examination, even though
 * `GET /Results/grade-entry` takes a subject id. An examination is already scoped to exactly one
 * class and one subject, so choosing it supplies the subject; asking for the subject first would be
 * asking the user to narrow something the next choice determines. Phase 10's list endpoint is the
 * feed, which is also why this page holds no subject lookup of its own.
 *
 * The examination id is always sent. Omitted, the server picks the most recent exam for the class
 * and subject — which stops being the one the user chose the moment a newer one is scheduled, and
 * the roll would come back marked against the wrong exam with no indication.
 */
export default function GradeEntryPage() {
  const dispatch = useAppDispatch()
  const { canCreate } = useModulePermissions('Results')
  const canViewClasses = useCan('Classes', 'View')
  const canViewExaminations = useCan('Examinations', 'View')

  const [classId, setClassId] = useState<number | ''>('')
  const [examinationId, setExaminationId] = useState<number | ''>('')
  const [drafts, setDrafts] = useState<Record<number, GradeDraft>>({})

  const { classes, isLoading: loadingClasses } = useClassLookup({ skip: !canViewClasses })

  const {
    data: examinations,
    isLoading: loadingExams,
    error: examsError,
  } = useGetExaminationsQuery(classId === '' ? {} : { classId }, {
    skip: classId === '' || !canViewExaminations,
  })

  const chosenExam = useMemo(
    () => (examinationId === '' ? null : examinations?.find((e) => e.id === examinationId) ?? null),
    [examinations, examinationId],
  )

  const {
    data: rows,
    isLoading: loadingRoll,
    isFetching: fetchingRoll,
    error: rollError,
    refetch: refetchRoll,
  } = useGetGradeEntryRollQuery(
    chosenExam
      ? {
          subjectId: chosenExam.subjectId,
          classId: chosenExam.classId,
          examinationId: chosenExam.id,
        }
      : { subjectId: 0, classId: 0, examinationId: 0 },
    { skip: !chosenExam },
  )

  const [submitGrades, { isLoading: saving }] = useBulkGradeEntryMutation()

  /**
   * Drafts are derived, not synced. `seeded` is what the server says; `drafts` is empty until the
   * user types, and from then on holds every row so untouched ones stay comparable. No effect
   * copies one into the other, which is why there is no `react/set-state-in-effect` suppression
   * here as there is in Phase 9's register — the inputs are controlled straight off
   * `effectiveDrafts`, so clearing `drafts` is all a reset takes.
   *
   * The trade-off this makes deliberately: while a teacher has unsaved edits, a background refetch
   * changes `rows` but not what is on screen. That is the right way round. Losing someone's typing
   * to a cache invalidation is worse than briefly showing a stale "Saved" marker, and the reset
   * after every save re-reads from the server anyway.
   */
  const seeded = useMemo(() => (rows ? draftsFromRows(rows) : {}), [rows])
  const effectiveDrafts = Object.keys(drafts).length > 0 ? drafts : seeded

  const progress = useMemo(
    () => entryProgress(rows ?? [], effectiveDrafts),
    [rows, effectiveDrafts],
  )

  const handleChange = (studentId: number, draft: GradeDraft) => {
    setDrafts((previous) => ({
      // Seed on first edit so the untouched rows are present and comparable.
      ...(Object.keys(previous).length > 0 ? previous : seeded),
      [studentId]: draft,
    }))
  }

  /** Back to whatever the server last said. Clearing `drafts` is the whole reset. */
  const resetDrafts = () => setDrafts({})

  const handleSave = async () => {
    if (!chosenExam || !rows) return

    // Only changed, valid rows. An empty box is never sent: that is how a student stays unmarked,
    // and there is no way to clear a mark through this API anyway.
    const gradeEntries = rows
      .map((row) => pendingRecord(row, effectiveDrafts[row.studentId] ?? { marks: '', remarks: '' }))
      .filter((record): record is NonNullable<typeof record> => record !== null)

    if (gradeEntries.length === 0) {
      dispatch(toastError('Nothing to save — no marks have changed.'))
      return
    }

    try {
      const result = await submitGrades({
        examinationId: chosenExam.id,
        gradeEntries,
      }).unwrap()

      // Reported as a partial success when it was one. The endpoint answers 200 with counts even
      // when it dropped rows, so treating the status as the outcome would tell a teacher their
      // marks were saved when some were discarded.
      if (result.entriesSkipped > 0) {
        dispatch(
          toastError(
            `${result.entriesSaved} saved, but ${result.entriesSkipped} were skipped — check those students are still in ${chosenExam.className}.`,
          ),
        )
      } else {
        dispatch(toastSuccess(`Marks saved for ${result.entriesSaved} student(s).`))
      }

      // Either way, reseed from the server rather than trusting the payload: after a partial save
      // the screen and the database disagree, and the database is right.
      resetDrafts()
    } catch (caught) {
      // 403 is distinguished because it is the one failure with a specific remedy: it means the
      // teacher is not assigned to this subject and class, not that the marks were bad.
      dispatch(
        getErrorStatus(caught) === 403
          ? toastError('You are not assigned to enter grades for this subject and class.')
          : toastError(getErrorMessage(caught, 'Could not save the marks.')),
      )
    }
  }

  const examOptions = examinations ?? []

  return (
    <Box>
      <PageHeader
        title="Grade entry"
        subtitle="Choose an examination and enter the class's marks. Letter grades are worked out from your school's own thresholds — you do not enter them."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<RestartAltIcon />}
              onClick={resetDrafts}
              disabled={saving || progress.touched === 0}
            >
              Discard changes
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => void handleSave()}
              disabled={!canCreate || saving || progress.sendable === 0}
            >
              {saving ? 'Saving…' : `Save ${progress.sendable || ''}`.trim()}
            </Button>
          </Stack>
        }
      />

      {!canViewExaminations && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Examinations access is needed to choose one</AlertTitle>
          Marks are entered against an examination, and the list of them needs view access to
          Examinations, which this account does not hold.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="Class"
            size="small"
            value={classId}
            onChange={(event) => {
              const raw = event.target.value
              setClassId(raw === '' ? '' : Number(raw))
              // The examination list is per class, so the previous choice cannot survive.
              setExaminationId('')
              resetDrafts()
            }}
            disabled={!canViewClasses || loadingClasses || saving}
            sx={{ minWidth: 240 }}
            helperText={canViewClasses ? 'Pick a class first' : 'Needs Classes access'}
          >
            <MenuItem value="">
              <em>Choose a class</em>
            </MenuItem>
            {classes.map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {classLabel(row)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Examination"
            size="small"
            value={examinationId}
            onChange={(event) => {
              const raw = event.target.value
              setExaminationId(raw === '' ? '' : Number(raw))
              resetDrafts()
            }}
            disabled={classId === '' || loadingExams || saving || examOptions.length === 0}
            sx={{ minWidth: 340 }}
            helperText={
              classId === ''
                ? 'Choose a class first'
                : examOptions.length === 0 && !loadingExams
                  ? 'This class has no examinations scheduled'
                  : 'The subject comes from the examination'
            }
          >
            <MenuItem value="">
              <em>Choose an examination</em>
            </MenuItem>
            {examOptions.map((exam) => (
              <MenuItem key={exam.id} value={exam.id}>
                {exam.examName} · {exam.subjectName} · {formatDate(exam.examDate)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {(loadingExams || fetchingRoll) && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      {examsError && <ErrorState error={examsError} />}

      {classId !== '' && examOptions.length === 0 && !loadingExams && !examsError && (
        <EmptyState
          title="No examinations for this class"
          description="Marks are entered against an examination, so one has to exist first."
          action={
            <Button component={RouterLink} to="/examinations" startIcon={<GradingIcon />}>
              Go to examinations
            </Button>
          }
        />
      )}

      {!chosenExam && classId !== '' && examOptions.length > 0 && (
        <EmptyState
          title="Choose an examination"
          description="The class roll loads once you pick one. Its subject, maximum marks and pass mark all come from the examination."
        />
      )}

      {classId === '' && (
        <EmptyState
          title="Start with a class"
          description="Pick a class, then the examination you are marking."
        />
      )}

      {chosenExam && (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              mb: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            }}
          >
            <StatCard
              label="On roll"
              value={progress.onRoll}
              caption={`${chosenExam.className} · ${chosenExam.subjectName}`}
            />
            <StatCard
              label="Already marked"
              value={`${progress.marked} of ${progress.onRoll}`}
              caption="Saved before this session"
            />
            <StatCard
              label="Unsaved changes"
              value={progress.touched}
              caption={
                progress.sendable === progress.touched
                  ? 'All of them can be saved'
                  : `${progress.sendable} can be saved`
              }
              iconColor={progress.touched > 0 ? 'warning.main' : 'text.disabled'}
            />
            <StatCard
              label="Out of"
              value={chosenExam.maxMarks}
              caption={`Pass at ${chosenExam.passingMarks}`}
            />
          </Box>

          {progress.invalid > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {progress.invalid} row{progress.invalid === 1 ? '' : 's'} cannot be saved as
              entered. Marks must be whole numbers between 0 and {chosenExam.maxMarks}; those rows
              will be left out of the save rather than sent and silently skipped.
            </Alert>
          )}

          {rollError ? (
            getErrorStatus(rollError) === 403 ? (
              // A real answer, not a fault: teachers are held to their subject-and-class
              // assignments. Admins bypass that check, so this only reaches teachers.
              <Alert severity="warning" icon={<LockPersonIcon />}>
                <AlertTitle>Not your subject for this class</AlertTitle>
                Grade entry is limited to the subjects you are assigned to teach in this class. An
                administrator can assign you, or enter these marks themselves.
              </Alert>
            ) : (
              <ErrorState error={rollError} onRetry={() => void refetchRoll()} />
            )
          ) : loadingRoll ? (
            <LinearProgress />
          ) : rows && rows.length === 0 ? (
            <EmptyState
              title="Nobody to mark"
              description={`${chosenExam.className} has no active students on its roll, so there is nothing to enter marks against.`}
            />
          ) : (
            <>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Chip
                  size="small"
                  label={`${chosenExam.examType} · ${formatDate(chosenExam.examDate)}`}
                />
                <Typography variant="caption" color="text.secondary">
                  Leave a box empty to leave that student unmarked. An empty box is never submitted,
                  and a mark cannot be removed once saved.
                </Typography>
              </Stack>

              <GradeEntryTable
                rows={rows ?? []}
                drafts={effectiveDrafts}
                onChange={handleChange}
                disabled={saving || !canCreate}
              />

              {!canCreate && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This account can see the roll but not save marks — that needs create access to
                  Results. Correcting an existing mark needs that same permission rather than edit
                  access: the write is an upsert, so there is no separate update for Edit to gate.
                </Alert>
              )}
            </>
          )}
        </>
      )}
    </Box>
  )
}
