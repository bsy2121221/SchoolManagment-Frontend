import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { ADDRESS_TYPES } from '@/types/enums'
import { toastSuccess } from '@/ui/uiSlice'
import { useUpdateUserMutation } from '../usersApi'
import type { UserRow } from '../types'

/**
 * Mirrors UserUpdateDTO plus its nested AddressDTO.
 *
 * **Edit only.** There is no create endpoint on this module: `UserCreateDTO` and
 * `sp_CreateUser` exist but nothing joins them, and accounts arrive through student, teacher
 * or parent registration or through `POST /schools/{id}/administrators`.
 *
 * The username is not here. It is allocated by the server at registration and no procedure
 * changes it -- correcting a name does not change how the person signs in.
 */
const schema = z
  .object({
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
    addressType: z.enum(ADDRESS_TYPES),
    addressLine1: z.string().trim().max(255, 'Address line 1 cannot exceed 255 characters'),
    addressLine2: z.string().trim().max(255, 'Address line 2 cannot exceed 255 characters'),
    city: z.string().trim().max(50, 'City cannot exceed 50 characters'),
    state: z.string().trim().max(50, 'State cannot exceed 50 characters'),
    country: z.string().trim().max(50, 'Country cannot exceed 50 characters'),
    postalCode: z.string().trim().max(20, 'Postal code cannot exceed 20 characters'),
  })
  // AddressLine1 is [Required] on AddressDTO, so the whole address object can only be sent
  // when line 1 has something in it. Filling a city and leaving line 1 empty would silently
  // drop the city rather than save it, so it is refused here instead.
  .refine(
    (values) =>
      values.addressLine1.trim() !== '' ||
      [values.addressLine2, values.city, values.state, values.country, values.postalCode].every(
        (part) => part.trim() === '',
      ),
    {
      path: ['addressLine1'],
      message: 'Address line 1 is required once any other address field is filled in',
    },
  )

type UserForm = z.input<typeof schema>

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'addressType',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'country',
  'postalCode',
] as const

const ADDRESS_TYPE_OPTIONS = ADDRESS_TYPES.map((type) => ({ value: type, label: type }))

/** Empty boxes mean "not recorded", which the API models as null rather than "". */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * What the dialog needs of a user in order to edit them. Narrower than `UserRow` so both the
 * list and the details screen pass their own object without converting.
 */
export type EditableUser = Pick<
  UserRow,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'username'
  | 'isActive'
  | 'addressType'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'country'
  | 'postalCode'
>

interface UserFormDialogProps {
  open: boolean
  /** The user being edited. Null closes the dialog; there is nothing to create. */
  editing: EditableUser | null
  onClose: () => void
}

export function UserFormDialog({ open, editing, onClose }: UserFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [updateUser, { isLoading: saving }] = useUpdateUserMutation()

  const { control, handleSubmit, reset, setError } = useForm<UserForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      addressType: 'Permanent',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
    },
  })

  // Re-seed on open: RHF keeps its values, so reopening after editing someone else would
  // show that person's details.
  useEffect(() => {
    if (!open || !editing) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset({
      firstName: editing.firstName,
      lastName: editing.lastName,
      email: editing.email,
      phoneNumber: editing.phoneNumber ?? '',
      // The stored type is free-ish text from the view; fall back rather than showing a
      // select with no valid selection.
      addressType:
        editing.addressType && (ADDRESS_TYPES as readonly string[]).includes(editing.addressType)
          ? (editing.addressType as UserForm['addressType'])
          : 'Permanent',
      addressLine1: editing.addressLine1 ?? '',
      addressLine2: editing.addressLine2 ?? '',
      city: editing.city ?? '',
      state: editing.state ?? '',
      country: editing.country ?? '',
      postalCode: editing.postalCode ?? '',
    })
  }, [open, editing, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!editing) return
    setFormError(null)

    const line1 = values.addressLine1.trim()

    try {
      await updateUser({
        userId: editing.id,
        body: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phoneNumber: orNull(values.phoneNumber),
          // `address` is the free-text alternative and is ignored whenever `addressDetails`
          // is present, so it is never sent from here.
          address: null,
          // All-null means "the address is not part of this edit". Sent only when line 1 has
          // a value; the remaining parts go as '' rather than null so that emptying a box
          // clears what is on file, which is what `sp_UpsertAddress` does with an empty
          // string and what the description below promises.
          addressDetails: line1
            ? {
                addressType: values.addressType,
                addressLine1: line1,
                addressLine2: values.addressLine2.trim(),
                city: values.city.trim(),
                state: values.state.trim(),
                country: values.country.trim(),
                postalCode: values.postalCode.trim(),
                isPrimary: true,
              }
            : null,
        },
      }).unwrap()

      dispatch(toastSuccess(`${values.firstName.trim()} ${values.lastName.trim()} updated.`))
      onClose()
    } catch (error) {
      // "Email already exists" and "User not found" are the two refusals, and until this
      // phase both arrived as "Failed to update user".
      const unassigned = applyServerErrors<UserForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save this account.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.firstName} ${editing.lastName}`.trim() : 'Edit account'}
      description={
        <Typography variant="body2" color="text.secondary">
          The name, email and phone are saved as entered — an empty box clears what is on file.
          The address is only written when line 1 has a value; leave it all blank and the
          address on record is left alone.
        </Typography>
      }
      error={formError}
      submitLabel="Save changes"
      busy={saving}
      onSubmit={onSubmit}
      onClose={onClose}
      maxWidth="md"
    >
      {editing && !editing.isActive && (
        <Alert severity="warning">
          This account is deactivated, and the server will refuse the edit with “User not found”
          — <code>sp_UpdateUser</code> only writes active accounts. Reactivate it first.
        </Alert>
      )}

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
        hint="Must be unique within the school"
      />

      <RHFTextField
        name="phoneNumber"
        control={control}
        label="Phone number"
        slotProps={{ htmlInput: { maxLength: 15 } }}
        hint="Optional"
      />

      <Divider>
        <Typography variant="caption" color="text.secondary">
          Address
        </Typography>
      </Divider>

      <RHFSelect
        name="addressType"
        control={control}
        label="Address type"
        options={ADDRESS_TYPE_OPTIONS}
        hint="The database allows these three"
      />

      <RHFTextField
        name="addressLine1"
        control={control}
        label="Address line 1"
        slotProps={{ htmlInput: { maxLength: 255 } }}
        hint="Required to save an address at all"
      />

      <RHFTextField
        name="addressLine2"
        control={control}
        label="Address line 2"
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />

      <RHFTextField
        name="city"
        control={control}
        label="City"
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />

      <RHFTextField
        name="state"
        control={control}
        label="State"
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />

      <RHFTextField
        name="country"
        control={control}
        label="Country"
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />

      <RHFTextField
        name="postalCode"
        control={control}
        label="Postal code"
        slotProps={{ htmlInput: { maxLength: 20 } }}
      />
    </FormDialog>
  )
}
