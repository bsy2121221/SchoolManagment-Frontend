import Typography from '@mui/material/Typography'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFTextField } from '@/components/form/RHFTextField'
import { parseApiDate, toApiDate, today } from '@/lib/dates'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { FEE_LIMITS, formatMoney, formatPeriod, toCents } from '../feeRules'
import { useUpdateFeeMutation } from '../feesApi'
import type { StudentFee } from '../types'
import { moneySchema, moneyText } from './moneySchema'

const schema = z.object({
  amount: moneySchema(FEE_LIMITS.amount.min, FEE_LIMITS.amount.max),
  dueDate: z.date({ message: 'Pick the date the fee falls due' }),
})

type EditFeeForm = z.input<typeof schema>

const FIELDS = ['amount', 'dueDate'] as const

interface EditFeeDialogProps {
  fee: StudentFee | null
  onClose: () => void
}

/**
 * Correct a fee's amount or due date. The type and period are what identify the fee, so they
 * are not editable: a fee billed under the wrong type is cancelled and billed again.
 *
 * The one refusal worth anticipating is lowering the amount below what has been paid, which
 * the server refuses. The floor is checked here too, so the cashier is told before submitting.
 */
export function EditFeeDialog({ fee, onClose }: EditFeeDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)
  const [updateFee, { isLoading }] = useUpdateFeeMutation()

  const { control, handleSubmit, reset, setError } = useForm<EditFeeForm>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', dueDate: today() },
  })

  useEffect(() => {
    if (!fee) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset({ amount: moneyText(fee.amount), dueDate: parseApiDate(fee.dueDate) ?? today() })
  }, [fee, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!fee) return
    setFormError(null)

    const amount = toCents(Number(values.amount))
    if (amount < fee.totalPaid) {
      setError('amount', {
        type: 'manual',
        message: `${formatMoney(fee.totalPaid)} has already been paid; the fee cannot be less`,
      })
      return
    }

    try {
      await updateFee({
        feeId: fee.id,
        body: { amount, dueDate: toApiDate(values.dueDate) ?? '' },
      }).unwrap()
      dispatch(toastSuccess(`${fee.feeTypeName} for ${formatPeriod(fee.feeMonth, fee.feeYear)} updated.`))
      onClose()
    } catch (caught) {
      const unassigned = applyServerErrors<EditFeeForm>(caught, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(caught, 'Could not update the fee.'))
    }
  })

  return (
    <FormDialog
      open={fee !== null}
      title={fee ? `Edit ${fee.feeTypeName} · ${formatPeriod(fee.feeMonth, fee.feeYear)}` : 'Edit fee'}
      description={
        <Typography variant="body2" color="text.secondary">
          The change is recorded in the audit trail with the old and new figures.
        </Typography>
      }
      error={formError}
      submitLabel="Save changes"
      busy={isLoading}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="amount"
        control={control}
        label="Amount"
        required
        autoFocus
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        hint={
          fee && fee.totalPaid > 0
            ? `At least ${formatMoney(fee.totalPaid)}, which has already been paid`
            : undefined
        }
      />
      <Controller
        name="dueDate"
        control={control}
        render={({ field, fieldState }) => (
          <DatePicker
            label="Due date"
            value={field.value ?? null}
            onChange={field.onChange}
            slotProps={{
              textField: {
                required: true,
                error: Boolean(fieldState.error),
                helperText: fieldState.error?.message,
              },
            }}
          />
        )}
      />
    </FormDialog>
  )
}
