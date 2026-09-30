import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { formatMoney } from '../feeRules'
import { useRefundPaymentMutation } from '../feesApi'
import type { PaymentRow } from '../types'

/** Mirrors RefundRequestDTO. */
const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Say why the payment is being refunded')
    .max(255, 'Reason cannot exceed 255 characters'),
})

type RefundForm = z.input<typeof schema>

const FIELDS = ['reason'] as const

interface RefundDialogProps {
  payment: PaymentRow | null
  onClose: () => void
}

/**
 * Refund one completed payment. A form rather than a plain confirm, because the reason is
 * required and is what the audit trail and the receipt will carry.
 */
export function RefundDialog({ payment, onClose }: RefundDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)
  const [refundPayment, { isLoading }] = useRefundPaymentMutation()

  const { control, handleSubmit, reset, setError } = useForm<RefundForm>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })

  useEffect(() => {
    if (!payment) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset({ reason: '' })
  }, [payment, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!payment) return
    setFormError(null)
    try {
      await refundPayment({ paymentId: payment.id, reason: values.reason.trim() }).unwrap()
      dispatch(toastSuccess(`Receipt ${payment.receiptNumber} refunded.`))
      onClose()
    } catch (caught) {
      const unassigned = applyServerErrors<RefundForm>(caught, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(caught, 'Could not refund the payment.'))
    }
  })

  return (
    <FormDialog
      open={payment !== null}
      title={payment ? `Refund ${payment.receiptNumber}` : 'Refund payment'}
      description={
        payment ? (
          <Typography variant="body2" color="text.secondary">
            {formatMoney(payment.amountPaid)} paid by {payment.paymentMethod} for{' '}
            {payment.feeTypeName}. The amount goes back onto the fee&apos;s balance.
          </Typography>
        ) : undefined
      }
      error={formError}
      submitLabel="Refund"
      busy={isLoading}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="reason"
        control={control}
        label="Reason"
        required
        autoFocus
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
        hint="Replaces the payment's remarks"
      />
      <Alert severity="warning">
        A refund cannot be reversed. If it was made in error, record a new payment.
      </Alert>
    </FormDialog>
  )
}
