import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { StatCard } from '@/components/data/StatCard'
import { useCan } from '@/features/auth/permissions'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { formatDate } from '@/lib/dates'
import { formatMoney, formatPeriod, STATUS_COLOR, studentName, toCents } from '../feeRules'
import { useGetFeeTypesQuery, useGetOutstandingFeesQuery } from '../feesApi'
import type { OutstandingFee } from '../types'

/**
 * Every unpaid fee in the school, soonest due first.
 *
 * All three filters go to the server — `sp_GetOutstandingFees` takes each of them — so the
 * totals above the grid are totals of exactly what the grid holds.
 *
 * Students who have left are included and flagged. They still owe the money, and the dashboard's
 * outstanding figure counts them, so leaving them out here would make the two disagree.
 */
export function OutstandingTab() {
  const canViewClasses = useCan('Classes', 'View')

  const [classId, setClassId] = useState<number | ''>('')
  const [feeTypeId, setFeeTypeId] = useState<number | ''>('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const { classes, isLoading: loadingClasses } = useClassLookup({ skip: !canViewClasses })
  const { data: feeTypes } = useGetFeeTypesQuery()

  const { data, isLoading, isFetching, error, refetch } = useGetOutstandingFeesQuery({
    classId: classId === '' ? undefined : classId,
    feeTypeId: feeTypeId === '' ? undefined : feeTypeId,
    overdueOnly: overdueOnly || undefined,
  })

  const totals = useMemo(() => {
    const rows = data ?? []
    let owed = 0
    let overdue = 0
    let departed = 0
    const students = new Set<number>()
    for (const row of rows) {
      owed += row.balance
      if (row.status === 'Overdue') overdue += row.balance
      if (!row.studentIsActive) departed += 1
      students.add(row.studentId)
    }
    return {
      owed: toCents(owed),
      overdue: toCents(overdue),
      fees: rows.length,
      students: students.size,
      departed,
    }
  }, [data])

  const columns = useMemo<GridColDef<OutstandingFee>[]>(
    () => [
      {
        field: 'student',
        headerName: 'Student',
        flex: 1.2,
        minWidth: 220,
        valueGetter: (_value: unknown, row: OutstandingFee) => studentName(row),
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Link
                component={RouterLink}
                to={`/fees/students/${row.studentId}`}
                underline="hover"
                variant="body2"
              >
                {studentName(row)}
              </Link>
              {!row.studentIsActive && <Chip size="small" label="Left" variant="outlined" />}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {row.studentNumber}
              {row.rollNumber ? ` · roll ${row.rollNumber}` : ''}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'className',
        headerName: 'Class',
        width: 130,
        valueGetter: (value: string | null) => value ?? '—',
      },
      {
        field: 'feeTypeName',
        headerName: 'Fee',
        flex: 1,
        minWidth: 170,
        valueGetter: (_value: unknown, row: OutstandingFee) =>
          `${row.feeTypeName} · ${formatPeriod(row.feeMonth, row.feeYear)}`,
      },
      {
        field: 'dueDate',
        headerName: 'Due',
        width: 120,
        valueFormatter: (value: string) => formatDate(value),
      },
      {
        field: 'amount',
        headerName: 'Charged',
        type: 'number',
        width: 110,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'balance',
        headerName: 'Outstanding',
        type: 'number',
        width: 120,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 150,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            color={STATUS_COLOR[row.status] ?? 'default'}
            label={
              row.status === 'Overdue' && row.daysOverdue > 0
                ? `Overdue ${row.daysOverdue}d`
                : row.status
            }
          />
        ),
      },
    ],
    [],
  )

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'center' } }}
      >
        {canViewClasses && (
          <TextField
            select
            size="small"
            label="Class"
            value={classId}
            onChange={(event) =>
              setClassId(event.target.value === '' ? '' : Number(event.target.value))
            }
            disabled={loadingClasses}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All classes</MenuItem>
            {classes.map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {classLabel(row)}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          select
          size="small"
          label="Fee type"
          value={feeTypeId}
          onChange={(event) =>
            setFeeTypeId(event.target.value === '' ? '' : Number(event.target.value))
          }
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All fee types</MenuItem>
          {(feeTypes ?? []).map((row) => (
            <MenuItem key={row.id} value={row.id}>
              {row.feeTypeName}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
          }
          label="Overdue only"
        />
      </Stack>

      {data && data.length > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <StatCard
            label="Outstanding"
            value={formatMoney(totals.owed)}
            caption={`${totals.fees} fee${totals.fees === 1 ? '' : 's'} across ${totals.students} student${totals.students === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Overdue"
            value={formatMoney(totals.overdue)}
            caption="Past its due date and not paid in full"
          />
          <StatCard
            label="Owed by students who have left"
            value={totals.departed}
            caption={totals.departed === 0 ? 'None' : 'Fees still on the books after leaving'}
          />
        </Stack>
      )}

      <ClientDataGrid
        rows={data}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.feeId}
        getRowHeight={() => 'auto'}
        autoHeight
        emptyTitle={overdueOnly ? 'Nothing overdue' : 'Nothing outstanding'}
        emptyDescription={
          classId !== '' || feeTypeId !== ''
            ? 'No unpaid fees match these filters.'
            : 'Every fee billed in this school has been paid.'
        }
      />
    </Stack>
  )
}
