import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import type { SelectOption } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { classLabel, isClassFull, useClassLookup } from '@/features/classes/classLookup'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { GENDERS, PASSWORD_PATTERN, TEMP_PASSWORD } from '@/types/enums'
import { toastSuccess } from '@/ui/uiSlice'
import { useRegisterStudentMutation, useUpdateStudentMutation } from '../studentsApi'
import type { StudentRegistrationResult, StudentRow } from '../types'

/**
 * Mirrors StudentRegistrationDTO and StudentUpdateDTO. They differ in two fields, which is
 * the whole shape of this dialog:
 *
 *  - `classId` exists only on registration. A class move is a promotion, because the roll
 *    number has to be reallocated -- see StudentPromoteDialog.
 *  - `password` exists only on registration, and is optional there.
 *
 * Date of birth and gender are `[Required]` on registration and nullable on update, but
 * they are required here in both modes on purpose: `sp_UpdateStudent` writes every column
 * it is given, so submitting them empty would erase what is on file rather than leave it
 * alone.
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
  dateOfBirth: z.string().trim().min(1, 'Date of birth is required'),
  gender: z.enum(GENDERS, { error: 'Gender is required' }),
  // The select hands back a string id or null; required on registration, where it is the
  // only field this dialog validates by hand -- see onSubmit.
  classId: z.union([z.string(), z.number(), z.null()]).default(null),
  fatherName: z.string().trim().max(100, "Father's name cannot exceed 100 characters"),
  motherName: z.string().trim().max(100, "Mother's name cannot exceed 100 characters"),
  bloodGroup: z.string().trim().max(5, 'Blood group cannot exceed 5 characters'),
  address: z.string().trim().max(255, 'Address cannot exceed 255 characters'),
  password: z
    .string()
    .trim()
    .refine((value) => value === '' || value.length >= 8, 'Password must be at least 8 characters')
    .refine((value) => value === '' || value.length <= 100, 'Password cannot exceed 100 characters')
    .refine(
      (value) => value === '' || PASSWORD_PATTERN.test(value),
      'Needs an upper case letter, a lower case letter, a digit and one of @$!%*?&',
    ),
})

type StudentForm = z.input<typeof schema>

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'dateOfBirth',
  'gender',
  'classId',
  'fatherName',
  'motherName',
  'bloodGroup',
  'address',
  'password',
] as const

const EMPTY: StudentForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  dateOfBirth: '',
  gender: 'Male',
  classId: null,
  fatherName: '',
  motherName: '',
  bloodGroup: '',
  address: '',
  password: '',
}

const GENDER_OPTIONS: SelectOption[] = GENDERS.map((value) => ({ value, label: value }))

/**
 * `<input type="date">` accepts `yyyy-MM-dd` and nothing else, while the API sends a full
 * `DateTime` ("2011-04-09T00:00:00"). Cutting at the T rather than going through `Date`
 * keeps the day the server meant: parsing that string in a timezone behind UTC and
 * formatting it back can move it to the 8th.
 */
