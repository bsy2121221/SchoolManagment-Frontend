import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined'
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { StatCard } from '@/components/data/StatCard'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan, useCurrentUser } from '@/features/auth/permissions'
import { canChangeRole } from '@/features/roles/roleLookup'
import { getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { ROLE_IDS, ROLES } from '@/types/enums'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { ProfilePicturePanel } from '../components/ProfilePicturePanel'
import { UserFormDialog } from '../components/UserFormDialog'
import { UserPasswordResetDialog } from '../components/UserPasswordResetDialog'
import { UserRoleDialog } from '../components/UserRoleDialog'
import { useGetUserQuery, useUpdateUserStatusMutation } from '../usersApi'

/** A timestamp from the API, or an em dash when it is absent or unparseable. */
function dateTimeOrDash(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

/** One row of the details table. */
function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <TableRow>
      <TableCell sx={{ width: 170, color: 'text.secondary', border: 0, py: 0.75 }}>
        {label}
      </TableCell>
      <TableCell sx={{ border: 0, py: 0.75 }}>{value || '—'}</TableCell>
    </TableRow>
  )
}

/**
 * Where the module's own record sends you for the rest of the person. A user row carries the
 * login; the substance lives in whichever module owns them.
 */
const ROLE_ROUTE: Partial<Record<number, { path: string; label: string }>> = {
  [ROLE_IDS.Teacher]: { path: 'teachers', label: 'Open their teacher profile' },
  [ROLE_IDS.Parent]: { path: 'parents', label: 'Open their parent profile' },
}

/**
 * One account: the login, the person behind it, the audit trail and the picture.
 *
 * Keyed on `Users.Id`, which every endpoint in this module takes — unlike Teachers and Parents,
 * where the route id and the write id differ. `GET /users/{id}` is gated by `CanAccessUser`
 * rather than the permission grid, so a user can open their own row here even without
 * `Users:View`; the route guard means in practice only admins arrive.
 *
 * The status control is the reason this screen exists as more than a read: it is the only
 * reactivation in the API.
 */
