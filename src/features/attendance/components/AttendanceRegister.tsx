import DoneAllIcon from '@mui/icons-material/DoneAll'
import RemoveDoneIcon from '@mui/icons-material/RemoveDone'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { memo, useCallback, useMemo, useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatDateTime } from '@/lib/dates'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastShown, toastSuccess } from '@/ui/uiSlice'
import { useGetClassAttendanceQuery, useMarkAttendanceBulkMutation } from '../attendanceApi'
import type { AttendanceBulkMarkResult, AttendanceRecord, ClassAttendanceRow } from '../types'

/** `Attendance.Remarks` is NVARCHAR(255), and the DTO validates the same length. */
const REMARKS_MAX = 255

/**
 * What the user has decided about one student, before it is saved.
 *
 * `isPresent: null` is "no decision", which only an unsaved student can be in -- see
 * `handleStatus`.
 */
interface Draft {
  isPresent: boolean | null
  remarks: string
}

/** Sparse: a student appears only once they have been touched. */
type DraftMap = Record<number, Draft>

/** The draft a student starts from -- whatever the server currently holds. */
function serverDraft(row: ClassAttendanceRow): Draft {
  return { isPresent: row.isPresent, remarks: row.remarks ?? '' }
}

/**
 * The record this row would contribute to a submission, or null if it would contribute
 * nothing.
 *
 * One function rather than a separate "is dirty" predicate and a separate "build payload"
 * pass, because the two have to agree exactly. They disagreed in an earlier draft of this
 * screen: a student switched to present, given a remark and then switched back to unmarked
 * counted as a pending change but produced no record, so the Save button offered to save
 * something that could not be saved.
 *
 * Unchanged rows are excluded deliberately. The MERGE would happily re-write them and count
 * them as marked, but then `recordsMarked` would report the size of the class rather than
 * the size of the edit, and the number the user is shown afterwards should be the work they
 * actually did.
 */
function pendingRecord(row: ClassAttendanceRow, draft: Draft | undefined): AttendanceRecord | null {
  if (!draft || draft.isPresent === null) return null

  const base = serverDraft(row)
  const remarks = draft.remarks.trim()
  if (draft.isPresent === base.isPresent && remarks === base.remarks.trim()) return null

  return { studentId: row.studentId, isPresent: draft.isPresent, remarks: remarks || null }
}

interface RegisterRowProps {
  row: ClassAttendanceRow
  draft: Draft
  pending: boolean
  disabled: boolean
  onStatusChange: (studentId: number, next: boolean | null) => void
  onRemarksChange: (studentId: number, next: string) => void
}

/**
 * One line of the register.
 *
 * Memoised, and the reason is the remarks field: the drafts live in the parent, so without
 * this every keystroke would re-render all sixty rows and their inputs. The callbacks are
 * stable for as long as the roll is, so a typed character re-renders exactly one row.
 */
