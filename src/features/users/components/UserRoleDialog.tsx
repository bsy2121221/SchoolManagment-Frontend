import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import { getErrorMessage } from '@/lib/serverErrors'
import { canChangeRole, useRoleLookup } from '@/features/roles/roleLookup'
import { toastSuccess } from '@/ui/uiSlice'
import { useChangeUserRoleMutation } from '../usersApi'
import type { UserRow } from '../types'

/**
 * `PUT /api/Users/{userId}/role`.
 *
 * A role change is an authorisation event rather than a profile edit, which is why it has its
 * own dialog and its own procedure: it revokes every live refresh token, because the user's
 * JWT carries the old role and the old permission grid until it expires.
 */
const schema = z.object({
  // A `select` hands back the option value as a string, and `RHFSelect` turns the blank
  // entry into null -- so all three shapes have to be accepted and narrowed on submit.
  roleId: z.union([z.string(), z.number(), z.null()]).default(null),
})

type RoleForm = z.input<typeof schema>

interface UserRoleDialogProps {
  open: boolean
  user: Pick<UserRow, 'id' | 'firstName' | 'lastName' | 'username' | 'roleId' | 'role'> | null
  onClose: () => void
}

export function UserRoleDialog({ open, user, onClose }: UserRoleDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  // Only fetched while the dialog is open: the caller needs `Roles:View`, which the seeded
  // Admin role holds, but there is no reason to spend the request on a closed dialog.
  const { assignableOptions, isLoading: loadingRoles } = useRoleLookup({ skip: !open })

  const [changeRole, { isLoading: saving }] = useChangeUserRoleMutation()

  const { control, handleSubmit, reset, setError } = useForm<RoleForm>({
    resolver: zodResolver(schema),
    defaultValues: { roleId: null },
  })

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset({ roleId: null })
  }, [open, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    setFormError(null)

    if (values.roleId === null || values.roleId === '') {
      setError('roleId', { type: 'manual', message: 'Choose the role to move them into' })
      return
    }

    try {
      await changeRole({ userId: user.id, roleId: Number(values.roleId) }).unwrap()
      dispatch(
        toastSuccess(
          `${user.username} moved out of ${user.role}. They will be signed out and have to sign in again.`,
        ),
      )
      onClose()
    } catch (error) {
      // Four refusals, two of which the options list already prevents. The remaining two --
      // "not found in this school" and the students/teachers/parents rule -- name their own
      // remedy, so the message is shown as it arrives.
      setFormError(getErrorMessage(error, 'Could not change the role.'))
    }
  })

  const movable = user ? canChangeRole(user) : true

  return (
    <FormDialog
      open={open}
      title={user ? `Change ${user.username}’s role` : 'Change role'}
      description={
        <Typography variant="body2" color="text.secondary">
          Currently <strong>{user?.role}</strong>. Changing it revokes their signed-in sessions,
          so they will be asked to sign in again and will get the new role’s permissions when
          they do.
        </Typography>
      }
      error={formError}
      submitLabel="Change role"
      busy={saving}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      {!movable && (
        <Alert severity="warning">
          Students, teachers and parents cannot be reassigned: their role comes from the record
          that owns them, not from this row. The server will refuse this. Deactivate the account
          and register the person in their new capacity instead.
        </Alert>
      )}

      <RHFSelect
        name="roleId"
        control={control}
        label="New role"
        required
        options={assignableOptions}
        loadingOptions={loadingRoles}
        hint="SuperAdmin is not offered, and neither are Teacher, Student or Parent — those accounts are created by their own registration, not by a role change"
      />

      <Alert severity="info">
        Only the login’s role changes. Nothing else about the account is touched, and no
        role-specific record is created — an account promoted to Admin gets the Admin permission
        grid and nothing more.
      </Alert>
    </FormDialog>
  )
}
