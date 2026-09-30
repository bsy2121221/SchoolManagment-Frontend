import LinkOffIcon from '@mui/icons-material/LinkOff'
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { FormDialog } from '@/components/form/FormDialog'
import { useCan } from '@/features/auth/permissions'
import { useGetStudentsQuery } from '@/features/students/studentsApi'
import { getErrorMessage } from '@/lib/serverErrors'
import { PAGE } from '@/types/enums'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import {
  useGetParentChildrenQuery,
  useLinkStudentParentMutation,
  useUnlinkStudentParentMutation,
} from '../parentsApi'
import { RELATIONSHIPS } from '../types'
import type { ParentChild, Relationship } from '../types'

interface ParentChildrenPanelProps {
  /** `Parents.Id` -- the link, unlink and children endpoints are all keyed on this. */
  parentId: number
  /** `Users.Id`, passed through so the profile cache entry is invalidated too. */
  userId: number
  /** Whether this user may attach or detach a child. Reading needs no extra permission. */
  canEdit: boolean
}

/**
 * The children attached to a parent, with linking and unlinking.
 *
 * Fetched here rather than read off the profile response, as `TeacherSubjectsPanel` does
 * with its subjects: the two writes invalidate `{ Parent, parentId }`, which is exactly
 * what this query provides, so the list refreshes itself without the page re-reading the
 * profile.
 *
 * Three things about the link call are worth knowing at the point of use:
 *
 *  - **The relationship is per link, not per person.** The same adult is a Father to one
 *    child and can be a Guardian to another, so it is chosen alongside the student rather
 *    than stored on the parent. `ParentRow.relationship` is null everywhere except
 *    `GET /parents/student/{id}` for the same reason.
 *  - **Only Father, Mother and Guardian are accepted.** `CK_StudentParents_Relationship`
 *    allows nothing else, which is why this is a select and not a text box.
 *  - **Linking is a MERGE.** Sending a pair that already exists re-labels it and brings an
 *    inactive link back, so correcting "Guardian" to "Father" is the same call as making
 *    the link in the first place.
 *
 * Unlinking deactivates the row rather than deleting it, and is idempotent: a link already
 * inactive reports success. Only a pair that was never linked is refused.
 */
