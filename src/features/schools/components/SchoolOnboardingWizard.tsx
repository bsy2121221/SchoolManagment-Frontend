import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { Path } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { RHFSelect } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useCreateSchoolMutation } from '../schoolsApi'
import {
  MONTH_OPTIONS,
  SCHOOL_CODE_RAW_MAX,
  SCHOOL_CODE_SANITISED,
  firstAdminUsername,
  sanitiseSchoolCode,
} from '../types'
import type { SchoolCreatePayload, SchoolCreateResult } from '../types'
import { CredentialsHandoff } from './CredentialsHandoff'

/**
 * `[EmailAddress]` in .NET is laxer than most client-side email regexes -- it does not
 * require a dot in the domain, so `admin@localhost` passes server-side. Matching that
 * rather than tightening it keeps the client from rejecting what the API accepts.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/

/** `[RegularExpression]` on SchoolCreateDTO.Subdomain, mirroring CK_Schools_Subdomain. */
const SUBDOMAIN_RE = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/

/** `[RegularExpression]` on ThemeColor. */
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

/** An optional free-text field: blank is allowed, length is the server's. */
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} cannot exceed ${max} characters`)

/**
 * Mirrors SchoolCreateDTO's DataAnnotations field for field.
 *
 * Two rules are *not* plain annotations and are reproduced deliberately:
 *   - the school code is capped at 12 characters **as typed** (the procedure's
 *     parameter is NVARCHAR(12) and truncates before sanitising), and separately at
 *     3-12 characters **once sanitised**, which is what SchoolService checks;
 *   - the admin password is only checked when the operator chose to set one.
 */
const schema = z
  .object({
    schoolCode: z
      .string()
      .trim()
      .min(1, 'School code is required')
      .max(
        SCHOOL_CODE_RAW_MAX,
        `School code cannot exceed ${SCHOOL_CODE_RAW_MAX} characters, counting spaces and punctuation that will be stripped from it`,
      )
      .refine(
        (raw) => sanitiseSchoolCode(raw).length >= SCHOOL_CODE_SANITISED.min,
        `Needs at least ${SCHOOL_CODE_SANITISED.min} letters or digits once punctuation is removed`,
      ),
    schoolName: z
      .string()
      .trim()
      .min(1, 'School name is required')
      .max(150, 'School name cannot exceed 150 characters'),
    subdomain: optionalText(63, 'Subdomain')
      .refine((v) => v === '' || v.length >= 2, 'Subdomain must be at least 2 characters')
      .refine(
        (v) => v === '' || SUBDOMAIN_RE.test(v),
        'Only letters, digits and hyphens, and it cannot start or end with a hyphen',
      ),
    academicYearStartMonth: z.coerce
      .number()
      .int()
      .min(1, 'Pick a month')
      .max(12, 'Pick a month'),

    address: optionalText(255, 'Address'),
    city: optionalText(80, 'City'),
    state: optionalText(80, 'State'),
    country: optionalText(80, 'Country'),
    postalCode: optionalText(20, 'Postal code'),
    contactEmail: optionalText(100, 'Contact email').refine(
      (v) => v === '' || EMAIL_RE.test(v),
      'Enter a valid email address',
    ),
    contactPhone: optionalText(20, 'Contact phone'),
    principalName: optionalText(100, 'Principal name'),

    adminEmail: z
      .string()
      .trim()
      .min(1, 'Admin email is required')
      .max(100, 'Admin email cannot exceed 100 characters')
      .refine((v) => EMAIL_RE.test(v), 'Enter a valid email address'),
    adminFirstName: z
      .string()
      .trim()
      .min(1, 'First name is required')
      .max(50, 'First name cannot exceed 50 characters'),
    adminLastName: z
      .string()
      .trim()
      .min(1, 'Last name is required')
      .max(50, 'Last name cannot exceed 50 characters'),
    adminPhoneNumber: optionalText(15, 'Phone number'),
    /** Client-only: whether to set a password instead of using the temporary one. */
    setPassword: z.boolean(),
    adminPassword: optionalText(100, 'Password'),

    themeColor: z
      .string()
      .trim()
      .min(1, 'Theme colour is required')
      .refine((v) => HEX_COLOR_RE.test(v), 'Must be a hex colour such as #1976d2'),
    logoUrl: optionalText(500, 'Logo URL'),
    seedSubjects: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.setPassword && values.adminPassword.trim().length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['adminPassword'],
        message: 'Password must be at least 8 characters',
      })
    }
  })

type OnboardingForm = z.input<typeof schema>

const EMPTY: OnboardingForm = {
  schoolCode: '',
  schoolName: '',
  subdomain: '',
  // Constants default: the Indian academic year starts in April.
  academicYearStartMonth: 4,
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  contactEmail: '',
  contactPhone: '',
  principalName: '',
  adminEmail: '',
  // SchoolCreateDTO's own defaults, so an operator who fills in nothing here sends
  // exactly what the API would have defaulted to anyway.
  adminFirstName: 'School',
  adminLastName: 'Admin',
  adminPhoneNumber: '',
  setPassword: false,
  adminPassword: '',
  themeColor: '#1976d2',
  logoUrl: '',
  seedSubjects: true,
}

const STEPS = [
  { label: 'School', caption: 'Identity and academic year' },
  { label: 'Contact', caption: 'Address and who to reach' },
  { label: 'Administrator', caption: 'The first account' },
  { label: 'Setup', caption: 'Branding and starter data' },
] as const

/**
 * Which fields each step owns, so `trigger` validates only the step being left. Without
 * this, step 1 would immediately report the admin email as missing.
 */
const STEP_FIELDS: ReadonlyArray<ReadonlyArray<Path<OnboardingForm>>> = [
  ['schoolCode', 'schoolName', 'subdomain', 'academicYearStartMonth'],
  ['address', 'city', 'state', 'country', 'postalCode', 'contactEmail', 'contactPhone', 'principalName'],
  ['adminEmail', 'adminFirstName', 'adminLastName', 'adminPhoneNumber', 'adminPassword'],
  ['themeColor', 'logoUrl'],
]

/** Every server-validatable field, for routing `errors[]` back onto inputs. */
const ALL_FIELDS = STEP_FIELDS.flat()

/** '' means "not supplied" in this form; the API wants null for an absent value. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

interface SchoolOnboardingWizardProps {
  open: boolean
  onClose: () => void
  /** Called with the new school's id when the operator asks to open it. */
  onOpenSchool?: (schoolId: number) => void
}

/**
 * Onboards a tenant: `POST /api/Schools`, which in one transaction creates the school,
 * its first admin, the number sequences, the default fee types, the default settings
 * and (optionally) a starter subject list for grades 1-12.
 *
 * A wizard rather than one long form because the twenty fields fall into four
 * genuinely different decisions, and because the first step's consequences are
 * irreversible in a way the others are not -- the school code is embedded in every
 * username and admission number the school will ever issue, and cannot be edited
 * afterwards. That deserves its own screen with the derived values shown.
 *
 * The flow does not end at "created". It ends at the credentials, because the admin's
 * username is generated server-side and this response is the only place it appears.
 */
export function SchoolOnboardingWizard({
  open,
  onClose,
  onOpenSchool,
}: SchoolOnboardingWizardProps) {
  const dispatch = useAppDispatch()
  const [createSchool, { isLoading }] = useCreateSchoolMutation()

  const [step, setStep] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  /** Non-null once the school exists: the wizard becomes a handoff screen. */
  const [created, setCreated] = useState<SchoolCreateResult | null>(null)

  const { control, handleSubmit, reset, setError, trigger, getValues } =
    useForm<OnboardingForm>({
      resolver: zodResolver(schema),
      defaultValues: EMPTY,
      mode: 'onTouched',
    })

  // Reopening must start clean: a half-filled tenant from a cancelled attempt is the
  // last thing that should be submitted by accident. Reset on the way in rather than on
  // close, which would rewind the wizard to step one during its exit transition and blank
  // the credentials the operator is still reading.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setStep(0)
    setFormError(null)
    setCreated(null)
    reset(EMPTY)
  }, [open, reset])

  /**
   * The fields this wizard reads outside their own inputs: the code drives the derived
   * username panel, the switch decides whether a password field exists at all, and the
   * last three feed the review summary and the colour swatch.
   *
   * `useWatch` rather than `watch(...)`: it subscribes to one field and returns its
   * value, where `watch` hands back a function the React Compiler cannot memoize.
   */
  const rawCode = useWatch({ control, name: 'schoolCode' })
  const setPassword = useWatch({ control, name: 'setPassword' })
  const themeColor = useWatch({ control, name: 'themeColor' })
  const schoolName = useWatch({ control, name: 'schoolName' })
  const adminEmail = useWatch({ control, name: 'adminEmail' })

  const sanitisedCode = sanitiseSchoolCode(rawCode)
  const codeWillChange = sanitisedCode !== rawCode && rawCode.trim() !== ''

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const payload: SchoolCreatePayload = {
      // Sent as typed: the procedure sanitises it, and sending our own sanitised
      // version would hide a mismatch rather than surface one.
      schoolCode: values.schoolCode.trim(),
      schoolName: values.schoolName.trim(),
      subdomain: orNull(values.subdomain),
      address: orNull(values.address),
      city: orNull(values.city),
      state: orNull(values.state),
      country: orNull(values.country),
      postalCode: orNull(values.postalCode),
      contactEmail: orNull(values.contactEmail),
      contactPhone: orNull(values.contactPhone),
      principalName: orNull(values.principalName),
      logoUrl: orNull(values.logoUrl),
      themeColor: values.themeColor.trim(),
      academicYearStartMonth: Number(values.academicYearStartMonth),
      adminEmail: values.adminEmail.trim(),
      adminFirstName: values.adminFirstName.trim(),
      adminLastName: values.adminLastName.trim(),
      adminPhoneNumber: orNull(values.adminPhoneNumber),
      // Null, not '', when the operator kept the temporary password -- an empty string
      // would fail the server's [StringLength(MinimumLength = 8)] instead of meaning
      // "use the default".
      adminPassword: values.setPassword ? orNull(values.adminPassword) : null,
      seedSubjects: values.seedSubjects,
    }

    try {
      const result = await createSchool(payload).unwrap()
      dispatch(toastSuccess(`${payload.schoolName} onboarded.`))
      setCreated(result)
    } catch (error) {
      // Duplicate school code and duplicate subdomain both land here, and both belong
      // on step 1 -- so jump back rather than showing an error next to the logo URL.
      const unassigned = applyServerErrors<OnboardingForm>(error, setError, ALL_FIELDS)
      const message = unassigned[0] ?? getErrorMessage(error, 'Could not create the school.')
      setFormError(message)
      if (/code|subdomain/i.test(message)) setStep(0)
    }
  })

  /* ------------------------------------------------------------------------ */
  /* Done: the credentials handoff                                             */
  /* ------------------------------------------------------------------------ */

  if (created) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{getValues('schoolName')} is ready</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              The school, its first administrator, the admission-number sequences, the
              default fee types and the default settings were all created together.
              {getValues('seedSubjects')
                ? ' A starter subject list was written for grades 1 to 12.'
                : ' No subjects were seeded, so the school starts with an empty subject list.'}
            </Typography>

            <CredentialsHandoff
              schoolCode={created.schoolCode}
              username={created.adminUsername}
              requiresPasswordChange={created.requiresPasswordChange}
            />

            <Typography variant="body2" color="text.secondary">
              From here the school's own administrator signs in and takes over: students,
              teachers, classes, subjects and fees are all theirs to manage.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Close</Button>
          {onOpenSchool && (
            <Button
              variant="contained"
              onClick={() => {
                onOpenSchool(created.schoolId)
                onClose()
              }}
            >
              Open school
            </Button>
          )}
        </DialogActions>
      </Dialog>
    )
  }

  /* ------------------------------------------------------------------------ */
  /* The form                                                                  */
  /* ------------------------------------------------------------------------ */

  const isLastStep = step === STEPS.length - 1

  return (
    <Dialog
      open={open}
      // Closing mid-flight would leave the operator unsure whether a tenant exists.
      onClose={isLoading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      keepMounted={false}
    >
      <DialogTitle sx={{ pb: 1 }}>Onboard a school</DialogTitle>

      <Box sx={{ px: 3, pb: 1 }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((s) => (
            <Step key={s.label}>
              <StepLabel optional={<Typography variant="caption">{s.caption}</Typography>}>
                {s.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <form
        onSubmit={(event) => {
          // Enter anywhere in the form would otherwise submit from step 1.
          if (!isLastStep) {
            event.preventDefault()
            void goNext()
            return
          }
          void onSubmit(event)
        }}
        noValidate
      >
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            {step === 0 && (
              <>
                <RHFTextField
                  name="schoolCode"
                  control={control}
                  label="School code"
                  required
                  autoFocus
                  slotProps={{ htmlInput: { maxLength: SCHOOL_CODE_RAW_MAX } }}
                  hint="Permanent. It prefixes every username and admission number the school issues."
                />

                {/* The stored code is not what was typed, and the admin username is
                    derived from it -- so both are shown before anything is committed. */}
                {sanitisedCode.length >= SCHOOL_CODE_SANITISED.min && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary">
                        Will be stored as
                      </Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {sanitisedCode}
                      </Typography>
                      <Divider />
                      <Typography variant="caption" color="text.secondary">
                        The first administrator's username, generated and not editable
                      </Typography>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {firstAdminUsername(sanitisedCode)}
                      </Typography>
                      {codeWillChange && (
                        <Typography variant="caption" color="warning.main">
                          Spaces, punctuation and lower case are stripped, so “{rawCode.trim()}”
                          becomes “{sanitisedCode}”.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                )}

                <RHFTextField
                  name="schoolName"
                  control={control}
                  label="School name"
                  required
                  slotProps={{ htmlInput: { maxLength: 150 } }}
                  hint="The full name, as it should appear to the school's own users"
                />

                <RHFTextField
                  name="subdomain"
                  control={control}
                  label="Subdomain"
                  slotProps={{ htmlInput: { maxLength: 63 } }}
                  hint="Optional, and unique across the platform. It is what resolves a host like dps.example.com to this school."
                />

                <RHFSelect
                  name="academicYearStartMonth"
                  control={control}
                  label="Academic year starts in"
                  options={MONTH_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
                  hint="Decides which calendar months belong to a session"
                />
              </>
            )}

            {step === 1 && (
              <>
                <Typography variant="body2" color="text.secondary">
                  All optional — the school's own administrator can fill these in later.
                  They appear on receipts and reports.
                </Typography>

                <RHFTextField
                  name="principalName"
                  control={control}
                  label="Principal"
                  autoFocus
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />

                <RHFTextField
                  name="address"
                  control={control}
                  label="Address"
                  multiline
                  minRows={2}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <RHFTextField
                    name="city"
                    control={control}
                    label="City"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                    hint="Searchable in the school list"
                  />
                  <RHFTextField
                    name="state"
                    control={control}
                    label="State"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <RHFTextField
                    name="country"
                    control={control}
                    label="Country"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                  />
                  <RHFTextField
                    name="postalCode"
                    control={control}
                    label="Postal code"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 20 } }}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <RHFTextField
                    name="contactEmail"
                    control={control}
                    label="Contact email"
                    type="email"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    hint="The school's public address, not the administrator's"
                  />
                  <RHFTextField
                    name="contactPhone"
                    control={control}
                    label="Contact phone"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 20 } }}
                  />
                </Stack>
              </>
            )}

            {step === 2 && (
              <>
                <Alert severity="info">
                  This account is how the school starts running itself. Once it signs in,
                  its administrator adds the teachers, students, parents and classes —
                  none of which are created here.
                </Alert>

                <RHFTextField
                  name="adminEmail"
                  control={control}
                  label="Administrator email"
                  type="email"
                  required
                  autoFocus
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  hint="Must be unique across the platform"
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <RHFTextField
                    name="adminFirstName"
                    control={control}
                    label="First name"
                    required
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 50 } }}
                  />
                  <RHFTextField
                    name="adminLastName"
                    control={control}
                    label="Last name"
                    required
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 50 } }}
                  />
                </Stack>

                <RHFTextField
                  name="adminPhoneNumber"
                  control={control}
                  label="Phone number"
                  slotProps={{ htmlInput: { maxLength: 15 } }}
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
                  <>
                    <RHFTextField
                      name="adminPassword"
                      control={control}
                      label="Password"
                      type="password"
                      required
                      autoComplete="new-password"
                      slotProps={{ htmlInput: { maxLength: 100 } }}
                      hint="At least 8 characters. The account will not be asked to change it."
                    />
                    <Alert severity="warning">
                      A password typed here has passed through whoever filled this form
                      in, and the account is not forced to change it. The temporary
                      password is usually the better choice.
                    </Alert>
                  </>
                ) : (
                  <Alert severity="success">
                    The account gets the shared temporary password and must change it at
                    first login. You will be shown both after the school is created.
                  </Alert>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <RHFTextField
                    name="themeColor"
                    control={control}
                    label="Theme colour"
                    required
                    autoFocus
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 20 } }}
                    hint="Hex, such as #1976d2. Used to brand the school's login page."
                  />
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      flexShrink: 0,
                      mt: 0.5,
                      // An invalid hex simply renders nothing rather than throwing.
                      bgcolor: themeColor,
                    }}
                  />
                </Stack>

                <RHFTextField
                  name="logoUrl"
                  control={control}
                  label="Logo URL"
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  hint="Optional. The API stores a URL; it does not host uploads for schools."
                />

                <Divider />

                <Controller
                  name="seedSubjects"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(event) => field.onChange(event.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">Seed a starter subject list</Typography>
                          <Typography variant="caption" color="text.secondary">
                            English, Maths, Science, Social Studies, Hindi and Computer
                            Science, for grades 1 to 12. Turn this off for a school that
                            will import its own.
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start' }}
                    />
                  )}
                />

                <Divider />

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <AutoAwesomeIcon fontSize="small" color="primary" />
                      <Typography variant="subtitle2">About to create</Typography>
                    </Stack>
                    <ReviewRow label="School" value={schoolName || '—'} />
                    <ReviewRow label="Code" value={sanitisedCode || '—'} mono />
                    <ReviewRow
                      label="Admin username"
                      value={sanitisedCode ? firstAdminUsername(sanitisedCode) : '—'}
                      mono
                    />
                    <ReviewRow label="Admin email" value={adminEmail || '—'} />
                    <ReviewRow
                      label="Password"
                      value={setPassword ? 'Set by you' : 'Temporary, must be changed'}
                    />
                  </Stack>
                </Paper>
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Box sx={{ flex: 1 }} />
          {step > 0 && (
            <Button onClick={() => setStep((c) => c - 1)} disabled={isLoading}>
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button type="submit" variant="contained" loading={isLoading}>
              Create school
            </Button>
          ) : (
            <Button variant="contained" onClick={() => void goNext()}>
              Next
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  )
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, fontFamily: mono ? 'monospace' : undefined, textAlign: 'right' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}
