import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ServerDataGrid } from '@/components/data/ServerDataGrid'
import { FIRST_PAGE } from '@/components/data/serverPage'
import type { ServerPage } from '@/components/data/serverPage'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan, useCurrentUser, useModulePermissions } from '@/features/auth/permissions'
import { canChangeRole, useRoleLookup } from '@/features/roles/roleLookup'
import { getErrorMessage } from '@/lib/serverErrors'
import { ROLES } from '@/types/enums'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { UserFormDialog } from '../components/UserFormDialog'
import { UserPasswordResetDialog } from '../components/UserPasswordResetDialog'
import { UserRoleDialog } from '../components/UserRoleDialog'
import { useDeleteUserMutation, useGetUsersQuery, useUpdateUserStatusMutation } from '../usersApi'
import type { UserRow } from '../types'

/** The `isActive` filter. Held as a string because it drives a `<TextField select>`. */
type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_PARAM: Record<StatusFilter, boolean | undefined> = {
  all: undefined,
  active: true,
  inactive: false,
}

/** Long enough not to fire a request per keystroke, short enough to feel like typing. */
const SEARCH_DEBOUNCE_MS = 400

function initialsOf(row: UserRow): string {
  const initials = `${row.firstName.charAt(0)}${row.lastName.charAt(0)}`.trim()
  return (initials || row.username.charAt(0)).toUpperCase()
}

/**
 * Every account in the school, of every kind.
 *
 * This is the widest list in the app and the only screen that can bring a deactivated account
 * back: `PUT /users/{id}/status` with `isActive: true` is the API's sole reactivation path, and
 * the Students, Teachers and Parents modules each deactivate without offering one. Reactivating
 * restores the login, the person and the role-specific row — not the subject enrolments,
 * timetable rows or parent links a delete switched off.
 *
 * There is no "add user" button because there is no endpoint behind it. Accounts are created by
 * student, teacher or parent registration, or by adding an administrator to a school.
 */
