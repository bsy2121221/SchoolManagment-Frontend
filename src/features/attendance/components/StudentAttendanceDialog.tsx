import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatDate, formatDateWithWeekday } from '@/lib/dates'
import { useGetStudentAttendanceQuery } from '../attendanceApi'

interface StudentAttendanceDialogProps {
  /** `Students.Id`. */
  studentId: number
  studentName: string
  /** `yyyy-MM-dd`. The window the report behind this dialog is showing. */
  startDate?: string
  endDate?: string
  onClose: () => void
}

/**
 * One student's marked days over a window, from `GET /attendance/student/{id}`.
 *
 * Read-only, and that is the endpoint's doing rather than a choice:
 * `sp_GetStudentAttendance` returns the class *name* but not its id, and
 * `POST /api/Attendance` needs the id. So a correction cannot be started from this list --
 * it is started from the summary row, which carries `classId`.
 *
 * Mounted only while open, so the query has no `skip` to get wrong: the parent renders this
 * when a student is chosen and unmounts it on close.
 */
export function StudentAttendanceDialog({
  studentId,
  studentName,
  startDate,
  endDate,
  onClose,
}: StudentAttendanceDialogProps) {
  const { data, isLoading, error, refetch } = useGetStudentAttendanceQuery({
    studentId,
    startDate,
    endDate,
  })

  const rows = data ?? []
  const present = rows.filter((row) => row.isPresent).length
  const absent = rows.length - present
  // Over the days actually recorded, which is what `rows` is. Not over school days.
  const percentage = rows.length > 0 ? Math.round((present / rows.length) * 1000) / 10 : null

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack>
          <Typography variant="h6">{studentName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {startDate && endDate
              ? `${formatDate(startDate)} — ${formatDate(endDate)}`
              : 'The last month'}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {error ? (
          <ErrorState
            error={error}
            title="Could not load this history"
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <Stack sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing recorded in this window"
            description="No register covering this student was taken between these dates. That is not the same as being absent — there is simply no record either way."
          />
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip size="small" color="success" label={`${present} present`} />
              <Chip size="small" color="error" label={`${absent} absent`} />
              <Chip size="small" variant="outlined" label={`${rows.length} days recorded`} />
              {percentage !== null && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={percentage < 75 ? 'warning' : 'default'}
                  label={`${percentage}%`}
                />
              )}
            </Stack>

            <Alert severity="info" variant="outlined">
              Only days with a record appear. Dates missing from this list are registers nobody
              opened, not absences.
            </Alert>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell sx={{ width: 110 }}>Status</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{formatDateWithWeekday(row.attendanceDate)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={row.isPresent ? 'success' : 'error'}
                          variant={row.isPresent ? 'filled' : 'outlined'}
                          label={row.isPresent ? 'Present' : 'Absent'}
                        />
                      </TableCell>
                      <TableCell>{row.className}</TableCell>
                      <TableCell>
                        {row.remarks ?? (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
