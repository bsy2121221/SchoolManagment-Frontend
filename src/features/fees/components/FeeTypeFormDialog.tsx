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
import { FEE_LIMITS, toCents } from '../feeRules'
import { useCreateFeeTypeMutation, useUpdateFeeTypeMutation } from '../feesApi'
import type { FeeType } from '../types'
import { moneyText, optionalMoneySchema } from './moneySchema'

/** Mirrors FeeTypeCreateDTO. The default amount is optional text; see moneySchema. */
const schema = z.object({
  feeTypeName: z
    .string()
    .trim()
    .min(1, 'Fee type name is required')
    .max(100, 'Fee type name cannot exceed 100 characters'),
  description: z.string().trim().max(255, 'Description cannot exceed 255 characters'),
  defaultAmount: optionalMoneySchema(
    FEE_LIMITS.defaultAmount.min,
    FEE_LIMITS.defaultAmount.max,
    'Default amount',
  ),
})

type FeeTypeForm = z.input<typeof schema>

const FIELDS = ['feeTypeName', 'description', 'defaultAmount'] as const

const EMPTY: FeeTypeForm = { feeTypeName: '', description: '', defaultAmount: '' }

interface FeeTypeFormDialogProps {
  open: boolean
  /** The fee type being edited, or null to create one. */
  editing: FeeType | null
  onClose: () => void
}

/**
 * Create or edit one line of the price list.
 *
 * The default amount is a suggestion the billing dialogs pre-fill, not a price: changing it
 * here moves nothing already billed, which the description says so nobody expects otherwise.
 */
export function FeeTypeFormDialog({ open, editing, onClose }: FeeTypeFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [createFeeType, { isLoading: creating }] = useCreateFeeTypeMutation()
  const [updateFeeType, { isLoading: updating }] = useUpdateFeeTypeMutation()

  const { control, handleSubmit, reset, setError } = useForm<FeeTypeForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(
      editing
        ? {
            feeTypeName: editing.feeTypeName,
            description: editing.description ?? '',
            defaultAmount: moneyText(editing.defaultAmount),
          }
        : EMPTY,
    )
  }, [open, editing, reset])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const body = {
      feeTypeName: values.feeTypeName.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
      defaultAmount: values.defaultAmount === '' ? null : toCents(Number(values.defaultAmount)),
    }

    try {
      if (editing) {
        await updateFeeType({ feeTypeId: editing.id, body }).unwrap()
        dispatch(toastSuccess(`${body.feeTypeName} updated.`))
      } else {
        await createFeeType(body).unwrap()
        dispatch(toastSuccess(`${body.feeTypeName} added to the price list.`))
      }
      onClose()
    } catch (caught) {
      const unassigned = applyServerErrors<FeeTypeForm>(caught, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(caught, 'Could not save the fee type.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.feeTypeName}` : 'Add a fee type'}
      description={
        <Typography variant="body2" color="text.secondary">
          {editing
            ? 'A new default applies to fees billed from now on. Fees already billed keep their amount.'
            : 'A fee type is what a fee is for — tuition, transport, a lab charge. Amounts are set when it is billed.'}
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Add fee type'}
      busy={creating || updating}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="feeTypeName"
        control={control}
        label="Name"
        required
        autoFocus
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint="Unique in the school"
      />
      <RHFTextField
        name="description"
        control={control}
        label="Description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      <RHFTextField
        name="defaultAmount"
        control={control}
        label="Default amount"
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        hint="Optional. Pre-filled when this fee is billed."
      />
    </FormDialog>
  )
}
