import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useCreateSchoolAdminMutation } from '../schoolsApi'
import type { School, SchoolAdminResult } from '../types'
import { CredentialsHandoff } from './CredentialsHandoff'

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} cannot exceed ${max} characters`)

/** Mirrors SchoolAdminCreateDTO. */
const schema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .max(100, 'Email cannot exceed 100 characters')
      .refine((v) => EMAIL_RE.test(v), 'Enter a valid email address'),
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
    phoneNumber: optionalText(15, 'Phone number'),
    username: optionalText(80, 'Username'),
    setPassword: z.boolean(),
    password: optionalText(100, 'Password'),
  })
  .superRefine((values, ctx) => {
    if (values.setPassword && values.password.trim().length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password must be at least 8 characters',
      })
    }
  })

type AdminForm = z.input<typeof schema>

const FIELDS = ['email', 'firstName', 'lastName', 'phoneNumber', 'username', 'password'] as const

const EMPTY: AdminForm = {
  email: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  username: '',
  setPassword: false,
  password: '',
}

interface SchoolAdminDialogProps {
  open: boolean
  school: School
  onClose: () => void
}

/**
 * Adds a further administrator to an existing school: `POST /api/Schools/{id}/admins`.
 * The *first* admin comes with the school itself, from the onboarding wizard.
 *
 * Needs `Schools:Create`, which the seeded Admin role does **not** hold — so despite
 * the endpoint having no role guard, in practice only a platform administrator can do
 * this. A school that needs a second admin has to ask.
 *
 * As with onboarding, the username is generated (`CODE_ADMIN2`, `CODE_ADMIN3`, ...)
 * and returned only here, so the dialog ends on the credentials rather than closing.
 */
export function SchoolAdminDialog({ open, school, onClose }: SchoolAdminDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<SchoolAdminResult | null>(null)
  const [createAdmin, { isLoading }] = useCreateSchoolAdminMutation()

  const { control, handleSubmit, reset, setError } = useForm<AdminForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Reset on the way in, not on the way out: clearing `created` on close would make the
  // credentials panel vanish and the empty form flash back during the exit transition.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    setCreated(null)
    reset(EMPTY)
  }, [open, reset])

  // Subscribes to the switch alone, so toggling it swaps the password field in without
  // the whole form re-rendering through a watch() closure.
  const setPassword = useWatch({ control, name: 'setPassword' })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const result = await createAdmin({
        schoolId: school.id,
        body: {
          email: values.email.trim(),
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          phoneNumber: values.phoneNumber.trim() || null,
          username: values.username.trim() || null,
          // '' would fail the server's minimum length; null means "use the default".
          password: values.setPassword ? values.password.trim() || null : null,
        },
      }).unwrap()

      dispatch(toastSuccess(`Administrator added to ${school.schoolName}.`))
      setCreated(result)
    } catch (error) {
      const unassigned = applyServerErrors<AdminForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not create the administrator.'))
    }
  })

  if (created) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Administrator added</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This account has the same rights over {school.schoolName} as its first
              administrator.
            </Typography>
            <CredentialsHandoff
              username={created.username}
              requiresPasswordChange={created.requiresPasswordChange}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <FormDialog
      open={open}
      title={`Add an administrator to ${school.schoolName}`}
      error={formError}
      submitLabel="Create administrator"
      busy={isLoading}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="email"
        control={control}
        label="Email"
        type="email"
        required
        autoFocus
        slotProps={{ htmlInput: { maxLength: 100 } }}
        hint="Must be unique across the platform"
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <RHFTextField
          name="firstName"
          control={control}
          label="First name"
          required
          fullWidth
          slotProps={{ htmlInput: { maxLength: 50 } }}
        />
        <RHFTextField
          name="lastName"
          control={control}
          label="Last name"
          required
          fullWidth
          slotProps={{ htmlInput: { maxLength: 50 } }}
        />
      </Stack>

      <RHFTextField
        name="phoneNumber"
        control={control}
        label="Phone number"
        slotProps={{ htmlInput: { maxLength: 15 } }}
      />

      <RHFTextField
        name="username"
        control={control}
        label="Username"
        slotProps={{ htmlInput: { maxLength: 80 } }}
        hint={`Optional. Left blank, the next free ${school.schoolCode}_ADMIN2, _ADMIN3 … is used. Anything supplied is sanitised and prefixed with the school code if it is missing one.`}
      />

      <Divider />

      <Controller
        name="setPassword"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Switch
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            }
            label="Set a password now"
          />
        )}
      />

      {setPassword ? (
        <RHFTextField
          name="password"
          control={control}
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          slotProps={{ htmlInput: { maxLength: 100 } }}
          hint="At least 8 characters. The account will not be asked to change it."
        />
      ) : (
        <Alert severity="success">
          The account gets the shared temporary password and must change it at first
          login. Both are shown once it exists.
        </Alert>
      )}
    </FormDialog>
  )
}
