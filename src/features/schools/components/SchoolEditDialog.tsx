import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useUpdateSchoolMutation } from '../schoolsApi'
import { MONTH_OPTIONS } from '../types'
import type { School, SchoolUpdatePayload } from '../types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/
const SUBDOMAIN_RE = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} cannot exceed ${max} characters`)

/** Mirrors SchoolUpdateDTO. Note SchoolCode is absent — it cannot be changed. */
const schema = z.object({
  schoolName: z
    .string()
    .trim()
    .min(1, 'School name is required')
    .max(150, 'School name cannot exceed 150 characters'),
  subdomain: optionalText(63, 'Subdomain')
    .refine((v) => v === '' || v.length >= 2, 'Subdomain must be at least 2 characters')
    .refine(
      (v) => v === '' || SUBDOMAIN_RE.test(v),
      'Only letters, digits and hyphens, and it cannot start or end with a hyphen',
    ),
  address: optionalText(255, 'Address'),
  city: optionalText(80, 'City'),
  state: optionalText(80, 'State'),
  country: optionalText(80, 'Country'),
  postalCode: optionalText(20, 'Postal code'),
  contactEmail: optionalText(100, 'Contact email').refine(
    (v) => v === '' || EMAIL_RE.test(v),
    'Enter a valid email address',
  ),
  contactPhone: optionalText(20, 'Contact phone'),
  principalName: optionalText(100, 'Principal name'),
  logoUrl: optionalText(500, 'Logo URL'),
  themeColor: z
    .string()
    .trim()
    .min(1, 'Theme colour is required')
    .refine((v) => HEX_COLOR_RE.test(v), 'Must be a hex colour such as #1976d2'),
  academicYearStartMonth: z.coerce.number().int().min(1, 'Pick a month').max(12, 'Pick a month'),
})

type SchoolEditForm = z.input<typeof schema>

const FIELDS = [
  'schoolName',
  'subdomain',
  'address',
  'city',
  'state',
  'country',
  'postalCode',
  'contactEmail',
  'contactPhone',
  'principalName',
  'logoUrl',
  'themeColor',
  'academicYearStartMonth',
] as const

/** The text fields, in the order the form shows them. Used to build the diff. */
const TEXT_FIELDS = [
  'schoolName',
  'address',
  'city',
  'state',
  'country',
  'postalCode',
  'contactEmail',
  'contactPhone',
  'principalName',
  'logoUrl',
  'themeColor',
] as const satisfies ReadonlyArray<keyof SchoolUpdatePayload & keyof School>

function toForm(school: School): SchoolEditForm {
  return {
    schoolName: school.schoolName,
    subdomain: school.subdomain ?? '',
    address: school.address ?? '',
    city: school.city ?? '',
    state: school.state ?? '',
    country: school.country ?? '',
    postalCode: school.postalCode ?? '',
    contactEmail: school.contactEmail ?? '',
    contactPhone: school.contactPhone ?? '',
    principalName: school.principalName ?? '',
    logoUrl: school.logoUrl ?? '',
    themeColor: school.themeColor,
    academicYearStartMonth: school.academicYearStartMonth,
  }
}

interface SchoolEditDialogProps {
  open: boolean
  school: School
  onClose: () => void
}

/**
 * Edits a school: `PUT /api/Schools/{id}`, which a school admin may also call for
 * their own school (the seeded Admin role holds `Schools:Edit`).
 *
 * The API is a genuine partial update, and the procedure implements it as
 * `ISNULL(@City, City)`. Three consequences shape this dialog:
 *
 *   1. A field sent as `null` keeps its stored value, so **only changed fields are
 *      sent**. Submitting the whole form would rewrite every column on every save and
 *      turn stored `NULL`s into empty strings for no reason.
 *   2. A field sent as `''` *does* clear it — the empty string reaches the column. So
 *      emptying an input really does erase the value, which is what the user expects.
 *   3. Subdomain is the exception: the procedure runs it through
 *      `NULLIF(TRIM(...), '')`, so `''` collapses to `null` and means "leave alone".
 *      Removing one needs the separate `clearSubdomain` flag, set here when the field
 *      was filled and has been emptied.
 *
 * `schoolCode` is not editable and is not shown as an input, because it is embedded
 * verbatim in every username and admission number the school has already issued.
 */
export function SchoolEditDialog({ open, school, onClose }: SchoolEditDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)
  const [updateSchool, { isLoading }] = useUpdateSchoolMutation()

  const { control, handleSubmit, reset, setError } = useForm<SchoolEditForm>({
    resolver: zodResolver(schema),
    defaultValues: toForm(school),
  })

  // useWatch rather than watch(): it subscribes to the one field and returns its value,
  // so the swatch re-renders as the colour is typed without the compiler having to
  // reason about a function it cannot memoize.
  const themeColor = useWatch({ control, name: 'themeColor' })

  // Re-seed on open: RHF keeps its values, so reopening after an edit elsewhere would
  // show the previous school's fields. Clearing on *close* instead -- which is what the
  // set-state-in-effect rule suggests -- would repaint the form during the dialog's exit
  // transition, so the state is reset on the way in.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(toForm(school))
  }, [open, school, reset])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const body: SchoolUpdatePayload = {}

    for (const field of TEXT_FIELDS) {
      const next = String(values[field] ?? '').trim()
      const current = school[field] ?? ''
      if (next !== current) body[field] = next
    }

    const month = Number(values.academicYearStartMonth)
    if (month !== school.academicYearStartMonth) body.academicYearStartMonth = month

    const nextSubdomain = values.subdomain.trim().toLowerCase()
    const currentSubdomain = school.subdomain ?? ''
    if (nextSubdomain !== currentSubdomain) {
      if (nextSubdomain === '') {
        // '' would be read as "leave alone"; only the flag actually removes it.
        body.clearSubdomain = true
      } else {
        body.subdomain = nextSubdomain
      }
    }

    if (Object.keys(body).length === 0) {
      onClose()
      return
    }

    try {
      await updateSchool({ schoolId: school.id, body }).unwrap()
      dispatch(toastSuccess(`${values.schoolName.trim()} updated.`))
      onClose()
    } catch (error) {
      // The duplicate-subdomain refusal arrives here and names the school holding it.
      const unassigned = applyServerErrors<SchoolEditForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save the school.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={`Edit ${school.schoolName}`}
      description={
        <Typography variant="body2" color="text.secondary">
          The school code is <strong>{school.schoolCode}</strong> and cannot be changed —
          it is part of every username and admission number already issued.
        </Typography>
      }
      error={formError}
      submitLabel="Save changes"
      busy={isLoading}
      onSubmit={onSubmit}
      onClose={onClose}
      maxWidth="md"
    >
      <RHFTextField
        name="schoolName"
        control={control}
        label="School name"
        required
        autoFocus
        slotProps={{ htmlInput: { maxLength: 150 } }}
      />

      <RHFTextField
        name="subdomain"
        control={control}
        label="Subdomain"
        slotProps={{ htmlInput: { maxLength: 63 } }}
        hint={
          school.subdomain
            ? 'Clearing this removes the subdomain, and any host relying on it stops resolving'
            : 'Optional, and unique across the platform'
        }
      />

      <RHFTextField
        name="principalName"
        control={control}
        label="Principal"
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />

      <RHFTextField
        name="address"
        control={control}
        label="Address"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <RHFTextField
          name="city"
          control={control}
          label="City"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 80 } }}
        />
        <RHFTextField
          name="state"
          control={control}
          label="State"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 80 } }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <RHFTextField
          name="country"
          control={control}
          label="Country"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 80 } }}
        />
        <RHFTextField
          name="postalCode"
          control={control}
          label="Postal code"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 20 } }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <RHFTextField
          name="contactEmail"
          control={control}
          label="Contact email"
          type="email"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <RHFTextField
          name="contactPhone"
          control={control}
          label="Contact phone"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 20 } }}
        />
      </Stack>

      <Divider />

      <RHFSelect
        name="academicYearStartMonth"
        control={control}
        label="Academic year starts in"
        options={MONTH_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
        hint="Changing this re-frames which months count as the current session"
      />

      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <RHFTextField
          name="themeColor"
          control={control}
          label="Theme colour"
          required
          fullWidth
          slotProps={{ htmlInput: { maxLength: 20 } }}
          hint="Hex, such as #1976d2"
        />
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            mt: 0.5,
            bgcolor: themeColor,
          }}
        />
      </Stack>

      <RHFTextField
        name="logoUrl"
        control={control}
        label="Logo URL"
        slotProps={{ htmlInput: { maxLength: 500 } }}
        hint="The API stores a URL; it does not host uploads for schools"
      />
    </FormDialog>
  )
}
