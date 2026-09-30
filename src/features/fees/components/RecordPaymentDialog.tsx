import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { formatDate } from '@/lib/dates'
import { applyServerErrors, getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { PAYMENT_METHODS } from '@/types/enums'
import { toastSuccess } from '@/ui/uiSlice'
import {
  FEE_LIMITS,
  formatMoney,
  formatPeriod,
  METHODS_WITH_REFERENCE,
  PAYMENT_METHOD_LABEL,
  toCents,
} from '../feeRules'
import { useRecordPaymentMutation } from '../feesApi'
import type { StudentFee } from '../types'
import { moneySchema, moneyText } from './moneySchema'

/** Mirrors FeePaymentCreateDTO. The balance cap is added per fee in onSubmit. */
const schema = z.object({
  amountPaid: moneySchema(FEE_LIMITS.amount.min, FEE_LIMITS.amount.max),
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'Choose how it was paid' }),
  transactionId: z.string().trim().max(100, 'Reference cannot exceed 100 characters'),
  remarks: z.string().trim().max(255, 'Remarks cannot exceed 255 characters'),
})

type PaymentForm = z.input<typeof schema>

const FIELDS = ['amountPaid', 'paymentMethod', 'transactionId', 'remarks'] as const

const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: PAYMENT_METHOD_LABEL[method] ?? method,
}))

interface RecordPaymentDialogProps {
  fee: StudentFee | null
  onClose: () => void
}

/**
 * Record money received against one fee, then open its receipt.
 *
 * **Double submission.** `POST /fees/payments` is an insert with nothing on the request that
 * identifies a retry, so the same form sent twice records two payments. Three things stand in
 * the way here:
 *
 *   1. `FormDialog` disables submit (and Enter, and closing) while the request is in flight.
 *   2. On success the dialog does not stay open to be submitted again: it navigates straight to
 *      the receipt, so the only way back to a form is to open a fresh one against the new
 *      balance.
 *   3. The mutation is never retried automatically. A timeout is reported as "check the history
 *      before trying again", because a request that timed out may well have been recorded.
 *
 * Server-side, the balance cap bounds what a duplicate can do: a second full payment is refused
 * as "already paid in full". A second part-payment is not. FRONTEND_PLAN.md §7 records that.
 */
export function RecordPaymentDialog({ fee, onClose }: RecordPaymentDialogProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [recordPayment, { isLoading }] = useRecordPaymentMutation()

  const { control, handleSubmit, reset, setError } = useForm<PaymentForm>({
    resolver: zodResolver(schema),
    defaultValues: { amountPaid: '', paymentMethod: 'Cash', transactionId: '', remarks: '' },
  })

  useEffect(() => {
    if (!fee) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    // The balance by default: paying a fee off is the common case.
    reset({
      amountPaid: moneyText(fee.balance),
      paymentMethod: 'Cash',
      transactionId: '',
      remarks: '',
    })
  }, [fee, reset])

  const method = useWatch({ control, name: 'paymentMethod' })
  const needsReference = METHODS_WITH_REFERENCE.has(method)

  const onSubmit = handleSubmit(async (values) => {
    if (!fee) return
    setFormError(null)

    const amountPaid = toCents(Number(values.amountPaid))
    if (amountPaid > toCents(fee.balance)) {
      setError('amountPaid', {
        type: 'manual',
        message: `Cannot exceed the outstanding balance of ${formatMoney(fee.balance)}`,
      })
      return
    }

    try {
      const recorded = await recordPayment({
        feeId: fee.id,
        amountPaid,
        paymentMethod: values.paymentMethod,
        transactionId: values.transactionId.trim() === '' ? null : values.transactionId.trim(),
        remarks: values.remarks.trim() === '' ? null : values.remarks.trim(),
      }).unwrap()

      dispatch(toastSuccess(`Payment recorded. Receipt ${recorded.receiptNumber}.`))
      onClose()
      navigate(`/fees/receipts/${encodeURIComponent(recorded.receiptNumber)}`)
    } catch (caught) {
      const unassigned = applyServerErrors<PaymentForm>(caught, setError, FIELDS)
      const message = unassigned[0] ?? getErrorMessage(caught, 'Could not record the payment.')
      // No status (unreachable, timed out) or a 5xx means the insert may have happened
      // without the answer arriving. Say so, rather than inviting a second payment.
      const status = getErrorStatus(caught)
      const uncertain = status === undefined || status >= 500
      setFormError(
        uncertain
          ? `${message} The payment may still have been recorded — check the payment history before trying again.`
          : message,
      )
    }
  })

  return (
    <FormDialog
      open={fee !== null}
      title="Record a payment"
      description={
        fee ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 2,
              rowGap: 0.5,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Fee
            </Typography>
            <Typography variant="body2">
              {fee.feeTypeName} · {formatPeriod(fee.feeMonth, fee.feeYear)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Due
            </Typography>
            <Typography variant="body2">{formatDate(fee.dueDate)}</Typography>
            <Typography variant="body2" color="text.secondary">
              Outstanding
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatMoney(fee.balance)} of {formatMoney(fee.amount)}
            </Typography>
          </Box>
        ) : undefined
      }
      error={formError}
      submitLabel="Record payment"
      busy={isLoading}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="amountPaid"
        control={control}
        label="Amount received"
        required
        autoFocus
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        hint="Part-payments are accepted"
      />
      <RHFSelect
        name="paymentMethod"
        control={control}
        label="Method"
        required
        options={METHOD_OPTIONS}
      />
      <RHFTextField
        name="transactionId"
        control={control}
        label={method === 'Cheque' ? 'Cheque number' : 'Transaction reference'}
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint={needsReference ? 'Printed on the receipt' : 'Optional for cash'}
      />
      <RHFTextField
        name="remarks"
        control={control}
        label="Remarks"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      <Alert severity="info">
        Recorded as received today, against your name. It cannot be edited afterwards — only
        refunded.
      </Alert>
    </FormDialog>
  )
}