const RegisterRow = memo(function RegisterRow({
  row,
  draft,
  pending,
  disabled,
  onStatusChange,
  onRemarksChange,
}: RegisterRowProps) {
  const name = `${row.firstName} ${row.lastName}`.trim()
  const status = draft.isPresent

  return (
    <TableRow
      hover
      // The unsaved rows have to be findable at a glance in a sixty-row register.
      sx={{ bgcolor: pending ? 'action.selected' : undefined }}
    >
      <TableCell sx={{ fontFamily: 'monospace' }}>{row.rollNumber ?? '—'}</TableCell>

      <TableCell>
        <Stack sx={{ py: 0.5 }}>
          <Typography variant="body2">{name || row.studentNumber}</Typography>
          <Typography variant="caption" color="text.secondary">
            {row.studentNumber}
          </Typography>
        </Stack>
      </TableCell>

      <TableCell>
        <ToggleButtonGroup
          exclusive
          size="small"
          disabled={disabled}
          value={status === null ? null : status ? 'present' : 'absent'}
          onChange={(_event, value: string | null) => {
            onStatusChange(row.studentId, value === null ? null : value === 'present')
          }}
        >
          <ToggleButton value="present" color="success" sx={{ px: 1.5 }}>
            Present
          </ToggleButton>
          <ToggleButton value="absent" color="error" sx={{ px: 1.5 }}>
            Absent
          </ToggleButton>
        </ToggleButtonGroup>
      </TableCell>

      <TableCell>
        <Tooltip
          title={
            status === null ? 'A remark is stored on the attendance row, so mark them first.' : ''
          }
        >
          <TextField
            size="small"
            fullWidth
            placeholder={status === false ? 'Reason for absence (optional)' : 'Optional'}
            value={draft.remarks}
            // Nothing to attach a remark to until there is a row: Remarks is a column on
            // Attendance, not on the student.
            disabled={disabled || status === null}
            slotProps={{ htmlInput: { maxLength: REMARKS_MAX } }}
            onChange={(event) => onRemarksChange(row.studentId, event.target.value)}
          />
        </Tooltip>
      </TableCell>

      <TableCell>
        {pending ? (
          <Chip size="small" color="warning" variant="outlined" label="Unsaved" />
        ) : row.id === null ? (
          <Typography variant="caption" color="text.disabled">
            Not marked
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(row.markedAt)}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  )
})

interface AttendanceRegisterProps {
  classId: number
  /** `yyyy-MM-dd`. */
  apiDate: string
  /** `Attendance:Create`. False makes the whole register read-only. */
  canMark: boolean
}

/**
 * The class register for one date: every enrolled student, their current mark, and one
 * submission for the lot.
 *
 * Three states per student, two of which can be stored -- see `types.ts`. The register is
 * the only screen in the app that shows the third, and the rule that follows from
 * `Attendance` having no DELETE is enforced in `handleStatus`: an unsaved student can be
 * put back to unmarked, a saved one can only be corrected.
 *
 * **The parent must mount this with a `key` covering the class and the date.** The drafts
 * are deliberately local state with no effect syncing them from the server response, which
 * is what keeps a half-finished register from being silently overwritten by a refetch. The
 * flip side is that changing class or date has to discard them, and remounting is how --
 * an effect that cleared them on a prop change would be the same thing with more ways to
 * be wrong.
 */
export function AttendanceRegister({ classId, apiDate, canMark }: AttendanceRegisterProps) {
  const dispatch = useAppDispatch()

  const { data, isLoading, isFetching, error, refetch } = useGetClassAttendanceQuery({
    classId,
    attendanceDate: apiDate,
  })
  const [markBulk, { isLoading: saving }] = useMarkAttendanceBulkMutation()

  const [drafts, setDrafts] = useState<DraftMap>({})
  const [lastResult, setLastResult] = useState<AttendanceBulkMarkResult | null>(null)

  const rows = useMemo(() => data ?? [], [data])
  const disabled = !canMark || saving

  const handleStatus = useCallback(
    (studentId: number, next: boolean | null) => {
      const row = rows.find((candidate) => candidate.studentId === studentId)
      if (!row) return

      // Deselecting an already-saved student is refused rather than shown as a change that
      // does nothing. There is no endpoint that removes an attendance row, so "unmarked" is
      // not a state a saved student can be returned to; offering it and then quietly not
      // saving it would be the worst of both.
      if (next === null && row.isPresent !== null) return

      setDrafts((current) => {
        const base = current[studentId] ?? serverDraft(row)
        return {
          ...current,
          // Clearing the mark clears the remark with it: a remark with no mark is text the
          // user would watch being discarded at save time.
          [studentId]: { isPresent: next, remarks: next === null ? '' : base.remarks },
        }
      })
    },
    [rows],
  )

  const handleRemarks = useCallback(
    (studentId: number, next: string) => {
      const row = rows.find((candidate) => candidate.studentId === studentId)
      if (!row) return

      setDrafts((current) => {
        const base = current[studentId] ?? serverDraft(row)
        return { ...current, [studentId]: { ...base, remarks: next.slice(0, REMARKS_MAX) } }
      })
    },
    [rows],
  )

  /** "Everyone present" is the normal day, and the reason bulk marking exists. */
  const setAll = useCallback(
    (isPresent: boolean) => {
      setDrafts((current) => {
        const next: DraftMap = { ...current }
        for (const row of rows) {
          const base = current[row.studentId] ?? serverDraft(row)
          next[row.studentId] = { isPresent, remarks: base.remarks }
        }
        return next
      })
    },
    [rows],
  )

  const { present, absent, unmarked, records } = useMemo(() => {
    let presentCount = 0
    let absentCount = 0
    let unmarkedCount = 0
    // Built from the roll, which has one row per student, so a student id cannot repeat.
    // That matters: sp_MarkAttendanceBulk reads the payload into a table variable with
    // StudentId as its PRIMARY KEY, and a duplicate throws rather than being ignored.
    const pending: AttendanceRecord[] = []

    for (const row of rows) {
      const draft = drafts[row.studentId] ?? serverDraft(row)
      if (draft.isPresent === true) presentCount += 1
      else if (draft.isPresent === false) absentCount += 1
      else unmarkedCount += 1

      const record = pendingRecord(row, drafts[row.studentId])
      if (record) pending.push(record)
    }

    return { present: presentCount, absent: absentCount, unmarked: unmarkedCount, records: pending }
  }, [rows, drafts])

  const handleSave = async () => {
    if (records.length === 0) return
    const requested = records.length

    try {
      const result = await markBulk({ classId, attendanceDate: apiDate, records }).unwrap()
      setLastResult(result)
      setDrafts({})

      if (result.recordsSkipped > 0) {
        // A 200 that did less than it was asked. Saying "saved" alone here would leave the
        // user believing the register is complete.
        dispatch(
          toastShown({
            severity: 'warning',
            message: `Saved ${result.recordsMarked} of ${requested}. ${result.recordsSkipped} skipped — no longer enrolled in this class.`,
          }),
        )
      } else {
        dispatch(
          toastSuccess(
            `Register saved — ${result.recordsMarked} ${result.recordsMarked === 1 ? 'student' : 'students'} marked.`,
          ),
        )
      }
    } catch (caught) {
      // Keeps the drafts: the register is still on screen and retrying is the next move.
      dispatch(toastError(getErrorMessage(caught, 'Could not save the register.')))
    }
  }

  if (error) {
    return <ErrorState error={error} title="Could not load the register" onRetry={() => void refetch()} />
  }

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    )
  }

  if (rows.length === 0) {
    return (
      <Paper variant="outlined">
        <EmptyState
          title="No students in this class"
          description="The register is built from the class roll, so there is nothing to mark until students are admitted into this class."
        />
      </Paper>
    )
  }

  return (
    <Paper variant="outlined">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ p: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip size="small" color="success" label={`${present} present`} />
          <Chip size="small" color="error" label={`${absent} absent`} />
          <Chip
            size="small"
            variant="outlined"
            color={unmarked > 0 ? 'warning' : 'default'}
            label={`${unmarked} unmarked`}
          />
          <Chip size="small" variant="outlined" label={`${rows.length} on roll`} />
        </Stack>

        {canMark && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button size="small" startIcon={<DoneAllIcon />} onClick={() => setAll(true)} disabled={saving}>
              All present
            </Button>
            <Button size="small" startIcon={<RemoveDoneIcon />} onClick={() => setAll(false)} disabled={saving}>
              All absent
            </Button>
            <Button
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={() => setDrafts({})}
              disabled={saving || records.length === 0}
            >
              Undo changes
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              loading={saving}
              disabled={records.length === 0}
              onClick={() => void handleSave()}
            >
              {records.length === 0 ? 'Save' : `Save ${records.length}`}
            </Button>
          </Stack>
        )}
      </Stack>

      {!canMark && (
        <Alert severity="info" sx={{ mx: 2, mb: 2 }}>
          You can read this register but not mark it. Marking needs the Create permission on
          Attendance.
        </Alert>
      )}

      {lastResult && lastResult.recordsSkipped > 0 && (
        <Alert severity="warning" sx={{ mx: 2, mb: 2 }} onClose={() => setLastResult(null)}>
          {lastResult.recordsSkipped} of the marks just sent were skipped because those students
          are not actively enrolled in this class. The rest saved. This usually means the roll
          changed while the register was open — reload to see it as it is now.
        </Alert>
      )}

      {isFetching && !isLoading && <LinearProgress />}
      <Divider />

      <TableContainer sx={{ maxHeight: 640 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 80 }}>Roll</TableCell>
              <TableCell sx={{ minWidth: 200 }}>Student</TableCell>
              <TableCell sx={{ width: 190 }}>Attendance</TableCell>
              <TableCell sx={{ minWidth: 220 }}>Remarks</TableCell>
              <TableCell sx={{ width: 150 }}>Marked</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <RegisterRow
                key={row.studentId}
                row={row}
                draft={drafts[row.studentId] ?? serverDraft(row)}
                pending={pendingRecord(row, drafts[row.studentId]) !== null}
                disabled={disabled}
                onStatusChange={handleStatus}
                onRemarksChange={handleRemarks}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {canMark && (
        <>
          <Divider />
          <Stack
            direction="row"
            spacing={2}
            sx={{ p: 2, alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                {records.length === 0
                  ? unmarked > 0
                    ? `Nothing to save. ${unmarked} ${unmarked === 1 ? 'student is' : 'students are'} still unmarked.`
                    : 'Nothing to save — the register matches what is stored.'
                  : `${records.length} ${records.length === 1 ? 'change' : 'changes'} to save.`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Only changed rows are sent. A saved mark can be corrected but not removed —
                attendance has no delete.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              loading={saving}
              disabled={records.length === 0}
              onClick={() => void handleSave()}
            >
              Save register
            </Button>
          </Stack>
        </>
      )}
    </Paper>
  )
}
