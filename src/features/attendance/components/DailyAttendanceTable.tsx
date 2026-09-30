import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo } from 'react'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { formatDateWithWeekday } from '@/lib/dates'
import type { AttendanceReportQuery } from '../attendanceApi'
import { useGetDailyAttendanceReportQuery } from '../attendanceApi'
import { attendanceTone, formatPercentage } from '../attendanceRules'
import type { DailyAttendanceRow } from '../types'

/**
 * One row per date, from `GET /attendance/daily-report`.
 *
 * The important property of this list is what is *not* in it. The procedure is driven from
 * `Attendance` rather than from a calendar, so a date on which nobody was marked produces no
 * row at all -- it does not appear with zeroes. Every gap in the dates is a register nobody
 * opened, and since that is the single most useful thing this screen can tell an
 * administrator, the note above the table says so rather than leaving it to be inferred from
 * a table that looks complete.
 *
 * `totalMarked` is also not the size of the school: it counts the students marked that day,
 * so a day where one class was registered and five were not shows a high percentage over a
 * small number. The two columns have to be read together.
 */
export function DailyAttendanceTable({ classId, startDate, endDate }: AttendanceReportQuery) {
  const { data, isLoading, isFetching, error, refetch } = useGetDailyAttendanceReportQuery({
    classId,
    startDate,
    endDate,
  })

  const columns = useMemo<GridColDef<DailyAttendanceRow>[]>(
    () => [
      {
        field: 'attendanceDate',
        headerName: 'Date',
        flex: 1,
        minWidth: 190,
        renderCell: ({ row }) => (
          <Typography variant="body2">{formatDateWithWeekday(row.attendanceDate)}</Typography>
        ),
      },
      {
        field: 'presentCount',
        headerName: 'Present',
        width: 110,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'absentCount',
        headerName: 'Absent',
        width: 110,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'totalMarked',
        headerName: 'Marked',
        width: 110,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'attendancePercentage',
        headerName: 'Attendance',
        width: 180,
        renderCell: ({ row }) => {
          const value = row.attendancePercentage
          if (value === null) {
            // The procedure NULLIFs a zero denominator, so this only appears in the odd case
            // of a date whose rows were all removed -- worth showing honestly rather than as 0%.
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
    ],
    [],
  )

  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined">
        Only dates with at least one record appear. A missing date is a register nobody opened,
        which is not the same as a day everyone was absent — and the Marked column is how many
        students were recorded that day, not how many the school has.
      </Alert>

      <ClientDataGrid<DailyAttendanceRow>
        rows={data}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.attendanceDate}
        autoHeight
        rowHeight={64}
        initialState={{
          sorting: { sortModel: [{ field: 'attendanceDate', sort: 'desc' }] },
        }}
        emptyTitle="No registers taken in this window"
        emptyDescription="Nothing was marked between these dates for the chosen class. Widen the window, or take a register from the Attendance screen."
      />
    </Stack>
  )
}
