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
import { useRegisterParentMutation, useUpdateParentMutation } from '../parentsApi'
import type { ParentRegistrationResult, ParentRow } from '../types'

/**
 * Mirrors ParentRegistrationDTO and ParentUpdateDTO, which differ by one optional field --
 * the registration DTO's `password` -- so one form serves both modes.
 *
 * Two things are deliberately **not** here:
 *
 *  - No password. `ParentRegistrationDTO` does carry one, and `ParentService` honours it,
 *    but a password chosen by an admin is a password that has to be told to the parent
 *    somehow; the shared temporary one is already known and the account is flagged to
 *    change it. Offering the box invites the worse of the two.
 *  - No children. Linking a student needs a relationship per child, so it belongs on the
 *    profile where the current links are visible, not folded into a details form.
 *
 * `sp_UpdateParent` writes every column it is given, so an empty box clears what is on
 * file. That is worth spelling out for the phone number in particular: the procedure sets
 * it explicitly rather than through `sp_UpsertPerson`, which treats null as "leave alone",
 * so clearing it here genuinely clears it.
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
  occupation: z.string().trim().max(100, 'Occupation cannot exceed 100 characters'),
  // '' has to stay distinguishable from 0: an income nobody recorded is not an income of
  // nothing, and the column is nullable for that reason.
  annualIncome: z
    .union([z.literal(''), z.number()])
    .refine((value) => value === '' || value >= 0, 'Annual income cannot be negative')
    .refine(
      (value) => value === '' || value <= 99999999.99,
      'Annual income cannot exceed 99,999,999.99',
    ),
})

type ParentForm = z.input<typeof schema>

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'address',
  'occupation',
  'annualIncome',
] as const

const EMPTY: ParentForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  address: '',
  occupation: '',
  annualIncome: '',
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
 * What the dialog needs of a parent in order to edit them -- the editable columns plus both
 * ids. Narrower than `ParentRow` on purpose: `ParentProfile` satisfies this too, so the
 * list and the profile open the same dialog without one converting to the other's shape.
 */
export type EditableParent = Pick<
  ParentRow,
  | 'id'
  | 'userId'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'address'
  | 'occupation'
  | 'annualIncome'
>

interface ParentFormDialogProps {
  open: boolean
  /** The parent being edited, or null to register one. */
  editing: EditableParent | null
  onClose: () => void
  /** Called after a successful registration -- lets the caller open the new profile. */
  onRegistered?: (result: ParentRegistrationResult) => void
}

export function ParentFormDialog({
  open,
  editing,
  onClose,
  onRegistered,
}: ParentFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [registerParent, { isLoading: registering }] = useRegisterParentMutation()
  const [updateParent, { isLoading: updating }] = useUpdateParentMutation()

  const { control, handleSubmit, reset, setError } = useForm<ParentForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Re-seed on open: RHF keeps its values, so reopening after editing another parent would
  // show that parent's details.
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
            occupation: editing.occupation ?? '',
            annualIncome: editing.annualIncome ?? '',
          }
        : EMPTY,
    )
  }, [open, editing, reset])

  const busy = registering || updating

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const body = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phoneNumber: orNull(values.phoneNumber),
      address: orNull(values.address),
      occupation: orNull(values.occupation),
      annualIncome: numberOrNull(values.annualIncome),
    }

    try {
      if (editing) {
        await updateParent({ parentId: editing.id, userId: editing.userId, body }).unwrap()
        dispatch(toastSuccess(`${body.firstName} ${body.lastName} updated.`))
        onClose()
        return
      }

      const result = await registerParent(body).unwrap()

      // The username is allocated server-side and is the thing the admin has to pass on, so
      // it goes in the message.
      dispatch(
        toastSuccess(
          `${body.firstName} ${body.lastName} registered as ${result.username}.`,
        ),
      )
      onRegistered?.(result)
      onClose()
    } catch (error) {
      // "Email already exists" and "Generated username already exists" both arrive here,
      // and each tells the admin what to change.
      const unassigned = applyServerErrors<ParentForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save the parent.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : 'Register a parent'}
      description={
        <Typography variant="body2" color="text.secondary">
          {editing
            ? 'Everything here is saved as entered — a box left empty clears what is on file for it. Which children they are attached to is separate, and is not touched by this form.'
            : 'Registering a parent creates their login as well as their record. The username is allocated by the server; attaching them to their children is the next step.'}
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Register parent'}
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
        hint="Optional, but it is usually the only way the school reaches a parent"
      />

      <RHFTextField
        name="occupation"
        control={control}
        label="Occupation"
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint="Optional"
      />

      <RHFTextField
        name="annualIncome"
        control={control}
        label="Annual income"
        type="number"
        numeric
        slotProps={{ htmlInput: { min: 0, max: 99999999.99, step: 0.01 } }}
        hint="Optional, up to 99,999,999.99. Leave empty if it is not recorded — that is not the same as zero"
      />

      <RHFTextField
        name="address"
        control={control}
        label="Address"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 255 } }}
        hint="The home address on file for the family"
      />

      {!editing && (
        <Alert severity="info">
          The account is created with the password {TEMP_PASSWORD} and the parent is asked to
          change it at their first sign-in. Until they are attached to a child they can sign in
          but will see nothing.
        </Alert>
      )}
    </FormDialog>
  )
}
