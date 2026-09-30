import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useCan } from '@/features/auth/permissions'
import { useClassLookup } from '@/features/classes/classLookup'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import {
  useAssignTeacherSubjectClassMutation,
  useGetTeacherSubjectAssignmentsQuery,
  useGetTeacherSubjectsQuery,
} from '../teachersApi'
import type { TeacherSubjectClass } from '../types'

interface TeacherAssignmentMatrixProps {
  /** `Teachers.Id` -- what the assignment body carries. */
  teacherId: number
  /** `Users.Id`, passed through so the profile cache entry is invalidated too. */
  userId: number
  /** Whether this user may change the assignment. Reading it needs no extra permission. */
  canEdit: boolean
}

/** One cell's identity, so a tick in flight can be tracked without a mutation per cell. */
function cellKey(subjectId: number, classId: number): string {
  return `${subjectId}:${classId}`
}

/**
 * Which subject this teacher teaches in which class -- `TeacherSubjectAssignments`.
 *
 * **This table is what gates mark entry.** `sp_GetStudentsForGradeEntry` reads it, so a
 * teacher with no row here cannot enter marks for that class however many subjects they
 * hold. It is the most consequential screen in the module and the least obvious, which is
 * why it says so in the description rather than in a tooltip.
 *
 * Both directions go through one endpoint: `POST … { isActive: false }` withdraws, because
 * `sp_AssignTeacherToSubjectClass` is a MERGE and there is no DELETE. Unticking therefore
 * costs a round trip like ticking does, and each cell tracks its own.
 *
 * Two things the server does *not* enforce, which shape what is offered here:
 *
 *  - It never checks that the teacher holds the subject. The rows offered are the subjects
 *    they hold anyway, because assigning one they do not is how you get a teacher entering
 *    marks for a subject that is not theirs.
 *  - Withdrawing a subject in the panel above does not withdraw these rows. So an
 *    assignment can outlive the subject link, and those orphans are listed separately
 *    below -- they are invisible in the matrix, since their subject has no row.
 */
export function TeacherAssignmentMatrix({
  teacherId,
  userId,
  canEdit,
}: TeacherAssignmentMatrixProps) {
  const dispatch = useAppDispatch()
  const [pending, setPending] = useState<string[]>([])

  const { data: subjects, isLoading: loadingSubjects } = useGetTeacherSubjectsQuery(teacherId)
  const {
    data: assignments,
    isLoading: loadingAssignments,
    isFetching,
  } = useGetTeacherSubjectAssignmentsQuery(teacherId)

  // Classes are Admin/Teacher-only, and without them there are no columns to draw.
  const canViewClasses = useCan('Classes', 'View')
  const {
    classes,
    isLoading: loadingClasses,
    hasMore,
  } = useClassLookup({ skip: !canViewClasses })

  const [assign] = useAssignTeacherSubjectClassMutation()

  const held = subjects ?? []
  const rows = assignments ?? []
  const loading = loadingSubjects || loadingAssignments || loadingClasses

  /** The assignment row for a cell, or undefined when the pair is not assigned. */
  const findAssignment = (subjectId: number, classId: number): TeacherSubjectClass | undefined =>
    rows.find((row) => row.subjectId === subjectId && row.classId === classId)

  // Assignments whose subject the teacher no longer holds. They still gate mark entry, so
  // they cannot just be dropped from the screen.
  const orphans = rows.filter((row) => !held.some((subject) => subject.id === row.subjectId))

  const toggle = async (subjectId: number, classId: number, next: boolean, label: string) => {
    const key = cellKey(subjectId, classId)
    setPending((previous) => [...previous, key])
    try {
      await assign({ teacherId, userId, subjectId, classId, isActive: next }).unwrap()
      dispatch(toastSuccess(next ? `Assigned ${label}.` : `Withdrawn from ${label}.`))
    } catch (error) {
      dispatch(
        toastError(
          getErrorMessage(error, next ? 'Could not assign that.' : 'Could not withdraw that.'),
        ),
      )
    } finally {
      setPending((previous) => previous.filter((entry) => entry !== key))
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Subjects in classes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        A tick here is what lets this teacher take the register and enter marks for that subject
        in that class. Holding the subject is not enough on its own.
      </Typography>

      {(loading || isFetching || pending.length > 0) && <LinearProgress sx={{ mb: 1.5 }} />}

      {!canViewClasses && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Showing the matrix needs permission to view classes.
        </Alert>
      )}

      {hasMore && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          This school has more active classes than one page holds, so the columns below are not
          the complete list.
        </Alert>
      )}

      {canViewClasses && !loading && held.length === 0 && (
        <EmptyState
          title="No subjects to assign"
          description="Give this teacher a subject first — the matrix has a row per subject they hold."
        />
      )}

      {canViewClasses && !loading && held.length > 0 && classes.length === 0 && (
        <EmptyState
          title="No classes yet"
          description="Add a class before assigning anyone to teach in one."
        />
      )}

      {canViewClasses && held.length > 0 && classes.length > 0 && (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 120 + classes.length * 76 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 180 }}>Subject</TableCell>
                {classes.map((row) => (
                  <TableCell key={row.id} align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                      {row.className}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.totalStudents} on roll
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {held.map((subject) => (
                <TableRow key={subject.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2">{subject.subjectName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {subject.subjectCode} · grade {subject.grade}
                    </Typography>
                  </TableCell>
                  {classes.map((klass) => {
                    const assignment = findAssignment(subject.id, klass.id)
                    const busy = pending.includes(cellKey(subject.id, klass.id))
                    const label = `${subject.subjectName} in ${klass.className}`
                    // The subject's grade and the class's need not match -- nothing on the
                    // server requires it -- but a mismatch is nearly always a mis-tick, so
                    // the tooltip names it rather than the UI forbidding it.
                    const mismatch = subject.grade !== klass.grade

                    return (
                      <TableCell key={klass.id} align="center" sx={{ px: 0.5 }}>
                        <Tooltip
                          title={
                            assignment
                              ? `Assigned — ${label}${canEdit ? '. Untick to withdraw.' : ''}`
                              : mismatch
                                ? `${subject.subjectName} is a grade ${subject.grade} subject and ${klass.className} is grade ${klass.grade}`
                                : label
                          }
                        >
                          <Checkbox
                            size="small"
                            checked={assignment !== undefined}
                            disabled={!canEdit || busy}
                            color={mismatch && assignment === undefined ? 'warning' : 'primary'}
                            onChange={(event) =>
                              void toggle(subject.id, klass.id, event.target.checked, label)
                            }
                            slotProps={{ input: { 'aria-label': label } }}
                          />
                        </Tooltip>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {orphans.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {orphans.length === 1 ? 'One assignment is' : `${orphans.length} assignments are`} for a
            subject this teacher no longer holds. They still allow mark entry, so they have no row
            above and have to be withdrawn here.
          </Alert>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {orphans.map((row) => (
              <Chip
                key={row.id}
                color="warning"
                variant="outlined"
                label={`${row.subjectName} in ${row.className}`}
                onDelete={
                  canEdit
                    ? () =>
                        void toggle(
                          row.subjectId,
                          row.classId,
                          false,
                          `${row.subjectName} in ${row.className}`,
                        )
                    : undefined
                }
                disabled={pending.includes(cellKey(row.subjectId, row.classId))}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  )
}
