import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import Alert from '@mui/material/Alert'
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
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { useLoginMutation } from '../authApi'
import { sessionEstablished } from '../authSlice'
import { CHANGE_PASSWORD_PATH } from '../guards'

/**
 * Matches LoginRequestDTO: username required, password [6..50].
 *
 * Note this is looser than the change-password rules on purpose — the API accepts a
 * 6-character password at login but demands 8 with complexity when changing one, and
 * validating login against the stricter rule would lock out existing accounts.
 */
const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(50, 'Password cannot exceed 50 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

const FIELDS = ['username', 'password'] as const

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [login, { isLoading }] = useLoginMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  /** Where RequireAuth sent them from, so we can return them there. */
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname

  const onSubmit = async (values: LoginForm) => {
    setFormError(null)
    try {
      const session = await login(values).unwrap()
      dispatch(sessionEstablished(session))

      // Everyone created by an admin starts with Temp@123 and this flag set, so for
      // most users this is the expected destination, not an exception.
      if (session.requirePasswordChange) {
        navigate(CHANGE_PASSWORD_PATH, { replace: true })
        return
      }
      navigate(from ?? '/', { replace: true })
    } catch (error) {
      const unassigned = applyServerErrors<LoginForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Unable to sign in.'))
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ mb: 3, alignItems: 'center' }}>
            <SchoolRoundedIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h5">{import.meta.env.VITE_APP_NAME ?? 'School Management'}</Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to continue
            </Typography>
          </Stack>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {formError && <Alert severity="error">{formError}</Alert>}

              <TextField
                label="Username"
                autoComplete="username"
                autoFocus
                error={Boolean(errors.username)}
                helperText={errors.username?.message}
                {...register('username')}
              />

              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password')}
              />

              <Button type="submit" variant="contained" size="large" loading={isLoading}>
                Sign in
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
