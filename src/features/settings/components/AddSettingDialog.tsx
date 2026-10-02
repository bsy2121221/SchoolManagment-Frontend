import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { SEEDED_CATEGORIES, validateValue } from '../settingRules'
import { useCreateSettingMutation } from '../settingsApi'
import { SETTING_DATA_TYPES } from '../types'

/**
 * Mirrors SettingSaveDTO's DataAnnotations (50 / 100 / 255). The value is checked against
 * its type the same way the service checks it, so the refusal shows under the field rather
 * than as a 400 at the top of the dialog.
 */
const schema = z
  .object({
    category: z
      .string()
      .trim()
      .min(1, 'Category is required')
      .max(50, 'Category cannot exceed 50 characters'),
    settingKey: z
      .string()
      .trim()
      .min(1, 'Key is required')
      .max(100, 'Key cannot exceed 100 characters'),
    dataType: z.enum(SETTING_DATA_TYPES),
    settingValue: z.string(),
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters'),
  })
  .superRefine((values, ctx) => {
    const problem = validateValue(values.dataType, values.settingValue)
    if (problem) ctx.addIssue({ code: 'custom', path: ['settingValue'], message: problem })
  })

type AddSettingForm = z.input<typeof schema>

const FIELDS = ['category', 'settingKey', 'dataType', 'settingValue', 'description'] as const

const CATEGORY_OPTIONS = SEEDED_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))

const TYPE_OPTIONS = SETTING_DATA_TYPES.map((type) => ({ value: type, label: type }))

interface AddSettingDialogProps {
  open: boolean
  /** The tab the dialog was opened from, used as the starting category. */
  defaultCategory: string
  onClose: () => void
}

/**
 * Adds a setting the seed does not include.
 *
 * Worth being plain about: nothing reads a setting added here. It is stored and returned,
 * which is useful for a value an integration or a later feature will pick up, but it changes
 * no behaviour today. The category list is the six seeded ones, which is all the page
 * groups by name; the API itself would take any category.
 */
export function AddSettingDialog({ open, defaultCategory, onClose }: AddSettingDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)
  const [createSetting, { isLoading }] = useCreateSettingMutation()

  const { control, handleSubmit, reset, setError } = useForm<AddSettingForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: defaultCategory,
      settingKey: '',
      dataType: 'string',
      settingValue: '',
      description: '',
    },
  })

  // Re-seed on open, for the same reason as the other dialogs: RHF keeps its values.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    const seeded = SEEDED_CATEGORIES.some((c) => c.key === defaultCategory)
    reset({
      category: seeded ? defaultCategory : 'SystemConfiguration',
      settingKey: '',
      dataType: 'string',
      settingValue: '',
      description: '',
    })
  }, [open, defaultCategory, reset])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await createSetting({
        category: values.category.trim(),
        settingKey: values.settingKey.trim(),
        settingValue: values.settingValue,
        dataType: values.dataType,
        description: values.description.trim() || null,
      }).unwrap()
      dispatch(toastSuccess(`${values.settingKey.trim()} added.`))
      onClose()
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        setError('settingKey', { message: 'This category already has a setting with that key' })
        return
      }
      const unassigned = applyServerErrors<AddSettingForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not add the setting.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title="Add a setting"
      description={
        <Typography variant="body2" color="text.secondary">
          The key must be unique within its category. Keys are compared without regard to case.
        </Typography>
      }
      error={formError}
      submitLabel="Add setting"
      busy={isLoading}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFSelect name="category" control={control} label="Category" options={CATEGORY_OPTIONS} required />
      <RHFTextField
        name="settingKey"
        control={control}
        label="Key"
        required
        autoFocus
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint="For example admissionFormUrl"
      />
      <RHFSelect name="dataType" control={control} label="Type" options={TYPE_OPTIONS} required />
      <RHFTextField name="settingValue" control={control} label="Value" multiline maxRows={6} />
      <RHFTextField
        name="description"
        control={control}
        label="Description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      <Alert severity="info">
        A new setting is stored and returned, but no part of the system reads it yet.
      </Alert>
    </FormDialog>
  )
}