export default function UserListPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { canEdit, canDelete } = useModulePermissions('Users')
  // The role filter reads GET /api/Roles, which needs Roles:View. The seeded Admin role holds
  // it; a custom role with Users:View but no Roles:View gets the list without the filter.
  const canViewRoles = useCan('Roles', 'View')

  const currentUser = useCurrentUser()
  // The password reset is gated on the role name, not the permission grid:
  // [Authorize(Roles = "Admin,SuperAdmin")]. A custom role holding every Users flag cannot
  // reach it, so offering the button would be offering a 403.
  const canResetPasswords =
    currentUser?.role === ROLES.Admin || currentUser?.role === ROLES.SuperAdmin

  const [pageState, setPageState] = useState<ServerPage>(FIRST_PAGE)
  const [roleId, setRoleId] = useState<'all' | number>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [editing, setEditing] = useState<UserRow | null>(null)
  const [changingRole, setChangingRole] = useState<UserRow | null>(null)
  const [resetting, setResetting] = useState<UserRow | null>(null)
  const [pendingStatus, setPendingStatus] = useState<UserRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null)

  const { roles, isLoading: loadingRoles } = useRoleLookup({ skip: !canViewRoles })

  // Debounced: the search is a server round trip across four columns, so it waits for the
  // typing to stop. The page resets with it, since a new search renumbers the pages.
  useEffect(() => {
    const timer = setTimeout(() => {
      // oxlint-disable-next-line react/set-state-in-effect
      setSearchTerm(searchInput.trim())
      // oxlint-disable-next-line react/set-state-in-effect
      setPageState((current) => ({ ...current, page: 1 }))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching, error, refetch } = useGetUsersQuery({
    // roleId rather than role: a role can be renamed, its id cannot.
    roleId: roleId === 'all' ? undefined : roleId,
    isActive: STATUS_PARAM[status],
    searchTerm: searchTerm || undefined,
    page: pageState.page,
    pageSize: pageState.pageSize,
  })

  const [updateStatus, { isLoading: togglingStatus }] = useUpdateUserStatusMutation()
  const [deleteUser, { isLoading: deleting }] = useDeleteUserMutation()

  const handleStatus = async () => {
    if (!pendingStatus) return
    const target = !pendingStatus.isActive
    try {
      await updateStatus({ userId: pendingStatus.id, isActive: target }).unwrap()
      dispatch(
        toastSuccess(
          `${pendingStatus.username} ${target ? 'reactivated' : 'deactivated'}.`,
        ),
      )
      setPendingStatus(null)
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not change the account status.')))
      setPendingStatus(null)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteUser(pendingDelete.id).unwrap()
      dispatch(toastSuccess(`${pendingDelete.username} deleted.`))
      setPendingDelete(null)
    } catch (caught) {
      // Eight distinct refusals with eight different remedies — an admin account, a teacher
      // still on an active class, a student with attendance, results or fees. Showing the
      // message is the whole point of this phase's server repair.
      dispatch(toastError(getErrorMessage(caught, 'Could not delete this account.')))
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<UserRow>[]>(
    () => [
      {
        field: 'firstName',
        headerName: 'Name',
        flex: 1,
        minWidth: 240,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 0.5 }}>
            {/* The bytes are never in the list response, so this is initials plus a flag.
                The image itself is fetched one user at a time on the details screen. */}
            <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{initialsOf(row)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Link component={RouterLink} to={`/users/${row.id}`} underline="hover">
                {`${row.firstName} ${row.lastName}`.trim() || row.username}
              </Link>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {row.username}
                {row.roleIdentifier ? ` · ${row.roleIdentifier}` : ''}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'role',
        headerName: 'Role',
        width: 130,
        renderCell: ({ row }) => <Chip size="small" variant="outlined" label={row.role} />,
      },
      {
        field: 'email',
        headerName: 'Contact',
        flex: 1,
        minWidth: 220,
        renderCell: ({ row }) => (
          <Stack sx={{ py: 0.5 }}>
            <Typography variant="body2">{row.email}</Typography>
            {row.phoneNumber && (
              <Typography variant="caption" color="text.secondary">
                {row.phoneNumber}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'lastLoginAt',
        headerName: 'Last sign-in',
        width: 150,
        renderCell: ({ row }) =>
          row.lastLoginAt ? (
            <Typography variant="body2">{new Date(row.lastLoginAt).toLocaleDateString()}</Typography>
          ) : (
            // Null is "never", not "unknown", and it is how you spot an account that was
            // created and never handed over.
            <Typography variant="body2" color="text.disabled">
              Never
            </Typography>
          ),
      },
      {
        field: 'isActive',
        headerName: 'Status',
        width: 130,
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 0.5 }}>
            <Chip
              size="small"
              label={row.isActive ? 'Active' : 'Inactive'}
              color={row.isActive ? 'success' : 'default'}
              variant={row.isActive ? 'filled' : 'outlined'}
            />
            {row.isActive && row.requirePasswordChange && (
              <Typography variant="caption" color="warning.main">
                Temp password
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 210,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => {
          // Self-guards mirror UserService, which refuses all three for the caller's own
          // account: deactivating or deleting yourself revokes your own tokens mid-request,
          // and demoting yourself is how a school ends up with nobody who can undo it.
          const isSelf = row.id === currentUser?.userId

          return (
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
              <Tooltip title="Account details">
                <IconButton size="small" onClick={() => void navigate(`/users/${row.id}`)}>
                  <PersonOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {canEdit && (
                <>
                  <Tooltip
                    title={row.isActive ? 'Edit' : 'Reactivate before editing — the server refuses edits to inactive accounts'}
                  >
                    <span>
                      <IconButton
                        size="small"
                        disabled={!row.isActive}
                        onClick={() => setEditing(row)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip
                    title={
                      isSelf
                        ? 'You cannot change your own role'
                        : canChangeRole(row)
                          ? 'Change role'
                          : 'Students, teachers and parents cannot be reassigned'
                    }
                  >
                    <span>
                      <IconButton
                        size="small"
                        disabled={isSelf || !canChangeRole(row)}
                        onClick={() => setChangingRole(row)}
                      >
                        <SwapHorizIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip
                    title={
                      row.isActive
                        ? isSelf
                          ? 'You cannot deactivate your own account'
                          : 'Deactivate'
                        : 'Reactivate'
                    }
                  >
                    <span>
                      <IconButton
                        size="small"
                        color={row.isActive ? 'default' : 'success'}
                        disabled={row.isActive && isSelf}
                        onClick={() => setPendingStatus(row)}
                      >
                        {row.isActive ? (
                          <PersonOffOutlinedIcon fontSize="small" />
                        ) : (
                          <RestartAltIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}

              {canResetPasswords && (
                <Tooltip title={row.isActive ? 'Reset password' : 'Inactive accounts cannot sign in'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!row.isActive}
                      onClick={() => setResetting(row)}
                    >
                      <KeyOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}

              {canDelete && row.isActive && (
                <Tooltip title={isSelf ? 'You cannot delete your own account' : 'Delete'}>
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={isSelf}
                      onClick={() => setPendingDelete(row)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Stack>
          )
        },
      },
    ],
    [canEdit, canDelete, canResetPasswords, currentUser?.userId, navigate],
  )

  const filtersApplied = roleId !== 'all' || status !== 'active' || searchTerm !== ''

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle="Every account in the school — staff, students and parents alike. This is where a login is suspended, restored, moved to another role or given a new password."
      />

      <Alert severity="info" icon={<BadgeOutlinedIcon />} sx={{ mb: 2 }}>
        Accounts are not created here. A student, teacher or parent account comes from their own
        registration, and an administrator comes from the school’s own screen — so this list
        edits and governs accounts rather than admitting them.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search"
            size="small"
            value={searchInput}
            placeholder="Name, username or email"
            onChange={(event) => setSearchInput(event.target.value)}
            sx={{ minWidth: 280, flex: 1 }}
            helperText="Matched by the server across all four"
          />
          <TextField
            select
            label="Role"
            size="small"
            value={roleId}
            onChange={(event) => {
              const raw = event.target.value
              setRoleId(raw === 'all' ? 'all' : Number(raw))
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            disabled={!canViewRoles || loadingRoles}
            sx={{ minWidth: 200 }}
            helperText={
              canViewRoles
                ? loadingRoles
                  ? 'Loading…'
                  : 'Filtered by role id, not name'
                : 'Needs permission to view roles'
            }
          >
            <MenuItem value="all">All roles</MenuItem>
            {roles.map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.roleName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            sx={{ minWidth: 170 }}
            helperText="Inactive accounts can be restored"
          >
            <MenuItem value="active">Active only</MenuItem>
            <MenuItem value="inactive">Inactive only</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </TextField>
        </Stack>
        {/* A thin progress line rather than swapping the grid out: refetching a filter should
            not make the rows the user is reading disappear. */}
        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ServerDataGrid<UserRow>
        rows={data?.items}
        totalCount={data?.totalCount}
        value={pageState}
        onChange={setPageState}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        rowHeight={62}
        emptyTitle={filtersApplied ? 'No accounts match these filters' : 'No accounts yet'}
        emptyDescription={
          filtersApplied
            ? 'Try clearing the search, choosing another role, or widening the status filter.'
            : 'Every school has at least its own administrator, so an empty list here usually means the filters, not the school.'
        }
      />

      <UserFormDialog
        open={editing !== null}
        editing={editing}
        onClose={() => setEditing(null)}
      />

      <UserRoleDialog
        open={changingRole !== null}
        user={changingRole}
        onClose={() => setChangingRole(null)}
      />

      <UserPasswordResetDialog
        open={resetting !== null}
        user={resetting}
        onClose={() => setResetting(null)}
      />

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus?.isActive ? 'Deactivate this account?' : 'Reactivate this account?'}
        destructive={pendingStatus?.isActive ?? false}
        busy={togglingStatus}
        confirmLabel={pendingStatus?.isActive ? 'Deactivate' : 'Reactivate'}
        message={
          pendingStatus?.isActive ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                {pendingStatus.username} can no longer sign in, and any session they have open is
                revoked immediately. Their {pendingStatus.role.toLowerCase()} record is
                deactivated with the login.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nothing is deleted, and this is reversible from this same screen — unlike the
                delete on the Students, Teachers and Parents modules.
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                {pendingStatus?.username} can sign in again, and their{' '}
                {pendingStatus?.role.toLowerCase()} record is restored along with the login.
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
        onCancel={() => setPendingStatus(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this account?"
        destructive
        busy={deleting}
        confirmLabel="Delete"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingDelete?.username} is deactivated along with whichever record belongs to them
              — their subject links, timetable and parent links are switched off, and their
              sessions are revoked.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The server refuses this outright for admin accounts, for a teacher still assigned to
              an active class or holding attendance history, for a student with attendance,
              results or fees, and for a parent with children still attached. It will say which.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reactivating restores the login and the record but not the links, so a deactivate is
              the gentler option if you only want to suspend access.
            </Typography>
          </Stack>
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  )
}
