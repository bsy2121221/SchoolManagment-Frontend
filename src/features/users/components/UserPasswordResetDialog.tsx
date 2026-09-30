import Alert from '@mui/material/Alert'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { PASSWORD_PATTERN } from '@/types/enums'
import { toastSuccess } from '@/ui/uiSlice'
import { useResetUserPasswordMutation } from '../usersApi'
import type { UserRow } from '../types'

/**
 * `POST /api/Auth/reset-password`, mirroring ResetPasswordRequestDTO including its regex.
 *
 * This is the admin reset, not the self-service change: there is no current password, because
 * an admin doing this does not know it. That is also why it is gated on the **role** --
 * `[Authorize(Roles = "Admin,SuperAdmin")]` -- rather than on `Users:Edit`, so a custom role
 * holding every Users flag still cannot reach it.
 */
const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(PASSWORD_PATTERN, 'Use upper and lower case, a number, and one of @ $ ! % * ? &'),
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
    requirePasswordChange: z.boolean(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type ResetForm = z.input<typeof schema>

// `confirmPassword` is ours, not the DTO's, so it can never come back as a server error --
// but it is listed so a mis-mapped field name lands on the right box rather than at form level.
const FIELDS = ['newPassword', 'confirmPassword'] as const

interface UserPasswordResetDialogProps {
  open: boolean
  user: Pick<UserRow, 'id' | 'username' | 'firstName' | 'lastName'> | null
  onClose: () => void
}

export function UserPasswordResetDialog({ open, user, onClose }: UserPasswordResetDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [resetPassword, { isLoading: saving }] = useResetUserPasswordMutation()

  const { control, handleSubmit, reset, setError } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '', requirePasswordChange: true },
  })

  // Re-seed on open so a password typed for one user cannot be submitted against another.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset({ newPassword: '', confirmPassword: '', requirePasswordChange: true })
  }, [open, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    setFormError(null)

    try {
      await resetPassword({
        userId: user.id,
        newPassword: values.newPassword,
        requirePasswordChange: values.requirePasswordChange,
      }).unwrap()

      dispatch(
        toastSuccess(
          `Password reset for ${user.username}. Pass it on to them — it is not shown again.`,
        ),
      )
      onClose()
    } catch (error) {
      const unassigned = applyServerErrors<ResetForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not reset the password.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={user ? `Reset ${user.username}’s password` : 'Reset password'}
      description={
        <Typography variant="body2" color="text.secondary">
          Sets a password for{' '}
          <strong>{user ? `${user.firstName} ${user.lastName}`.trim() || user.username : ''}</strong>
          . You will have to pass it on to them yourself — the API does not email it, and this
          dialog does not show it again once it closes. Their signed-in sessions are revoked, so
          anyone using the account is signed out immediately.
        </Typography>
      }
      error={formError}
      submitLabel="Reset password"
      busy={saving}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="newPassword"
        control={control}
        label="New password"
        type="password"
        required
        autoFocus
        autoComplete="new-password"
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint="At least 8 characters, with upper and lower case, a number, and one of @ $ ! % * ? &"
      />

      <RHFTextField
        name="confirmPassword"
        control={control}
        label="Confirm new password"
        type="password"
        required
        autoComplete="new-password"
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />

      <Controller
        name="requirePasswordChange"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
            label="Make them choose their own at next sign-in"
          />
        )}
      />

      <Alert severity="info">
        Leaving that on is the safer default: the user lands on the change-password screen and
        cannot go anywhere else until they have set a password only they know. Turn it off only
        when you are setting a password they have chosen themselves.
      </Alert>
    </FormDialog>
  )
}
