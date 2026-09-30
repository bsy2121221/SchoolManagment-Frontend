import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { today } from '@/lib/dates'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import {
  assignSummary,
  buildInstalments,
  FEE_LIMITS,
  formatPeriod,
  MONTH_OPTIONS,
  toCents,
} from '../feeRules'
import {
  useAssignFeesToStudentMutation,
  useAssignFeeToClassMutation,
  useGetFeeTypesQuery,
} from '../feesApi'
import { moneySchema, moneyText } from './moneySchema'

const schema = z.object({
  classId: z.union([z.string(), z.number(), z.null()]),
  feeTypeId: z.union([z.string(), z.number(), z.null()]),
  amount: moneySchema(FEE_LIMITS.amount.min, FEE_LIMITS.amount.max),
  dueDate: z.date({ message: 'Pick the date the fee falls due' }),
  feeMonth: z.union([z.string(), z.number()]),
  feeYear: z
    .number({ message: 'Billing year is required' })
    .int('A year is a whole number')
    .min(FEE_LIMITS.year.min, `Billing year must be ${FEE_LIMITS.year.min} or later`)
    .max(FEE_LIMITS.year.max, `Billing year must be ${FEE_LIMITS.year.max} or earlier`),
  months: z
    .number({ message: 'How many months?' })
    .int('A whole number of months')
    .min(1, 'At least one month')
    .max(12, 'At most twelve months at once'),
})

type BillForm = z.input<typeof schema>

const FIELDS = ['classId', 'feeTypeId', 'amount', 'dueDate', 'feeMonth', 'feeYear'] as const

function emptyForm(): BillForm {
  const now = today()
  return {
    classId: null,
    feeTypeId: null,
    amount: '',
    dueDate: now,
    feeMonth: now.getMonth() + 1,
    feeYear: now.getFullYear(),
    months: 1,
  }
}

/** Who is being billed. A class bills every active student on its roll. */
export type BillTarget =
  | { kind: 'student'; studentId: number; name: string }
  | { kind: 'class' }

interface BillFeeDialogProps {
  open: boolean
  target: BillTarget
  onClose: () => void
}

/**
 * Bill a fee — to one student, or to every active student in a class.
 *
 * The billing period is asked for separately from the due date, because they are different
 * things and the duplicate check runs on the period: a September fee due on 5 October is
 * September's fee, and billing September again is skipped rather than charged twice. The
 * procedure would otherwise take the period from the due date, which is right only when the
 * two happen to fall in the same month.
 *
 * For one student the fee can repeat over consecutive months — a term's tuition in one go —
 * which is what the batch endpoint is for. A class is billed one period at a time, because
 * that is what `POST /fees/classes/{id}` takes.
 */