function toDateInput(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

/** Empty boxes mean "not recorded", which the API models as null rather than "". */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

interface StudentFormDialogProps {
  open: boolean
  /** The student being edited, or null to register one. */
  editing: StudentRow | null
  onClose: () => void
  /** Called after a successful registration -- lets the caller open the new profile. */
  onRegistered?: (result: StudentRegistrationResult) => void
}

export function StudentFormDialog({
  open,
  editing,
  onClose,
  onRegistered,
}: StudentFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [registerStudent, { isLoading: registering }] = useRegisterStudentMutation()
  const [updateStudent, { isLoading: updating }] = useUpdateStudentMutation()

  // Only registration picks a class, so the class list is not fetched while editing.
  const { classes, isLoading: loadingClasses, hasMore } = useClassLookup({
    skip: !open || editing !== null,
  })

  const classOptions: SelectOption[] = classes.map((row) => ({
    value: row.id,
    // A full class is shown but not selectable: sp_RegisterStudent refuses it, and reading
    // "50 of 50" here beats learning it from a rejected submission.
    label: isClassFull(row)
      ? `${classLabel(row)} — full, ${row.totalStudents}/${row.maxStudents}`
      : `${classLabel(row)} — ${row.totalStudents}/${row.maxStudents}`,
    disabled: isClassFull(row),
  }))

  const { control, handleSubmit, reset, setError } = useForm<StudentForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Re-seed on open: RHF keeps its values, so reopening after editing another student
  // would show that student's details.
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
            dateOfBirth: toDateInput(editing.dateOfBirth),
            // Legacy rows can hold no gender; the field is required, so the admin is asked
            // for it rather than the value being guessed.
            gender: (editing.gender as StudentForm['gender']) ?? 'Male',
            classId: editing.classId,
            fatherName: editing.fatherName ?? '',
            motherName: editing.motherName ?? '',
            bloodGroup: editing.bloodGroup ?? '',
            address: editing.address ?? '',
            password: '',
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
      dateOfBirth: values.dateOfBirth,
      gender: values.gender,
      fatherName: orNull(values.fatherName),
      motherName: orNull(values.motherName),
      bloodGroup: orNull(values.bloodGroup),
      address: orNull(values.address),
    }

    try {
      if (editing) {
        await updateStudent({ studentId: editing.id, body: common }).unwrap()
        dispatch(toastSuccess(`${common.firstName} ${common.lastName} updated.`))
        onClose()
        return
      }

      // Validated here rather than in the schema because the field only exists in this
      // mode, and a student being edited may legitimately have no class.
      if (values.classId === null || values.classId === '') {
        setError('classId', { type: 'manual', message: 'Choose the class to admit into' })
        return
      }

      const result = await registerStudent({
        ...common,
        classId: Number(values.classId),
        password: orNull(values.password),
      }).unwrap()

      // The generated username and allocated roll number are decided server-side and are
      // the two things the admin has to pass on, so they go in the message.
      dispatch(
        toastSuccess(
          `${common.firstName} ${common.lastName} admitted to ${result.className} as ${
            result.username
          }, roll ${result.rollNumber ?? 'not allocated'}.`,
        ),
      )
      onRegistered?.(result)
      onClose()
    } catch (error) {
      // "Class 10-A is full", "Email already exists", "Class not found in this school" all
      // arrive here, and each one tells the admin what to change.
      const unassigned = applyServerErrors<StudentForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save the student.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : 'Register a student'}
      description={
        <Typography variant="body2" color="text.secondary">
          {editing
            ? 'Everything here is saved as entered — a box left empty clears what is on file for it.'
            : 'Registering a student creates their login as well as their record. The admission number and roll number are allocated by the server.'}
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Register student'}
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
        name="dateOfBirth"
        control={control}
        label="Date of birth"
        type="date"
        required
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <RHFSelect name="gender" control={control} label="Gender" options={GENDER_OPTIONS} required />

      {!editing && (
        <RHFSelect
          name="classId"
          control={control}
          label="Class"
          options={classOptions}
          required
          loadingOptions={loadingClasses}
          hint={
            classOptions.length === 0 && !loadingClasses
              ? 'No active classes — create one first, since the roll number comes from the class'
              : hasMore
                ? 'Showing the first 100 active classes'
                : 'The roll number is allocated from this class'
          }
        />
      )}

      <RHFTextField
        name="fatherName"
        control={control}
        label="Father's name"
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />

      <RHFTextField
        name="motherName"
        control={control}
        label="Mother's name"
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />

      <RHFTextField
        name="bloodGroup"
        control={control}
        label="Blood group"
        slotProps={{ htmlInput: { maxLength: 5 } }}
        hint="For example O+"
      />

      <RHFTextField
        name="address"
        control={control}
        label="Address"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />

      {!editing && (
        <>
          <RHFTextField
            name="password"
            control={control}
            label="Initial password"
            type="password"
            slotProps={{ htmlInput: { maxLength: 100 } }}
            hint={`Leave empty to use ${TEMP_PASSWORD}`}
          />
          <Alert severity="info">
            Whatever is set here, the student is asked to change it at their first sign-in.
            Their username is generated from their name and shown once the registration
            succeeds.
          </Alert>
        </>
      )}
    </FormDialog>
  )
}
