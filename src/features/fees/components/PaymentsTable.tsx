import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import UndoIcon from '@mui/icons-material/Undo'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { useCan } from '@/features/auth/permissions'
import { formatDate } from '@/lib/dates'
import type { QueryError } from '@/lib/serverErrors'
import {
  formatMoney,
  formatPeriod,
  PAYMENT_METHOD_LABEL,
  paymentStatusColor,
  studentName,
} from '../feeRules'
import type { PaymentRow } from '../types'
import { RefundDialog } from './RefundDialog'

interface PaymentsTableProps {
  rows: PaymentRow[] | undefined
  loading: boolean
  error?: QueryError
  onRetry: () => void
  /** Adds the student column, for the school-wide ledger. */
  showStudent?: boolean
  emptyTitle: string
  emptyDescription: string
}

/**
 * Payments, in the server's order (newest first, then by id, so several receipts on one day stay
 * in sequence — which a client sort on the date-only column would not preserve), with the
 * receipt and refund actions. Used by the school ledger and by
 * one student's history, which differ only in whether the student column is worth its width.
 *
 * Refunded payments stay in the table on purpose: the receipt number was handed to someone, and
 * a ledger with gaps in its receipt sequence is the first thing an auditor asks about.
 */
export function PaymentsTable({
  rows,
  loading,
  error,
  onRetry,
  showStudent = false,
  emptyTitle,
  emptyDescription,
}: PaymentsTableProps) {
  const canRefund = useCan('Fees', 'Edit')
  const [refunding, setRefunding] = useState<PaymentRow | null>(null)

  const columns = useMemo<GridColDef<PaymentRow>[]>(
    () => [
      {
        field: 'receiptNumber',
        headerName: 'Receipt',
        minWidth: 210,
        flex: 1,
        renderCell: ({ row }) => (
          <Link
            component={RouterLink}
            to={`/fees/receipts/${encodeURIComponent(row.receiptNumber)}`}
            underline="hover"
          >
            {row.receiptNumber}
          </Link>
        ),
      },
      {
        field: 'paymentDate',
        headerName: 'Date',
        width: 120,
        valueFormatter: (value: string) => formatDate(value),
      },
      ...(showStudent
        ? [
            {
              field: 'student',
              headerName: 'Student',
              minWidth: 200,
              flex: 1,
              valueGetter: (_value: unknown, row: PaymentRow) => studentName(row),
              renderCell: ({ row }) => (
                <Stack spacing={0.25} sx={{ py: 1 }}>
                  <Link
                    component={RouterLink}
                    to={`/fees/students/${row.studentId}`}
                    underline="hover"
                    variant="body2"
                  >
                    {studentName(row)}
                  </Link>
                  <Typography variant="caption" color="text.secondary">
                    {row.studentNumber}
                    {row.className ? ` · ${row.className}` : ''}
                  </Typography>
                </Stack>
              ),
            } satisfies GridColDef<PaymentRow>,
          ]
        : []),
      {
        field: 'feeTypeName',
        headerName: 'For',
        minWidth: 170,
        flex: 1,
        valueGetter: (_value: unknown, row: PaymentRow) =>
          `${row.feeTypeName} · ${formatPeriod(row.feeMonth, row.feeYear)}`,
      },
      {
        field: 'amountPaid',
        headerName: 'Amount',
        type: 'number',
        width: 120,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'paymentMethod',
        headerName: 'Method',
        width: 130,
        valueGetter: (value: string) => PAYMENT_METHOD_LABEL[value] ?? value,
      },
      {
        field: 'paymentStatus',
        headerName: 'Status',
        width: 120,
        renderCell: ({ row }) => (
          <Tooltip title={row.paymentStatus === 'Refunded' ? (row.remarks ?? '') : ''}>
            <Chip
              size="small"
              label={row.paymentStatus}
              color={paymentStatusColor(row.paymentStatus)}
              variant={row.paymentStatus === 'Refunded' ? 'outlined' : 'filled'}
            />
          </Tooltip>
        ),
      },
      {
        field: 'receivedBy',
        headerName: 'Received by',
        width: 150,
        valueGetter: (value: string | null) => value ?? '—',
      },
      {
        field: 'actions',
        headerName: '',
        sortable: false,
        filterable: false,
        width: 96,
        align: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Receipt">
              <IconButton
                size="small"
                component={RouterLink}
                to={`/fees/receipts/${encodeURIComponent(row.receiptNumber)}`}
                aria-label={`Receipt ${row.receiptNumber}`}
              >
                <ReceiptLongIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {canRefund && row.paymentStatus === 'Completed' && (
              <Tooltip title="Refund">
                <IconButton
                  size="small"
                  aria-label={`Refund ${row.receiptNumber}`}
                  onClick={() => setRefunding(row)}
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [showStudent, canRefund],
  )

  return (
    <>
      <ClientDataGrid
        rows={rows}
        loading={loading}
        error={error}
        onRetry={onRetry}
        columns={columns}
        autoHeight
        getRowHeight={() => (showStudent ? 'auto' : null)}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
      <RefundDialog payment={refunding} onClose={() => setRefunding(null)} />
    </>
  )
}
