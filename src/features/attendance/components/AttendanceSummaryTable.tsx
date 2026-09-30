import EditCalendarIcon from '@mui/icons-material/EditCalendar'
import HistoryIcon from '@mui/icons-material/History'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { useCan } from '@/features/auth/permissions'
import type { AttendanceReportQuery } from '../attendanceApi'
import { useGetAttendanceSummaryQuery } from '../attendanceApi'
import { attendanceTone, formatPercentage } from '../attendanceRules'
import type { AttendanceSummaryRow } from '../types'
import { MarkOneDayDialog } from './MarkOneDayDialog'
import { StudentAttendanceDialog } from './StudentAttendanceDialog'

/** Whose history is open, or who is being marked. */
type Target = AttendanceSummaryRow

/**
 * Per-student attendance over a window, from `GET /attendance/summary`.
 *
 * Client-paged and client-sorted, because the endpoint returns every active student in one
 * array and takes no page, no sort and no search. Sorting by percentage is the reason anyone
 * opens this screen, and a server-paged grid could not do it.
 *
 * Every active student appears, including those with nothing recorded. Their percentage is
 * null, which this grid renders as words -- see `formatPercentage`.
 *
 * The summary is also the only read in the module carrying both `studentId` and `classId`,
 * which is why the single-day mark action lives here rather than in the history dialog.
 */
export function AttendanceSummaryTable({ classId, startDate, endDate }: AttendanceReportQuery) {
  const canMark = useCan('Attendance', 'Create')
  const canViewStudents = useCan('Students', 'View')

  const [history, setHistory] = useState<Target | null>(null)
  const [marking, setMarking] = useState<Target | null>(null)

  const { data, isLoading, isFetching, error, refetch } = useGetAttendanceSummaryQuery({
    classId,
    startDate,
    endDate,
  })

  const columns = useMemo<GridColDef<AttendanceSummaryRow>[]>(() => {
    const defined: GridColDef<AttendanceSummaryRow>[] = [
      {
        field: 'rollNumber',
        headerName: 'Roll',
        width: 90,
        renderCell: ({ row }) => (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.rollNumber ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'firstName',
        headerName: 'Student',
        flex: 1,
        minWidth: 200,
        valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`.trim(),
        renderCell: ({ row }) => {
          const name = `${row.firstName} ${row.lastName}`.trim() || row.studentNumber
          return (
            <Stack sx={{ py: 0.5 }}>
              {canViewStudents ? (
                <Link component={RouterLink} to={`/students/${row.studentId}`} underline="hover">
                  {name}
                </Link>
              ) : (
                <Typography variant="body2">{name}</Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {row.studentNumber}
              </Typography>
            </Stack>
          )
        },
      },
      {
        field: 'className',
        headerName: 'Class',
        width: 150,
        renderCell: ({ row }) =>
          row.className ? (
            <Typography variant="body2">{row.className}</Typography>
          ) : (
            // Not cosmetic: attendance is filed against a class, so an unplaced student
            // cannot be marked at all until they are admitted into one.
            <Chip size="small" variant="outlined" color="warning" label="No class" />
          ),
      },
      {
        field: 'presentDays',
        headerName: 'Present',
        width: 100,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'absentDays',
        headerName: 'Absent',
        width: 100,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'totalDays',
        headerName: 'Recorded',
        width: 110,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Tooltip title="Days with a record either way — not the days the school was open">
            <Typography variant="body2">{row.totalDays}</Typography>
          </Tooltip>
        ),
      },
      {
        field: 'attendancePercentage',
        headerName: 'Attendance',
        width: 170,
        renderCell: ({ row }) => {
          const value = row.attendancePercentage
          if (value === null) {
            return (
              <Typography variant="body2" color="text.disabled">
                {formatPercentage(null)}
              </Typography>
            )
          }
          const tone = attendanceTone(value)
          return (
            <Stack spacing={0.5} sx={{ width: '100%', py: 1 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600 }}
                color={tone === 'default' ? 'text.primary' : `${tone}.main`}
              >
                {formatPercentage(value)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(value, 100)}
                color={tone === 'default' ? 'inherit' : tone}
                sx={{ height: 5, borderRadius: 1 }}
              />
            </Stack>
          )
        },
      },
      {
        field: 'actions',
        headerName: '',
        width: 110,
        sortable: false,
        filterable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            <Tooltip title="Day-by-day history">
              <IconButton size="small" onClick={() => setHistory(row)}>
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {canMark && (
              <Tooltip
                title={
                  row.classId === null
                    ? 'Not in a class, so there is no register to mark against'
                    : 'Mark or correct one day'
                }
              >
                {/* A disabled IconButton swallows the pointer events a Tooltip needs, so it
                    is wrapped -- otherwise the explanation for why it is disabled never
                    appears. */}
                <span>
                  <IconButton
                    size="small"
                    disabled={row.classId === null}
                    onClick={() => setMarking(row)}
                  >
                    <EditCalendarIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ]

    return defined
  }, [canMark, canViewStudents])

  return (
    <>
      <ClientDataGrid<AttendanceSummaryRow>
        rows={data}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.studentId}
        autoHeight
        rowHeight={64}
        initialState={{
          // Worst first. Nulls sort to the end either way, which is right: "no record" is
          // not the worst attendance, it is a different problem and belongs with the
          // unopened registers on the other tab.
          sorting: { sortModel: [{ field: 'attendancePercentage', sort: 'asc' }] },
        }}
        emptyTitle="No students to report on"
        emptyDescription="Either the school has no active students, or the class filter matches none. The summary lists every active student, so an empty table here is about the roll rather than about the register."
      />

      {history && (
        <StudentAttendanceDialog
          studentId={history.studentId}
          studentName={`${history.firstName} ${history.lastName}`.trim() || history.studentNumber}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setHistory(null)}
        />
      )}

      {marking && marking.classId !== null && (
        <MarkOneDayDialog
          studentId={marking.studentId}
          studentName={`${marking.firstName} ${marking.lastName}`.trim() || marking.studentNumber}
          classId={marking.classId}
          className={marking.className ?? 'their class'}
          onClose={() => setMarking(null)}
        />
      )}
    </>
  )
}
