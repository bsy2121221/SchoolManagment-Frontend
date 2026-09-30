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
import { TEMP_PASSWORD } from '@/types/enums'
import { toastSuccess } from '@/ui/uiSlice'
import { useRegisterTeacherMutation, useUpdateTeacherMutation } from '../teachersApi'
import type { TeacherRegistrationResult, TeacherRow } from '../types'

/**
 * Mirrors TeacherRegistrationDTO and TeacherUpdateDTO, which are field-for-field
 * identical -- so unlike the student dialog there is nothing that exists in only one mode.
 *
 * Two things are deliberately **not** here:
 *
 *  - No password. `sp_RegisterTeacher` takes a hash but the service always passes the
 *    hash of Temp@123, so there is nothing for an admin to choose. Students differ: their
 *    DTO carries an optional password.
 *  - No subject picker. `subjectIds` on the DTO replaces the whole link set, and mixing
 *    that into a details form makes "I only changed the phone number" silently rewrite the
 *    subjects. Assignment lives in its own panel on the profile.
 *
 * `sp_UpdateTeacherDetails` writes every column it is given, so an empty box clears what
 * is on file -- the description says so in edit mode.
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
  // Both numerics are optional, and '' has to stay distinguishable from 0: a teacher with
  // no recorded experience is not a teacher with none.
  experience: z
    .union([z.literal(''), z.number()])
    .refine((value) => value === '' || value >= 0, 'Experience cannot be negative')
    .refine((value) => value === '' || value <= 50, 'Experience cannot exceed 50 years'),
  salary: z
    .union([z.literal(''), z.number()])
    .refine((value) => value === '' || value >= 0, 'Salary cannot be negative')
    .refine((value) => value === '' || value <= 9999999.99, 'Salary cannot exceed 9,999,999.99'),
})

type TeacherForm = z.input<typeof schema>

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'address',
  'subject',
  'qualification',
  'experience',
  'salary',
] as const

const EMPTY: TeacherForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  address: '',
  subject: '',
  qualification: '',
  experience: '',
  salary: '',
}

/** Empty boxes mean "not recorded", which the API models as null rather than "" or 0. */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function numberOrNull(value: number | ''): number | null {
  return value === '' ? null : value
}

/**
 * What the dialog needs of a teacher in order to edit them -- the editable columns plus
 * both ids. Narrower than `TeacherRow` on purpose: `TeacherProfile` satisfies this too, so
 * the list and the profile open the same dialog without one converting to the other's shape.
 */
export type EditableTeacher = Pick<
  TeacherRow,
  | 'id'
  | 'userId'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'address'
  | 'subject'
  | 'qualification'
  | 'experience'
  | 'salary'
>

interface TeacherFormDialogProps {
  open: boolean
  /** The teacher being edited, or null to register one. */
  editing: EditableTeacher | null
  /** Hides the salary field for an admin who may edit but should not see pay. */
  showSalary?: boolean
  onClose: () => void
  /** Called after a successful registration -- lets the caller open the new profile. */
  onRegistered?: (result: TeacherRegistrationResult) => void
}

export function TeacherFormDialog({
  open,
  editing,
  showSalary = true,
  onClose,
  onRegistered,
}: TeacherFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [registerTeacher, { isLoading: registering }] = useRegisterTeacherMutation()
  const [updateTeacher, { isLoading: updating }] = useUpdateTeacherMutation()

  const { control, handleSubmit, reset, setError } = useForm<TeacherForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Re-seed on open: RHF keeps its values, so reopening after editing another teacher
  // would show that teacher's details.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(
      editing
        ? {
            firstName: editing.firstName,
            lastName: editing.lastName,
            email: editing.email,
            phoneNumber: editing.phoneNumber ?? '',
            address: editing.address ?? '',
            subject: editing.subject ?? '',
            qualification: editing.qualification ?? '',
            experience: editing.experience ?? '',
            salary: editing.salary ?? '',
          }
        : EMPTY,
    )
  }, [open, editing, reset])

  const busy = registering || updating

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const common = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phoneNumber: orNull(values.phoneNumber),
      address: orNull(values.address),
      subject: orNull(values.subject),
      qualification: orNull(values.qualification),
      experience: numberOrNull(values.experience),
    }

    // Omitted rather than sent as null when hidden: null would clear the salary on file,
    // which is the opposite of "this user is not allowed to see it".
    const withSalary = showSalary ? { ...common, salary: numberOrNull(values.salary) } : common

    try {
      if (editing) {
        await updateTeacher({
          teacherId: editing.id,
          userId: editing.userId,
          // Null leaves the subject links alone. Anything else here would make a details
          // edit rewrite the assignment set.
          body: { ...withSalary, subjectIds: null },
        }).unwrap()
        dispatch(toastSuccess(`${common.firstName} ${common.lastName} updated.`))
        onClose()
        return
      }

      const result = await registerTeacher(withSalary).unwrap()

      // The username and employee number are allocated server-side and are the two things
      // the admin has to pass on, so they go in the message.
      dispatch(
        toastSuccess(
          `${common.firstName} ${common.lastName} registered as ${result.username}, employee ${result.employeeId}.`,
        ),
      )
      onRegistered?.(result)
      onClose()
    } catch (error) {
      // "Email already exists" and "Generated username already exists" both arrive here,
      // and each tells the admin what to change.
      const unassigned = applyServerErrors<TeacherForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save the teacher.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : 'Register a teacher'}
      description={
        <Typography variant="body2" color="text.secondary">
          {editing
            ? 'Everything here is saved as entered — a box left empty clears what is on file for it. Subject assignment is separate, and is not touched by this form.'
            : 'Registering a teacher creates their login as well as their record. The username and employee number are allocated by the server.'}
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Register teacher'}
      busy={busy}
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
        hint="Must be unique within the school; it is how the account is identified"
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
        hint="Free text, for display only — what they actually teach is the subject assignment"
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
        hint="Years, 0–50. Leave empty if it is not recorded"
      />

      {showSalary && (
        <RHFTextField
          name="salary"
          control={control}
          label="Salary"
          type="number"
          numeric
          slotProps={{ htmlInput: { min: 0, max: 9999999.99, step: 0.01 } }}
          hint="Monthly, up to 9,999,999.99. Leave empty if it is not recorded"
        />
      )}

      <RHFTextField
        name="address"
        control={control}
        label="Address"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />

      {!editing && (
        <Alert severity="info">
          The account is created with the password {TEMP_PASSWORD} and the teacher is asked to
          change it at their first sign-in. Assign their subjects from the profile once this
          succeeds — until they have a subject in a class, they cannot enter marks.
        </Alert>
      )}
    </FormDialog>
  )
}
