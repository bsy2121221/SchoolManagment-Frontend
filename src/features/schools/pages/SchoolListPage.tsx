import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ServerDataGrid } from '@/components/data/ServerDataGrid'
import { FIRST_PAGE } from '@/components/data/serverPage'
import type { ServerPage } from '@/components/data/serverPage'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useModulePermissions } from '@/features/auth/permissions'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { useGetSchoolsQuery, useUpdateSchoolStatusMutation } from '../schoolsApi'
import { SchoolAdminDialog } from '../components/SchoolAdminDialog'
import { SchoolEditDialog } from '../components/SchoolEditDialog'
import { SchoolOnboardingWizard } from '../components/SchoolOnboardingWizard'
import type { SchoolRow } from '../types'

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_PARAM: Record<StatusFilter, boolean | undefined> = {
  all: undefined,
  active: true,
  inactive: false,
}

/**
 * Every tenant on the deployment: `GET /api/Schools`.
 *
 * SuperAdmin only — `Schools:View` alone is not enough, because every school admin
 * holds it for their own school. The route pairs the permission guard with a role
 * guard, matching the controller.
 *
 * The status filter defaults to "All" rather than "Active only", unlike the other list
 * screens. A suspended tenant is the thing a platform administrator most needs to see,
 * and hiding it by default would make an outage look like a missing record.
 */
export default function SchoolListPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { canCreate, canEdit } = useModulePermissions('Schools')

  const [pageState, setPageState] = useState<ServerPage>(FIRST_PAGE)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<SchoolRow | null>(null)
  const [addingAdminTo, setAddingAdminTo] = useState<SchoolRow | null>(null)
  const [pendingStatus, setPendingStatus] = useState<SchoolRow | null>(null)

  const { data, isLoading, isFetching, error, refetch } = useGetSchoolsQuery({
    searchTerm: search.trim() || undefined,
    isActive: STATUS_PARAM[status],
    page: pageState.page,
    pageSize: pageState.pageSize,
  })

  const [updateStatus, { isLoading: savingStatus }] = useUpdateSchoolStatusMutation()

  const handleConfirmStatus = async () => {
    if (!pendingStatus) return
    const suspending = pendingStatus.isActive
    try {
      await updateStatus({ schoolId: pendingStatus.id, isActive: !suspending }).unwrap()
      dispatch(
        toastSuccess(
          `${pendingStatus.schoolName} ${suspending ? 'suspended' : 'restored'}.`,
        ),
      )
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not change the school status.')))
    } finally {
      setPendingStatus(null)
    }
  }

  const columns = useMemo<GridColDef<SchoolRow>[]>(
    () => [
      {
        field: 'schoolName',
        headerName: 'School',
        flex: 1,
        minWidth: 220,
        renderCell: ({ row }) => (
          <Stack spacing={0} sx={{ justifyContent: 'center', height: '100%', minWidth: 0 }}>
            <Link component={RouterLink} to={`/schools/${row.id}`} underline="hover" noWrap>
              {row.schoolName}
            </Link>
            <Typography variant="caption" color="text.secondary" noWrap>
              {[row.city, row.country].filter(Boolean).join(', ') || 'No location recorded'}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'schoolCode',
        headerName: 'Code',
        width: 120,
        renderCell: ({ row }) => (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.schoolCode}
          </Typography>
        ),
      },
      {
        field: 'subdomain',
        headerName: 'Subdomain',
        width: 150,
        renderCell: ({ row }) =>
          row.subdomain ?? (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: 'totalStudents',
        headerName: 'Students',
        width: 100,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'totalTeachers',
        headerName: 'Teachers',
        width: 100,
        align: 'right',
        headerAlign: 'right',
      },
      {
        field: 'totalUsers',
        headerName: 'Accounts',
        width: 100,
        align: 'right',
        headerAlign: 'right',
        // A school with accounts but no students is one that was onboarded and never
        // used; a school with neither has not had its credentials collected.
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            color={row.totalUsers <= 1 ? 'text.secondary' : 'text.primary'}
          >
            {row.totalUsers}
          </Typography>
        ),
      },
      {
        field: 'isActive',
        headerName: 'Status',
        width: 120,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            label={row.isActive ? 'Active' : 'Suspended'}
            color={row.isActive ? 'success' : 'warning'}
            variant={row.isActive ? 'filled' : 'outlined'}
          />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 140,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            {canEdit && (
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => setEditing(row)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canCreate && (
              <Tooltip title="Add an administrator">
                <IconButton size="small" onClick={() => setAddingAdminTo(row)}>
                  <PersonAddAltOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title={row.isActive ? 'Suspend' : 'Restore'}>
                <IconButton
                  size="small"
                  disabled={savingStatus}
                  onClick={() => setPendingStatus(row)}
                >
                  {row.isActive ? (
                    <ToggleOnOutlinedIcon fontSize="small" color="success" />
                  ) : (
                    <ToggleOffOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [canCreate, canEdit, savingStatus],
  )

  const onboardButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWizardOpen(true)}>
      Onboard a school
    </Button>
  )

  const filtersApplied = Boolean(search.trim()) || status !== 'all'

  return (
    <Box>
      <PageHeader
        title="Schools"
        subtitle="Tenants on this deployment. Each one's own administrator manages its students, staff and classes."
        actions={
          <Can module="Schools" action="Create">
            {onboardButton}
          </Can>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search"
            size="small"
            value={search}
            placeholder="Name, code or city"
            onChange={(event) => {
              setSearch(event.target.value)
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            sx={{ minWidth: 260 }}
          />
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active only</MenuItem>
            <MenuItem value="inactive">Suspended only</MenuItem>
          </TextField>
        </Stack>
        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ServerDataGrid<SchoolRow>
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
        onRowDoubleClick={(params) => void navigate(`/schools/${params.id}`)}
        emptyTitle={filtersApplied ? 'No schools match these filters' : 'No schools yet'}
        emptyDescription={
          filtersApplied
            ? 'Try a shorter search term, or widen the status filter.'
            : 'Onboard the first school to create it along with its administrator account.'
        }
        emptyAction={canCreate && !filtersApplied ? onboardButton : undefined}
      />

      <SchoolOnboardingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onOpenSchool={(schoolId) => void navigate(`/schools/${schoolId}`)}
      />

      {editing && (
        <SchoolEditDialog open school={editing} onClose={() => setEditing(null)} />
      )}

      {addingAdminTo && (
        <SchoolAdminDialog
          open
          school={addingAdminTo}
          onClose={() => setAddingAdminTo(null)}
        />
      )}

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus?.isActive ? 'Suspend this school?' : 'Restore this school?'}
        destructive={pendingStatus?.isActive ?? false}
        busy={savingStatus}
        confirmLabel={pendingStatus?.isActive ? 'Suspend' : 'Restore'}
        message={
          pendingStatus?.isActive ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Everyone at {pendingStatus.schoolName} is signed out immediately and
                cannot sign back in. Its refresh tokens are revoked, so no one lingers on
                a valid session.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nothing is deleted. Students, results and fee records stay exactly as they
                are, and restoring the school brings all {pendingStatus.totalUsers}{' '}
                account{pendingStatus.totalUsers === 1 ? '' : 's'} back.
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2">
              {pendingStatus?.schoolName} becomes reachable again and its accounts can
              sign in. Anyone still holding the shared temporary password will be asked to
              change it.
            </Typography>
          )
        }
        onConfirm={() => void handleConfirmStatus()}
        onCancel={() => setPendingStatus(null)}
      />
    </Box>
  )
}
