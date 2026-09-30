import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaymentsIcon from '@mui/icons-material/Payments'
import PersonIcon from '@mui/icons-material/Person'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { StatCard } from '@/components/data/StatCard'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan, useModulePermissions } from '@/features/auth/permissions'
import { useGetStudentProfileQuery } from '@/features/students/studentsApi'
import { formatDate } from '@/lib/dates'
import { getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { BillFeeDialog } from '../components/BillFeeDialog'
import { EditFeeDialog } from '../components/EditFeeDialog'
import { PaymentsTable } from '../components/PaymentsTable'
import { RecordPaymentDialog } from '../components/RecordPaymentDialog'
import { formatMoney, formatPeriod, STATUS_COLOR, toCents } from '../feeRules'
import {
  useCancelFeeMutation,
  useGetPaymentHistoryQuery,
  useGetStudentFeesQuery,
} from '../feesApi'
import type { StudentFee } from '../types'

/**
 * `/fees/students/:studentId` — one student's fee account.
 *
 * `studentId` is `Students.Id`, as on every fee endpoint and on `/students/:studentId`.
 *
 * The student's name comes from the Students profile read, because the fee reads carry none.
 * That needs `Students:View`, which every Admin holds; without it the page still works and
 * titles itself by the id. The profile also answers the question the fee endpoints cannot: an
 * empty fee list is the same response for a student with no fees and for an id that is not in
 * this school, and only the profile's 404 tells them apart.
 *
 * A departed student's account stays readable and payable — they may still settle what they
 * owe — but cannot be billed: `sp_AssignFeesToStudent` refuses an inactive student.
 */
export default function StudentFeeAccountPage() {
  const dispatch = useAppDispatch()
  const params = useParams<{ studentId: string }>()
  const studentId = Number(params.studentId)
  const validId = Number.isInteger(studentId) && studentId > 0

  const { canCreate, canEdit, canDelete } = useModulePermissions('Fees')
  const canViewStudents = useCan('Students', 'View')

  const [billOpen, setBillOpen] = useState(false)
  const [paying, setPaying] = useState<StudentFee | null>(null)
  const [editing, setEditing] = useState<StudentFee | null>(null)
  const [cancelling, setCancelling] = useState<StudentFee | null>(null)

  const profile = useGetStudentProfileQuery(studentId, { skip: !validId || !canViewStudents })
  const fees = useGetStudentFeesQuery(studentId, { skip: !validId })
  const history = useGetPaymentHistoryQuery({ studentId }, { skip: !validId })

  const [cancelFee, { isLoading: cancellingBusy }] = useCancelFeeMutation()

  const summary = useMemo(() => {
    let charged = 0
    let paid = 0
    let owed = 0
    let overdue = 0
    for (const row of fees.data ?? []) {
      charged += row.amount
      paid += row.totalPaid
      owed += Math.max(0, row.balance)
      if (row.status === 'Overdue') overdue += 1
    }
    return { charged: toCents(charged), paid: toCents(paid), owed: toCents(owed), overdue }
  }, [fees.data])

  const handleCancel = async () => {
    if (!cancelling) return
    const label = `${cancelling.feeTypeName} for ${formatPeriod(cancelling.feeMonth, cancelling.feeYear)}`
    try {
      await cancelFee(cancelling.id).unwrap()
      dispatch(toastSuccess(`${label} cancelled.`))
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not cancel the fee.')))
    } finally {
      setCancelling(null)
    }
  }

  const columns = useMemo<GridColDef<StudentFee>[]>(
    () => [
      {
        field: 'period',
        headerName: 'Period',
        width: 110,
        valueGetter: (_value: unknown, row: StudentFee) => row.feeYear * 100 + row.feeMonth,
        valueFormatter: (_value: unknown, row: StudentFee) =>
          formatPeriod(row.feeMonth, row.feeYear),
      },
      {
        field: 'feeTypeName',
        headerName: 'Fee',
        flex: 1,
        minWidth: 160,
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
        field: 'totalPaid',
        headerName: 'Paid',
        type: 'number',
        width: 110,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'balance',
        headerName: 'Balance',
        type: 'number',
        width: 110,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 110,
        renderCell: ({ row }) => (
          <Chip size="small" color={STATUS_COLOR[row.status] ?? 'default'} label={row.status} />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        sortable: false,
        filterable: false,
        width: 170,
        align: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', height: '100%' }}>
            {canCreate && row.balance > 0 && (
              <Button size="small" startIcon={<PaymentsIcon />} onClick={() => setPaying(row)}>
                Pay
              </Button>
            )}
            {canEdit && (
              <Tooltip title="Edit amount or due date">
                <IconButton
                  size="small"
                  aria-label={`Edit ${row.feeTypeName}`}
                  onClick={() => setEditing(row)}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip
                title={
                  row.totalPaid > 0 ? 'Refund its payments before cancelling' : 'Cancel this fee'
                }
              >
                {/* span: a disabled button fires no events, so the tooltip needs a wrapper. */}
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Cancel ${row.feeTypeName}`}
                    disabled={row.totalPaid > 0}
                    onClick={() => setCancelling(row)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [canCreate, canEdit, canDelete],
  )

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid student reference.</Alert>
      </Box>
    )
  }

  if (profile.isLoading) return <FullPageLoader label="Loading the fee account…" />

  if (profile.error && getErrorStatus(profile.error) === 404) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning">This student is not in your school.</Alert>
        <Button component={RouterLink} to="/fees" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Fees
        </Button>
      </Box>
    )
  }
  if (profile.error) {
    return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
  }

  const student = profile.data?.studentInfo ?? null
  const name = student ? `${student.firstName} ${student.lastName}` : `Student #${studentId}`
  const isActive = student?.isActive ?? true

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/fees"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mt: 2 }}
      >
        Fees
      </Button>

      <PageHeader
        title={`${name} · fees`}
        subtitle={
          student
            ? `${student.studentId} · ${student.className ?? 'no class'}${
                student.rollNumber ? `, roll ${student.rollNumber}` : ''
              }`
            : undefined
        }
        actions={
          <Stack direction="row" spacing={1}>
            {canViewStudents && (
              <Button
                variant="outlined"
                component={RouterLink}
                to={`/students/${studentId}`}
                startIcon={<PersonIcon />}
              >
                Student record
              </Button>
            )}
            {canCreate && (
              <Tooltip title={isActive ? '' : 'A student who has left cannot be billed'}>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    disabled={!isActive}
                    onClick={() => setBillOpen(true)}
                  >
                    Bill a fee
                  </Button>
                </span>
              </Tooltip>
            )}
          </Stack>
        }
      />

      {!isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This student has left the school. What they still owe stays on their account and can be
          paid; nothing new can be billed.
        </Alert>
      )}

      {fees.data && fees.data.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            mb: 3,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          }}
        >
          <StatCard label="Charged" value={formatMoney(summary.charged)} />
          <StatCard label="Paid" value={formatMoney(summary.paid)} caption="Refunds excluded" />
          <StatCard
            label="Outstanding"
            value={formatMoney(summary.owed)}
            caption={
              summary.overdue === 0
                ? 'Nothing overdue'
                : `${summary.overdue} fee${summary.overdue === 1 ? '' : 's'} overdue`
            }
          />
        </Box>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        Fees
      </Typography>
      <ClientDataGrid
        rows={fees.data}
        loading={fees.isLoading || fees.isFetching}
        error={fees.error}
        onRetry={() => void fees.refetch()}
        columns={columns}
        autoHeight
        emptyTitle="No fees billed"
        emptyDescription={
          isActive
            ? 'Nothing has been charged to this student yet.'
            : 'Nothing was charged to this student.'
        }
        emptyAction={
          canCreate && isActive ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setBillOpen(true)}>
              Bill a fee
            </Button>
          ) : undefined
        }
      />

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
        Payment history
      </Typography>
      <PaymentsTable
        rows={history.data}
        loading={history.isLoading || history.isFetching}
        error={history.error}
        onRetry={() => void history.refetch()}
        emptyTitle="No payments"
        emptyDescription="Nothing has been paid against this student's fees."
      />

      <BillFeeDialog
        open={billOpen}
        target={{ kind: 'student', studentId, name }}
        onClose={() => setBillOpen(false)}
      />
      <RecordPaymentDialog fee={paying} onClose={() => setPaying(null)} />
      <EditFeeDialog fee={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this fee?"
        message={
          cancelling
            ? `${cancelling.feeTypeName} for ${formatPeriod(cancelling.feeMonth, cancelling.feeYear)} (${formatMoney(cancelling.amount)}) comes off the account. Billing the same fee for the same period again restores it.`
            : ''
        }
        confirmLabel="Cancel fee"
        destructive
        busy={cancellingBusy}
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelling(null)}
      />
    </Box>
  )
}