export default function UserDetailsPage() {
  const params = useParams<{ userId: string }>()
  const userId = Number(params.userId)
  const dispatch = useAppDispatch()

  const [editOpen, setEditOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const validId = Number.isInteger(userId) && userId > 0

  const { data, isLoading, error, refetch } = useGetUserQuery(userId, { skip: !validId })

  const canEdit = useCan('Users', 'Edit')
  const currentUser = useCurrentUser()
  const canResetPasswords =
    currentUser?.role === ROLES.Admin || currentUser?.role === ROLES.SuperAdmin

  const [updateStatus, { isLoading: togglingStatus }] = useUpdateUserStatusMutation()

  const isSelf = data?.id === currentUser?.userId

  const handleStatus = async () => {
    if (!data) return
    const target = !data.isActive
    try {
      await updateStatus({ userId: data.id, isActive: target }).unwrap()
      dispatch(toastSuccess(`${data.username} ${target ? 'reactivated' : 'deactivated'}.`))
      setStatusOpen(false)
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not change the account status.')))
      setStatusOpen(false)
    }
  }

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid account reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the account…" />

  if (error) {
    // 403 here is CanAccessUser refusing, not the permission grid: a non-admin reading somebody
    // else's row. It is a sentence, not a fault.
    if (getErrorStatus(error) === 403) {
      return (
        <Box sx={{ py: 4 }}>
          <EmptyState
            title="Not your account to read"
            description="Only an administrator can open another user's account. Your own is always readable."
            action={
              <Button component={RouterLink} to="/users" startIcon={<ArrowBackIcon />}>
                Back to users
              </Button>
            }
          />
        </Box>
      )
    }

    return (
      <Box sx={{ py: 4 }}>
        <ErrorState
          error={error}
          title="Could not load this account"
          onRetry={() => void refetch()}
        />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title="No such account"
          description="It may belong to a different school, or never have existed. A deactivated account does open here, so this is not what a suspended login looks like."
          action={
            <Button component={RouterLink} to="/users" startIcon={<ArrowBackIcon />}>
              Back to users
            </Button>
          }
        />
      </Box>
    )
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim() || data.username
  const roleRoute = ROLE_ROUTE[data.roleId]
  const movable = canChangeRole(data)

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/users"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mt: 2 }}
      >
        Users
      </Button>

      <PageHeader
        title={fullName}
        subtitle={`Signs in as ${data.username} · ${data.role}${data.roleIdentifier ? ` · ${data.roleIdentifier}` : ''}`}
        actions={
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  disabled={!data.isActive}
                  onClick={() => setEditOpen(true)}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SwapHorizIcon />}
                  disabled={isSelf || !movable}
                  onClick={() => setRoleOpen(true)}
                >
                  Change role
                </Button>
                <Button
                  variant={data.isActive ? 'outlined' : 'contained'}
                  color={data.isActive ? 'error' : 'success'}
                  startIcon={data.isActive ? <PersonOffOutlinedIcon /> : <RestartAltIcon />}
                  disabled={data.isActive && isSelf}
                  onClick={() => setStatusOpen(true)}
                >
                  {data.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </>
            )}
            {canResetPasswords && (
              <Button
                variant="outlined"
                startIcon={<KeyOutlinedIcon />}
                disabled={!data.isActive}
                onClick={() => setResetOpen(true)}
              >
                Reset password
              </Button>
            )}
          </Stack>
        }
      />

      {!data.isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This account is deactivated: the user cannot sign in and cannot be edited until it is
          restored. Reactivating brings back the login and their{' '}
          {data.role.toLowerCase()} record — but not the subject enrolments, timetable rows or
          parent links, which have to be set up again in their own modules.
        </Alert>
      )}

      {data.isActive && data.requirePasswordChange && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Still on the password the account was created with. They will be sent to the
          change-password screen the first time they sign in.
        </Alert>
      )}

      {isSelf && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This is your own account. Deactivating, deleting or changing the role of it is refused —
          each of those would revoke your own access with nobody guaranteed to be able to undo it.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <StatCard
          label="Account"
          value={data.isActive ? 'Active' : 'Deactivated'}
          icon={BadgeOutlinedIcon}
          iconColor={data.isActive ? 'success.main' : 'text.disabled'}
          caption={
            data.requirePasswordChange
              ? 'Still on the password it was created with'
              : 'Password has been changed at least once'
          }
        />

        <StatCard
          label="Role"
          value={data.role}
          icon={SwapHorizIcon}
          caption={
            movable
              ? 'Can be moved to another role from here'
              : 'Fixed — the role comes from the record that owns them'
          }
          extra={
            data.roleCode ? (
              <Chip size="small" variant="outlined" label={data.roleCode} sx={{ mt: 1 }} />
            ) : undefined
          }
        />

        <StatCard
          label="Last sign-in"
          value={data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleDateString() : 'Never'}
          icon={LoginOutlinedIcon}
          iconColor={data.lastLoginAt ? 'primary.main' : 'warning.main'}
          // Never is a real answer: an account created and never handed over looks exactly
          // like this, and "0" would be a lie about a date.
          caption={
            data.lastLoginAt ? dateTimeOrDash(data.lastLoginAt) : 'The account has never been used'
          }
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              Person
            </Typography>
            <Table size="small">
              <TableBody>
                <DetailRow label="Name" value={fullName} />
                <DetailRow label="Email" value={data.email} />
                <DetailRow label="Phone" value={data.phoneNumber} />
                <DetailRow label="Alternate phone" value={data.alternatePhoneNumber} />
                <DetailRow label="Address" value={data.address} />
                <DetailRow label="City" value={data.city} />
                <DetailRow label="State" value={data.state} />
                <DetailRow label="Country" value={data.country} />
                <DetailRow label="Postal code" value={data.postalCode} />
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              The name and phone live on the person, the email on the login, and the address on
              its own row — one edit writes all three in a single transaction.
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              Audit trail
            </Typography>
            <Table size="small">
              <TableBody>
                <DetailRow label="Created" value={dateTimeOrDash(data.createdAt)} />
                <DetailRow label="Created by" value={data.createdByUsername} />
                <DetailRow label="Last updated" value={dateTimeOrDash(data.updatedAt)} />
                <DetailRow label="Updated by" value={data.modifiedByUsername} />
              </TableBody>
            </Table>
          </Paper>
        </Stack>

        <Stack spacing={2}>
          <ProfilePicturePanel
            userId={data.id}
            firstName={data.firstName}
            lastName={data.lastName}
            username={data.username}
            hasProfilePicture={data.hasProfilePicture}
            // The write endpoints are Admin-or-self; the read has no check at all.
            canEdit={canEdit || isSelf}
          />

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
              Login
            </Typography>
            <Table size="small">
              <TableBody>
                <DetailRow label="Username" value={data.username} />
                <DetailRow label="Role" value={data.role} />
                <DetailRow label="School" value={data.schoolName} />
                <DetailRow label="School code" value={data.schoolCode} />
                <DetailRow
                  label={data.roleId === ROLE_IDS.Student ? 'Admission no.' : 'Employee id'}
                  value={data.roleIdentifier}
                />
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              The username is allocated by the server at registration and never changes — not even
              when the name is corrected.
            </Typography>
          </Paper>

          {roleRoute && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {data.role} record
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                This screen governs the login. Everything the school actually does with them —
                {data.roleId === ROLE_IDS.Teacher
                  ? ' their subjects, classes and timetable —'
                  : ' their children —'}{' '}
                lives in their own module.
              </Typography>
              <Button
                component={RouterLink}
                to={`/${roleRoute.path}/${data.id}`}
                size="small"
                variant="outlined"
              >
                {roleRoute.label}
              </Button>
            </Paper>
          )}

          {data.roleId === ROLE_IDS.Student && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Student record
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Their class, attendance, results and fees live in the Students module. That screen
                is keyed on the student record rather than on this login, so it is reached from the
                student list rather than from here.
              </Typography>
              <Button
                component={RouterLink}
                to="/students"
                size="small"
                variant="outlined"
                sx={{ mt: 1.5 }}
              >
                Open the student list
              </Button>
            </Paper>
          )}
        </Stack>
      </Box>

      <UserFormDialog open={editOpen} editing={data} onClose={() => setEditOpen(false)} />

      <UserRoleDialog open={roleOpen} user={data} onClose={() => setRoleOpen(false)} />

      <UserPasswordResetDialog open={resetOpen} user={data} onClose={() => setResetOpen(false)} />

      <ConfirmDialog
        open={statusOpen}
        title={data.isActive ? 'Deactivate this account?' : 'Reactivate this account?'}
        destructive={data.isActive}
        busy={togglingStatus}
        confirmLabel={data.isActive ? 'Deactivate' : 'Reactivate'}
        message={
          data.isActive ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                {data.username} can no longer sign in, and any session they have open is revoked
                immediately. Their {data.role.toLowerCase()} record is deactivated with the login.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nothing is deleted, and this is reversible from this same screen.
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                {data.username} can sign in again, and their {data.role.toLowerCase()} record is
                restored along with the login.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Subject enrolments, timetable rows and parent links are <strong>not</strong>{' '}
                restored — those were switched off separately and have to be set up again in their
                own modules.
              </Typography>
            </Stack>
          )
        }
        onConfirm={() => void handleStatus()}
        onCancel={() => setStatusOpen(false)}
      />
    </Box>
  )
}
