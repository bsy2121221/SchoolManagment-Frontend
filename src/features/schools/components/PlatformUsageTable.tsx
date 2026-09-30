import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { formatDistanceToNowStrict } from 'date-fns'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
// Was a local `toApiDate` built on `toISOString().slice(0, 10)`, which reported the
// previous day for any user east of UTC. Shared now, and fixed -- see lib/dates.ts.
import { toApiDate } from '@/lib/dates'
import { useGetUsageReportQuery } from '../schoolsApi'
import type { SchoolUsageRow } from '../types'

/**
 * Per-tenant activity over a window, from `GET /api/Schools/usage-report`. Defaults to
 * the last 30 days when no dates are given.
 *
 * Not paginated — one row per tenant, so the client grid can sort it. That is the
 * opposite of every other list in the app, and it is correct here: sorting by "who has
 * entered no results this month" is the whole reason to open this, and a server-paged
 * grid could not do it.
 *
 * The activity counts are window-bound; the head counts are current. So a school can
 * show 400 active students and zero attendance records, which means nobody opened a
 * register in the window, not that the school is empty.
 */
export function PlatformUsageTable() {
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [toDate, setToDate] = useState<Date | null>(null)

  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate)

  const { data, isLoading, isFetching, error, refetch } = useGetUsageReportQuery(
    { fromDate: toApiDate(fromDate), toDate: toApiDate(toDate) },
    // The API returns 400 for from > to; there is no point asking.
    { skip: invalidRange },
  )

  const columns = useMemo<GridColDef<SchoolUsageRow>[]>(
    () => [
      {
        field: 'schoolName',
        headerName: 'School',
        flex: 1,
        minWidth: 200,
        renderCell: ({ row }) => (
          <Stack spacing={0} sx={{ justifyContent: 'center', height: '100%' }}>
            <Link component={RouterLink} to={`/schools/${row.schoolId}`} underline="hover">
              {row.schoolName}
            </Link>
            <Typography variant="caption" color="text.secondary">
              {row.schoolCode}
              {!row.isActive && ' · suspended'}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'activeStudents',
        headerName: 'Students',
        width: 100,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'activeTeachers',
        headerName: 'Teachers',
        width: 100,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'attendanceRecords',
        headerName: 'Attendance marks',
        width: 150,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            color={row.attendanceRecords === 0 && row.isActive ? 'warning.main' : 'text.primary'}
          >
            {row.attendanceRecords.toLocaleString()}
          </Typography>
        ),
      },
      {
        field: 'resultsEntered',
        headerName: 'Results',
        width: 110,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value: number) => value.toLocaleString(),
      },
      {
        field: 'feesCollected',
        headerName: 'Fees collected',
        width: 150,
        align: 'right',
        headerAlign: 'right',
        // No currency on the DTO, so the amount is shown as a plain number rather than
        // asserting a symbol the school never chose.
        valueFormatter: (value: number) =>
          value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
      {
        field: 'lastLoginAt',
        headerName: 'Last sign-in',
        width: 150,
        renderCell: ({ row }) =>
          row.lastLoginAt ? (
            <Typography variant="body2">
              {formatDistanceToNowStrict(new Date(row.lastLoginAt), { addSuffix: true })}
            </Typography>
          ) : (
            // Null means nobody has *ever* signed in — a freshly onboarded school whose
            // admin never collected their credentials looks exactly like this.
            <Chip size="small" variant="outlined" color="warning" label="Never" />
          ),
      },
    ],
    [],
  )

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography variant="h6">Tenant activity</Typography>
          <Typography variant="body2" color="text.secondary">
            {fromDate || toDate
              ? 'Counts are limited to the window; head counts are current.'
              : 'The last 30 days. Head counts are current, activity is window-bound.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <DatePicker
            label="From"
            value={fromDate}
            onChange={setFromDate}
            slotProps={{ textField: { size: 'small', sx: { width: 150 } }, field: { clearable: true } }}
          />
          <DatePicker
            label="To"
            value={toDate}
            onChange={setToDate}
            slotProps={{ textField: { size: 'small', sx: { width: 150 } }, field: { clearable: true } }}
          />
        </Stack>
      </Stack>

      {invalidRange ? (
        <EmptyState
          title="That window runs backwards"
          description="The start date is after the end date, so there is nothing to report. Swap them."
        />
      ) : error ? (
        <ErrorState error={error} title="Could not load the usage report" onRetry={() => void refetch()} />
      ) : !isLoading && data && data.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          description="Onboard a school and its activity will appear here."
        />
      ) : (
        <>
          {isFetching && !isLoading && <LinearProgress sx={{ mb: 1 }} />}
          <DataGrid<SchoolUsageRow>
            rows={data ?? []}
            columns={columns}
            getRowId={(row) => row.schoolId}
            loading={isLoading}
            autoHeight
            disableRowSelectionOnClick
            disableColumnMenu
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
              // Busiest first: the tenants generating load are the ones worth seeing.
              sorting: { sortModel: [{ field: 'activeStudents', sort: 'desc' }] },
            }}
            pageSizeOptions={[10, 25, 50]}
            sx={{
              bgcolor: 'background.paper',
              '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
            }}
          />
        </>
      )}
    </Paper>
  )
}
