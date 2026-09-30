import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { PASSWORD_PATTERN } from '@/types/enums'
import { useChangePasswordMutation } from '../authApi'
import { passwordChangeSatisfied } from '../authSlice'
import { selectMustChangePassword } from '../permissions'

/**
 * Mirrors ChangePasswordRequestDTO exactly, including its regex — validating client
 * side with looser rules would just move the rejection to the server round trip.
 */
const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(
        PASSWORD_PATTERN,
        'Use upper and lower case, a number, and one of @ $ ! % * ? &',
      ),
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'The new password must differ from the current one',
  })

type ChangePasswordForm = z.infer<typeof schema>

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

export default function ChangePasswordPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const forced = useAppSelector(selectMustChangePassword)
  const [changePassword, { isLoading }] = useChangePasswordMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async (values: ChangePasswordForm) => {
    setFormError(null)
    try {
      await changePassword(values).unwrap()

      // The endpoint returns no new token and the JWT carries no such claim, so the
      // client is the only place the forced-change gate can be lifted.
      dispatch(passwordChangeSatisfied())
      dispatch(toastSuccess('Password changed.'))
      navigate('/', { replace: true })
    } catch (error) {
      const unassigned = applyServerErrors<ChangePasswordForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not change the password.'))
    }
  }

  return (
    <Box
      sx={{
        minHeight: forced ? '100vh' : undefined,
        display: 'grid',
        placeItems: 'center',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 480, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            {forced ? 'Set a new password' : 'Change password'}
          </Typography>

          {forced ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>A new password is required</AlertTitle>
              Your account was created with a temporary password. Choose your own before
              continuing.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a password with at least 8 characters, mixed case, a number and a
              symbol.
            </Typography>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {formError && <Alert severity="error">{formError}</Alert>}

              <TextField
                label={forced ? 'Temporary password' : 'Current password'}
                type="password"
                autoComplete="current-password"
                autoFocus
                error={Boolean(errors.currentPassword)}
                helperText={errors.currentPassword?.message}
                {...register('currentPassword')}
              />

              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                error={Boolean(errors.newPassword)}
                helperText={errors.newPassword?.message}
                {...register('newPassword')}
              />

              <TextField
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              <Button type="submit" variant="contained" size="large" loading={isLoading}>
                Update password
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