export function BillFeeDialog({ open, target, onClose }: BillFeeDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)
  const isClass = target.kind === 'class'

  const [assignToStudent, { isLoading: assigningStudent }] = useAssignFeesToStudentMutation()
  const [assignToClass, { isLoading: assigningClass }] = useAssignFeeToClassMutation()

  const { data: feeTypes, isLoading: loadingTypes } = useGetFeeTypesQuery(undefined, {
    skip: !open,
  })
  const {
    classes,
    isLoading: loadingClasses,
    hasMore,
  } = useClassLookup({ skip: !open || !isClass })

  const { control, handleSubmit, reset, setError, setValue } = useForm<BillForm>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(),
  })

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(emptyForm())
  }, [open, reset])

  const feeTypeId = useWatch({ control, name: 'feeTypeId' })
  const feeMonth = useWatch({ control, name: 'feeMonth' })
  const feeYear = useWatch({ control, name: 'feeYear' })
  const months = useWatch({ control, name: 'months' })

  const selectedType = useMemo(
    () => (feeTypes ?? []).find((row) => String(row.id) === String(feeTypeId)) ?? null,
    [feeTypes, feeTypeId],
  )

  // Pre-fill the type's default whenever the type changes. Deliberately overwrites what was
  // typed: choosing a different fee is choosing a different price.
  useEffect(() => {
    if (!selectedType || selectedType.defaultAmount === null) return
    setValue('amount', moneyText(selectedType.defaultAmount), { shouldValidate: false })
  }, [selectedType, setValue])

  const periodRange =
    !isClass && typeof months === 'number' && months > 1 && typeof feeYear === 'number'
      ? (() => {
          const start = Number(feeMonth)
          const endOffset = start - 1 + months - 1
          return `${formatPeriod(start, feeYear)} – ${formatPeriod(
            (endOffset % 12) + 1,
            feeYear + Math.floor(endOffset / 12),
          )}`
        })()
      : null

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    if (values.feeTypeId === null || values.feeTypeId === '') {
      setError('feeTypeId', { type: 'manual', message: 'Choose what the fee is for' })
      return
    }
    if (isClass && (values.classId === null || values.classId === '')) {
      setError('classId', { type: 'manual', message: 'Choose the class to bill' })
      return
    }

    const items = buildInstalments({
      feeTypeId: Number(values.feeTypeId),
      amount: toCents(Number(values.amount)),
      firstDueDate: values.dueDate,
      feeMonth: Number(values.feeMonth),
      feeYear: values.feeYear,
      months: isClass ? 1 : values.months,
    })
    const [first] = items
    if (!first) return

    try {
      const result =
        target.kind === 'class'
          ? await assignToClass({ classId: Number(values.classId), fee: first }).unwrap()
          : await assignToStudent({ studentId: target.studentId, fees: items }).unwrap()

      if (result.feesCreated === 0) {
        // A 200 that billed nothing is not a success to celebrate. Keep the dialog open.
        setFormError(
          isClass
            ? 'Nothing was billed: every student in this class already has this fee for this period.'
            : 'Nothing was billed: this student already has this fee for every period chosen.',
        )
        return
      }

      dispatch(toastSuccess(assignSummary(result.feesCreated, result.feesSkipped)))
      onClose()
    } catch (caught) {
      const unassigned = applyServerErrors<BillForm>(caught, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(caught, 'Could not bill the fee.'))
    }
  })

  const typeOptions = (feeTypes ?? []).map((row) => ({ value: row.id, label: row.feeTypeName }))
  const noTypes = !loadingTypes && feeTypes !== undefined && feeTypes.length === 0

  return (
    <FormDialog
      open={open}
      title={target.kind === 'class' ? 'Bill a class' : `Bill ${target.name}`}
      description={
        <Typography variant="body2" color="text.secondary">
          {isClass
            ? 'Bills every active student in the class. Students who already have this fee for this period are skipped, not charged twice.'
            : 'A fee this student already has for the same period is skipped, not charged twice.'}
        </Typography>
      }
      error={formError}
      submitLabel={isClass ? 'Bill class' : 'Bill fee'}
      busy={assigningStudent || assigningClass}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      {noTypes && (
        <Alert severity="warning">
          The price list is empty. Add a fee type on the Fee types tab first.
        </Alert>
      )}

      {isClass && (
        <RHFSelect
          name="classId"
          control={control}
          label="Class"
          required
          options={classes.map((row) => ({ value: row.id, label: classLabel(row) }))}
          loadingOptions={loadingClasses}
          hint={hasMore ? 'Showing the first 100 active classes; this school has more' : undefined}
        />
      )}

      <RHFSelect
        name="feeTypeId"
        control={control}
        label="Fee type"
        required
        options={typeOptions}
        loadingOptions={loadingTypes}
        hint={selectedType?.description ?? undefined}
      />

      <RHFTextField
        name="amount"
        control={control}
        label={isClass ? 'Amount per student' : 'Amount'}
        required
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        hint={
          selectedType && selectedType.defaultAmount !== null
            ? 'Pre-filled from the fee type'
            : undefined
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <RHFSelect
          name="feeMonth"
          control={control}
          label="Billing month"
          required
          fullWidth
          options={MONTH_OPTIONS}
        />
        <RHFTextField
          name="feeYear"
          control={control}
          label="Billing year"
          numeric
          required
          fullWidth
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
      </Stack>

      <Controller
        name="dueDate"
        control={control}
        render={({ field, fieldState }) => (
          <DatePicker
            label={!isClass && typeof months === 'number' && months > 1 ? 'First due date' : 'Due date'}
            value={field.value ?? null}
            onChange={field.onChange}
            slotProps={{
              textField: {
                required: true,
                error: Boolean(fieldState.error),
                helperText:
                  fieldState.error?.message ??
                  'Unpaid after this date, the fee shows as overdue',
              },
            }}
          />
        )}
      />

      {!isClass && (
        <RHFTextField
          name="months"
          control={control}
          label="Consecutive months"
          numeric
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          hint={
            periodRange
              ? `Bills ${periodRange}, each due a month after the last`
              : 'Bill the same fee for several months in one go (up to 12)'
          }
        />
      )}
    </FormDialog>
  )
}
