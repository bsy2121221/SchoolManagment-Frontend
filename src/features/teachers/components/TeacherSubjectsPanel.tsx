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
import { useAssignTeacherSubjectsMutation, useGetTeacherSubjectsQuery } from '../teachersApi'

interface TeacherSubjectsPanelProps {
  /** `Teachers.Id` -- the assignment endpoints are keyed on this, not the user id. */
  teacherId: number
  /** `Users.Id`, passed through so the profile cache entry is invalidated too. */
  userId: number
  /** Whether this user may change the assignment. Reading it needs no extra permission. */
  canEdit: boolean
}

/**
 * The subjects a teacher is qualified to teach, with assignment.
 *
 * One endpoint does all the writing and it **replaces** the whole set: whatever is absent
 * from the list is deactivated. So the dialog opens pre-ticked with the current set --
 * sending only the newly chosen ones would silently drop the rest.
 *
 * Two differences from the student equivalent are worth holding onto:
 *
 *  - **An empty list is allowed here.** `TeacherSubjectAssignmentDTO` carries no
 *    `[MinLength(1)]`, so unticking everything is the supported way to say "teaches no
 *    subjects". Students need one-at-a-time removal for that, because their DTO requires an
 *    id.
 *  - **There is no single-subject removal endpoint.** Unticking in this dialog is the only
 *    route, so the chips are not deletable.
 *
 * Holding a subject is not enough to enter marks -- that needs a row in the subject×class
 * matrix below. Worth saying once, where the reader is looking at the subjects.
 */
export function TeacherSubjectsPanel({ teacherId, userId, canEdit }: TeacherSubjectsPanelProps) {
  const dispatch = useAppDispatch()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [checked, setChecked] = useState<number[]>([])

  const { data: assigned, isLoading, isFetching } = useGetTeacherSubjectsQuery(teacherId)

  // The whole catalogue, not one grade's: a teacher is not tied to a grade the way a
  // student's class is. Admin/Teacher-only, so skipped when the permission is missing.
  const canViewSubjects = useCan('Subjects', 'View')
  const { data: catalogue, isLoading: loadingCatalogue } = useGetSubjectsQuery(
    { isActive: true, page: 1, pageSize: PAGE.maxSize },
    { skip: !pickerOpen || !canViewSubjects },
  )

  const [assignSubjects, { isLoading: assigning }] = useAssignTeacherSubjectsMutation()

  const current = assigned ?? []

  // Re-tick on open: the call replaces the whole set, so it has to start from what the
  // teacher actually holds.
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
    try {
      const { subjectsAssigned } = await assignSubjects({
        teacherId,
        userId,
        subjectIds: checked,
      }).unwrap()
      dispatch(
        toastSuccess(
          subjectsAssigned === 0
            ? 'All subjects removed from this teacher.'
            : `Subjects updated — ${subjectsAssigned} assigned.`,
        ),
      )
      setPickerOpen(false)
    } catch (error) {
      dispatch(toastError(getErrorMessage(error, 'Could not update the subjects.')))
    }
  }

  const options = catalogue?.items ?? []
  // A subject the teacher holds that is not on the fetched page -- or one since
  // deactivated, which keeps its teacher links. It must still be listed and ticked, or
  // submitting would drop it.
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
          title="No subjects assigned"
          description={
            canEdit
              ? 'A teacher needs a subject before they can be given it in a class, and a subject in a class before they can enter marks.'
              : 'Nothing has been assigned to this teacher yet.'
          }
        />
      ) : (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {current.map((subject) => (
            <Chip
              key={subject.id}
              label={`${subject.subjectName} · ${subject.subjectCode}`}
              // The subject itself can be deactivated while the link survives; saying so
              // beats a chip that looks the same as a live one.
              color={subject.isActive ? 'default' : 'warning'}
              variant="outlined"
            />
          ))}
        </Stack>
      )}

      <FormDialog
        open={pickerOpen}
        title="Subjects for this teacher"
        description={
          <Typography variant="body2" color="text.secondary">
            This list replaces the current assignment — anything unticked is withdrawn.
            Unticking everything is allowed, and leaves the teacher with no subjects.
          </Typography>
        }
        submitLabel="Save subjects"
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
            No active subjects are defined for this school yet. Add them in the Subjects module
            first.
          </Alert>
        )}

        {options.map((subject) => (
          <FormControlLabel
            key={subject.id}
            control={
              <Checkbox checked={checked.includes(subject.id)} onChange={() => toggle(subject.id)} />
            }
            label={`${subject.subjectName} (${subject.subjectCode ?? 'no code'}) · grade ${subject.grade}`}
          />
        ))}

        {extras.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary">
              Already assigned, from outside this page or since deactivated — untick to withdraw
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
                label={`${subject.subjectName} (${subject.subjectCode}) · grade ${subject.grade}`}
              />
            ))}
          </>
        )}

        {checked.length === 0 && current.length > 0 && (
          <Alert severity="warning">
            Saving with nothing ticked withdraws all {current.length} of this teacher&apos;s
            subjects. Their subject-in-class assignments are a separate table and are left
            standing — withdraw those from the matrix as well, or the teacher keeps mark entry
            for a subject they no longer hold.
          </Alert>
        )}
      </FormDialog>
    </Paper>
  )
}