export function ParentChildrenPanel({ parentId, userId, canEdit }: ParentChildrenPanelProps) {
  const dispatch = useAppDispatch()

  const [linkOpen, setLinkOpen] = useState(false)
  const [studentId, setStudentId] = useState<'' | number>('')
  const [relationship, setRelationship] = useState<Relationship>('Father')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [pendingUnlink, setPendingUnlink] = useState<ParentChild | null>(null)

  const { data: children, isLoading, isFetching } = useGetParentChildrenQuery(parentId)

  // The student picker needs the roll of the school. Paginated, so one big page rather
  // than a page control -- a picker that only offers the first twenty students is worse
  // than no picker. Admin-gated, so skipped without the permission and until it is opened.
  const canViewStudents = useCan('Students', 'View')
  const { data: studentPage, isLoading: loadingStudents } = useGetStudentsQuery(
    { isActive: true, page: 1, pageSize: PAGE.maxSize },
    { skip: !linkOpen || !canViewStudents },
  )

  const [linkStudent, { isLoading: linking }] = useLinkStudentParentMutation()
  const [unlinkStudent, { isLoading: unlinking }] = useUnlinkStudentParentMutation()

  const current = children ?? []

  // Re-seed on open, so a cancelled attempt does not come back pre-filled.
  useEffect(() => {
    if (!linkOpen) return
    // oxlint-disable-next-line react/set-state-in-effect
    setStudentId('')
    // oxlint-disable-next-line react/set-state-in-effect
    setRelationship('Father')
    // oxlint-disable-next-line react/set-state-in-effect
    setLinkError(null)
  }, [linkOpen])

  const handleLink = async () => {
    if (studentId === '') {
      setLinkError('Choose the child this parent belongs to.')
      return
    }
    setLinkError(null)

    try {
      await linkStudent({ studentId, parentId, userId, relationship }).unwrap()
      dispatch(toastSuccess(`Linked as ${relationship.toLowerCase()}.`))
      setLinkOpen(false)
    } catch (error) {
      // "Relationship must be Father, Mother or Guardian" and "Student not found in this
      // school" both arrive here, and neither is a generic failure.
      setLinkError(getErrorMessage(error, 'Could not link the parent to that student.'))
    }
  }

  const handleUnlink = async () => {
    if (!pendingUnlink) return
    try {
      await unlinkStudent({ studentId: pendingUnlink.studentId, parentId, userId }).unwrap()
      dispatch(
        toastSuccess(
          `${pendingUnlink.firstName} ${pendingUnlink.lastName} is no longer attached to this parent.`,
        ),
      )
      setPendingUnlink(null)
    } catch (error) {
      dispatch(toastError(getErrorMessage(error, 'Could not unlink that child.')))
      setPendingUnlink(null)
    }
  }

  const students = studentPage?.items ?? []
  const linkedIds = new Set(current.map((child) => child.studentId))

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Children
        </Typography>
        {canEdit && (
          <Button
            size="small"
            startIcon={<PersonAddAltIcon />}
            onClick={() => setLinkOpen(true)}
          >
            Attach a child
          </Button>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        What this parent can see is decided entirely by this list. A parent with nobody
        attached can sign in and will find every screen empty.
      </Typography>

      {(isLoading || isFetching) && <LinearProgress sx={{ mb: 1.5 }} />}

      {current.length === 0 && !isLoading ? (
        <EmptyState
          title="No children attached"
          description={
            canEdit
              ? 'Attach the students this parent is responsible for. Each link carries its own relationship, so one adult can be a father to one child and a guardian to another.'
              : 'Nobody has been attached to this parent yet.'
          }
        />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Child</TableCell>
              <TableCell>Class</TableCell>
              <TableCell>Relationship</TableCell>
              {canEdit && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {current.map((child) => (
              <TableRow key={child.studentId} hover>
                <TableCell>
                  <Stack sx={{ py: 0.5 }}>
                    <Link
                      component={RouterLink}
                      to={`/students/${child.studentId}`}
                      underline="hover"
                    >
                      {`${child.firstName} ${child.lastName}`.trim()}
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      {child.studentNumber}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  {/* The procedure sends '' rather than null for a student between
                      classes, so an empty string here means "not placed". */}
                  {child.className === '' ? (
                    <Typography variant="body2" color="text.disabled">
                      Not in a class
                    </Typography>
                  ) : (
                    child.className
                  )}
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={child.relationship} />
                </TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <Tooltip title="Unlink">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setPendingUnlink(child)}
                      >
                        <LinkOffIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <FormDialog
        open={linkOpen}
        title="Attach a child"
        description={
          <Typography variant="body2" color="text.secondary">
            The relationship belongs to this pairing rather than to the parent, so choose it per
            child. Attaching a child who is already on the list re-labels the existing link
            instead of adding a second one.
          </Typography>
        }
        error={linkError}
        submitLabel="Attach"
        busy={linking}
        onSubmit={(event) => {
          event.preventDefault()
          void handleLink()
        }}
        onClose={() => setLinkOpen(false)}
      >
        {!canViewStudents && (
          <Alert severity="warning">
            Choosing a child needs permission to view the student list.
          </Alert>
        )}

        {loadingStudents && <LinearProgress />}

        {canViewStudents && !loadingStudents && students.length === 0 && (
          <Alert severity="info">
            No active students are registered in this school yet, so there is nobody to attach.
          </Alert>
        )}

        <TextField
          select
          label="Child"
          required
          value={studentId}
          onChange={(event) => setStudentId(Number(event.target.value))}
          disabled={!canViewStudents || loadingStudents}
          helperText="Active students only — a student who has left cannot be attached"
        >
          {students.map((student) => (
            <MenuItem key={student.id} value={student.id}>
              {`${student.firstName} ${student.lastName}`.trim()} · {student.studentId}
              {student.className ? ` · ${student.className}` : ''}
              {linkedIds.has(student.id) ? ' — already attached' : ''}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Relationship"
          required
          value={relationship}
          onChange={(event) => setRelationship(event.target.value as Relationship)}
          helperText="The only three the database accepts"
        >
          {RELATIONSHIPS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>

        {studentId !== '' && linkedIds.has(studentId) && (
          <Alert severity="info">
            This child is already attached to this parent. Saving changes the relationship on
            the existing link rather than creating another.
          </Alert>
        )}
      </FormDialog>

      <ConfirmDialog
        open={pendingUnlink !== null}
        title="Unlink this child?"
        destructive
        busy={unlinking}
        confirmLabel="Unlink"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingUnlink?.firstName} {pendingUnlink?.lastName} is detached from this parent,
              who immediately stops seeing their attendance, results and fees.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Neither record is deleted — only the link between them is deactivated, and
              attaching them again restores it. Nothing else about either account changes.
            </Typography>
          </Stack>
        }
        onConfirm={() => void handleUnlink()}
        onCancel={() => setPendingUnlink(null)}
      />
    </Paper>
  )
}
