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
import { useUpdateMyTeacherProfileMutation } from '../teachersApi'
import type { TeacherProfile } from '../types'

/**
 * The self-service half of the teacher form.
 *
 * Separate from `TeacherFormDialog` rather than a mode of it, because the two go to
 * different endpoints with different bodies and different rules:
 *
 *  - `PUT /teachers/my-profile` resolves the teacher from the token, so there is no id to
 *    send and no way to aim it at someone else.
 *  - `sp_UpdateTeacherProfile` takes no `@Salary` and no `@SubjectIds`. A teacher cannot
 *    change their own pay or hand themselves a subject, and the absence of those fields
 *    here is the reason, not an oversight.
 *
 * Same replacement semantics as the admin edit: every column named is written, so a box
 * left empty clears what is on file.
 */
const schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(100, 'Email cannot exceed 100 characters'),
  phoneNumber: z.string().trim().max(15, 'Phone number cannot exceed 15 characters'),
  address: z.string().trim().max(255, 'Address cannot exceed 255 characters'),
  subject: z.string().trim().max(100, 'Subject cannot exceed 100 characters'),
  qualification: z.string().trim().max(255, 'Qualification cannot exceed 255 characters'),
  experience: z
    .union([z.literal(''), z.number()])
    .refine((value) => value === '' || value >= 0, 'Experience cannot be negative')
    .refine((value) => value === '' || value <= 50, 'Experience cannot exceed 50 years'),
})

type MyProfileForm = z.input<typeof schema>

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'address',
  'subject',
  'qualification',
  'experience',
] as const

const EMPTY: MyProfileForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  address: '',
  subject: '',
  qualification: '',
  experience: '',
}

function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

interface MyProfileFormDialogProps {
  open: boolean
  /** The signed-in teacher's own profile, as the server last returned it. */
  profile: TeacherProfile | undefined
  onClose: () => void
}

export function MyProfileFormDialog({ open, profile, onClose }: MyProfileFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [updateProfile, { isLoading: saving }] = useUpdateMyTeacherProfileMutation()

  const { control, handleSubmit, reset, setError } = useForm<MyProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(
      profile
        ? {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            phoneNumber: profile.phoneNumber ?? '',
            address: profile.address ?? '',
            subject: profile.subject ?? '',
            qualification: profile.qualification ?? '',
            experience: profile.experience ?? '',
          }
        : EMPTY,
    )
  }, [open, profile, reset])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await updateProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phoneNumber: orNull(values.phoneNumber),
        address: orNull(values.address),
        subject: orNull(values.subject),
        qualification: orNull(values.qualification),
        experience: values.experience === '' ? null : values.experience,
      }).unwrap()
      dispatch(toastSuccess('Your details have been saved.'))
      onClose()
    } catch (error) {
      // A duplicate email is the refusal to expect here, and it belongs on the field.
      const unassigned = applyServerErrors<MyProfileForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save your details.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title="Edit my details"
      description={
        <Typography variant="body2" color="text.secondary">
          Saved as entered — a box left empty clears what is on file for it. Your salary, your
          subjects and the classes you teach in are set by an administrator and are not editable
          here.
        </Typography>
      }
      error={formError}
      submitLabel="Save changes"
      busy={saving}
      onSubmit={onSubmit}
      onClose={onClose}
      maxWidth="md"
    >
      <RHFTextField
        name="firstName"
        control={control}
        label="First name"
        required
        autoFocus
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />

      <RHFTextField
        name="lastName"
        control={control}
        label="Last name"
        required
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />

      <RHFTextField
        name="email"
        control={control}
        label="Email"
        type="email"
        required
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint="Must stay unique within your school — it identifies your account"
      />

      <RHFTextField
        name="phoneNumber"
        control={control}
        label="Phone number"
        slotProps={{ htmlInput: { maxLength: 15 } }}
        hint="Optional"
      />

      <RHFTextField
        name="subject"
        control={control}
        label="Primary subject"
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint="Free text, for display only — it does not change what you can mark"
      />

      <RHFTextField
        name="qualification"
        control={control}
        label="Qualification"
        slotProps={{ htmlInput: { maxLength: 255 } }}
        hint="For example M.Sc Physics, B.Ed"
      />

      <RHFTextField
        name="experience"
        control={control}
        label="Experience"
        type="number"
        numeric
        slotProps={{ htmlInput: { min: 0, max: 50, step: 1 } }}
        hint="Years, 0–50"
      />

      <RHFTextField
        name="address"
        control={control}
        label="Address"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
    </FormDialog>
  )
}
