import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PrintIcon from '@mui/icons-material/Print'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { formatDate, formatDateTime } from '@/lib/dates'
import { getErrorStatus } from '@/lib/serverErrors'
import { formatMoney, formatPeriod, PAYMENT_METHOD_LABEL } from '../feeRules'
import { useGetReceiptQuery } from '../feesApi'

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 500 }}>
        {children}
      </Typography>
    </Stack>
  )
}

/**
 * `/fees/receipts/:receiptNumber` — one payment's receipt, laid out to print.
 *
 * Keyed on the receipt number the server generated (`CODE_RCPT_YYYY_000123`), which is what is
 * printed and what someone reads back over the phone, rather than the payment id.
 *
 * The receipt is the payment as recorded, with one exception the page states: the fee's paid-to-date
 * and balance are *current* figures, so a later payment against the same fee moves them. A refunded
 * payment keeps its receipt, marked refunded.
 *
 * Printing hides everything but the receipt (`displayPrint: 'none'` on the chrome; the app shell
 * hides its own bars under `@media print`).
 */
export default function ReceiptPage() {
  const { receiptNumber = '' } = useParams<{ receiptNumber: string }>()
  const { data, isLoading, error, refetch } = useGetReceiptQuery(receiptNumber, {
    skip: receiptNumber === '',
  })

  if (isLoading) return <FullPageLoader label="Loading the receipt…" />

  if (receiptNumber === '' || (error && getErrorStatus(error) === 404)) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning">
          No receipt {receiptNumber ? <strong>{receiptNumber}</strong> : null} was found in this
          school.
        </Alert>
        <Button component={RouterLink} to="/fees?tab=payments" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Payments
        </Button>
      </Box>
    )
  }
  if (error || !data) {
    return <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the receipt" />
  }

  const refunded = data.paymentStatus === 'Refunded'
  const method = PAYMENT_METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod
  const classText = data.className
    ? `${data.className}${data.rollNumber ? `, roll ${data.rollNumber}` : ''}`
    : '—'

  return (
    <Box sx={{ py: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2, justifyContent: 'space-between', displayPrint: 'none' }}
      >
        <Button
          component={RouterLink}
          to={`/fees/students/${data.studentId}`}
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          {data.firstName} {data.lastName}'s fees
        </Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
          Print
        </Button>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 4 },
          maxWidth: 640,
          mx: 'auto',
          '@media print': { border: 'none', p: 0, maxWidth: 'none' },
        }}
      >
        <Stack spacing={0.5} sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {data.schoolName}
          </Typography>
          {data.schoolAddress && (
            <Typography variant="body2" color="text.secondary">
              {data.schoolAddress}
            </Typography>
          )}
          {data.schoolPhone && (
            <Typography variant="body2" color="text.secondary">
              {data.schoolPhone}
            </Typography>
          )}
        </Stack>

        <Divider />

        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'baseline', my: 2 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Fee receipt
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {data.receiptNumber}
          </Typography>
        </Stack>

        {refunded && (
          <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
            <strong>Refunded.</strong> This payment was returned and no longer counts towards the
            fee.{data.remarks ? ` Reason: ${data.remarks}` : ''}
          </Alert>
        )}

        <Line label="Student">
          {data.firstName} {data.lastName}
        </Line>
        <Line label="Admission number">{data.studentNumber}</Line>
        <Line label="Class">{classText}</Line>

        <Divider sx={{ my: 1.5 }} />

        <Line label="Fee">
          {data.feeTypeName} · {formatPeriod(data.feeMonth, data.feeYear)}
        </Line>
        <Line label="Fee amount">{formatMoney(data.feeAmount)}</Line>
        <Line label="Due">{formatDate(data.dueDate)}</Line>

        <Divider sx={{ my: 1.5 }} />

        <Line label="Paid on">{formatDateTime(data.paymentDate)}</Line>
        <Line label="Method">{method}</Line>
        {data.transactionId && <Line label="Reference">{data.transactionId}</Line>}
        {!refunded && data.remarks && <Line label="Remarks">{data.remarks}</Line>}
        <Line label="Received by">{data.receivedBy ?? '—'}</Line>

        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Amount paid
          </Typography>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, textDecoration: refunded ? 'line-through' : 'none' }}
          >
            {formatMoney(data.amountPaid)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary" component="div">
          As of now: {formatMoney(data.feeTotalPaid)} paid towards this fee,{' '}
          {data.feeBalance > 0 ? `${formatMoney(data.feeBalance)} still owed` : 'nothing owed'}.
          These figures include any payment made after this receipt.
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          {data.schoolCode} · printed {formatDateTime(new Date().toISOString())}
        </Typography>
      </Paper>
    </Box>
  )
}
