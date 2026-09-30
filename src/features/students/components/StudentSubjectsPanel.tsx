import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { EmptyState } from '@/components/feedback/EmptyState'
import { FormDialog } from '@/components/form/FormDialog'
import { useCan } from '@/features/auth/permissions'
import { useGetSubjectsQuery } from '@/features/subjects/subjectsApi'
import { getErrorMessage } from '@/lib/serverErrors'
import { PAGE } from '@/types/enums'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import {
  useAssignStudentSubjectsMutation,
  useGetStudentSubjectsQuery,
  useRemoveStudentSubjectMutation,
} from '../studentsApi'

interface StudentSubjectsPanelProps {
  studentId: number
  /**
   * The grade of the student's class, used to narrow the subject list. Undefined when the
   * student has no class, or when the caller cannot read classes -- the picker then offers
   * every active subject in the school and says so.
   */
  grade?: string
  /** Whether this user may change the enrolments. Reading them needs no extra permission. */
  canEdit: boolean
}

/**
 * The subjects a student is enrolled in, with assignment and removal.
 *
 * Two API shapes meet here and they behave differently:
 *
 *  - `POST /students/{id}/subjects` **replaces** the whole set: whatever is not in the list
 *    is deactivated. So the dialog opens pre-ticked with the current enrolments — sending
 *    only the newly chosen ones would silently drop the rest.
 *  - `DELETE /students/{id}/subjects/{subjectId}` removes one. It is the only way to end up
 *    with none, because the assignment DTO requires at least one id.
 *
 * Either way the link row is deactivated rather than deleted, so marks already recorded for
 * a dropped subject survive.
 */
export function StudentSubjectsPanel({ studentId, grade, canEdit }: StudentSubjectsPanelProps) {
  const dispatch = useAppDispatch()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [checked, setChecked] = useState<number[]>([])

  const { data: enrolled, isLoading, isFetching } = useGetStudentSubjectsQuery(studentId)

  // The subject catalogue is Admin/Teacher-only; skipping rather than letting it 403 keeps a
  // permission we expect to be missing out of the console.
  const canViewSubjects = useCan('Subjects', 'View')
  const { data: catalogue, isLoading: loadingCatalogue } = useGetSubjectsQuery(
    { grade, isActive: true, page: 1, pageSize: PAGE.maxSize },
    { skip: !pickerOpen || !canViewSubjects },
  )

  const [assignSubjects, { isLoading: assigning }] = useAssignStudentSubjectsMutation()
  const [removeSubject, { isLoading: removing }] = useRemoveStudentSubjectMutation()

  const current = enrolled ?? []

  // Re-tick on open: the dialog is a replacement of the whole set, so it has to start from
  // what the student actually has.
  useEffect(() => {
    if (!pickerOpen) return
    // oxlint-disable-next-line react/set-state-in-effect
    setChecked(current.map((subject) => subject.id))
    // Keyed on the open flag alone: re-running as `current` refetches would undo ticks the
    // user has just made.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen])

  const toggle = (subjectId: number) => {
    setChecked((previous) =>
      previous.includes(subjectId)
        ? previous.filter((id) => id !== subjectId)
        : [...previous, subjectId],
    )
  }

  const handleAssign = async () => {
    // StudentSubjectAssignmentDTO is [MinLength(1)], so an empty list is a 400 rather than
    // "drop everything". Saying so here rather than round-tripping for the refusal.
    if (checked.length === 0) {
      dispatch(toastError('Tick at least one subject, or remove them one at a time instead.'))
      return
    }

    try {
      await assignSubjects({ studentId, subjectIds: checked }).unwrap()
      dispatch(toastSuccess(`Enrolments updated — ${checked.length} subjects.`))
      setPickerOpen(false)
    } catch (error) {
      dispatch(toastError(getErrorMessage(error, 'Could not update the enrolments.')))
    }
  }

  const handleRemove = async (subjectId: number, name: string) => {
    try {
      await removeSubject({ studentId, subjectId }).unwrap()
      dispatch(toastSuccess(`${name} removed.`))
    } catch (error) {
      dispatch(toastError(getErrorMessage(error, 'Could not remove the subject.')))
    }
  }

  const options = catalogue?.items ?? []
  // A subject the student holds that is not in the fetched catalogue page -- another grade's,
  // or one since deactivated. It must still be listed, or submitting would drop it.
  const extras = current.filter((subject) => !options.some((option) => option.id === subject.id))

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Subjects
        </Typography>
        {canEdit && (
          <Button
            size="small"
            startIcon={<LibraryBooksOutlinedIcon />}
            onClick={() => setPickerOpen(true)}
          >
            Manage
          </Button>
        )}
      </Stack>

      {(isLoading || isFetching) && <LinearProgress sx={{ mb: 1.5 }} />}

      {current.length === 0 && !isLoading ? (
        <EmptyState
          title="No subjects enrolled"
          description={
            canEdit
              ? 'Assigning subjects is what makes a student appear in mark entry for them.'
              : 'Nothing has been assigned to this student yet.'
          }
        />
      ) : (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {current.map((subject) => (
            <Chip
              key={subject.id}
              label={`${subject.subjectName} · ${subject.subjectCode}`}
              onDelete={canEdit ? () => void handleRemove(subject.id, subject.subjectName) : undefined}
              disabled={removing}
            />
          ))}
        </Stack>
      )}

      <FormDialog
        open={pickerOpen}
        title="Subjects for this student"
        description={
          <Typography variant="body2" color="text.secondary">
            This list replaces the current enrolments — anything unticked is dropped.
            {grade ? ` Showing grade ${grade} subjects.` : ' Showing all active subjects.'}
          </Typography>
        }
        submitLabel="Save enrolments"
        busy={assigning}
        onSubmit={(event) => {
          event.preventDefault()
          void handleAssign()
        }}
        onClose={() => setPickerOpen(false)}
      >
        {!canViewSubjects && (
          <Alert severity="warning">
            Choosing subjects needs permission to view the subject list.
          </Alert>
        )}

        {loadingCatalogue && <LinearProgress />}

        {canViewSubjects && !loadingCatalogue && options.length === 0 && extras.length === 0 && (
          <Alert severity="info">
            {grade
              ? `No active subjects are defined for grade ${grade}. Add them in the Subjects module first.`
              : 'No active subjects are defined for this school yet.'}
          </Alert>
        )}

        {options.map((subject) => (
          <FormControlLabel
            key={subject.id}
            control={
              <Checkbox checked={checked.includes(subject.id)} onChange={() => toggle(subject.id)} />
            }
            label={`${subject.subjectName} (${subject.subjectCode ?? 'no code'})`}
          />
        ))}

        {extras.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary">
              Already enrolled, from outside this grade or since deactivated — untick to drop
            </Typography>
            {extras.map((subject) => (
              <FormControlLabel
                key={subject.id}
                control={
                  <Checkbox
                    checked={checked.includes(subject.id)}
                    onChange={() => toggle(subject.id)}
                  />
                }
                label={`${subject.subjectName} (${subject.subjectCode})`}
              />
            ))}
          </>
        )}

        {checked.length === 0 && (
          <Alert severity="info">
            At least one subject has to be ticked — the API rejects an empty list. To leave the
            student with none, close this and remove them one at a time.
          </Alert>
        )}
      </FormDialog>
    </Paper>
  )
}
