import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { PageHeader } from '@/components/layout/PageHeader'
import { useModulePermissions } from '@/features/auth/permissions'
import { DeleteRoleDialog } from '../components/DeleteRoleDialog'
import { RoleFormDialog } from '../components/RoleFormDialog'
import { deleteBlockedReason } from '../permissionGrid'
import { useGetRolesQuery } from '../rolesApi'
import type { Role } from '../types'

/**
 * `/roles` — every role on the platform.
 *
 * SuperAdmin-only as a route, and every write is SuperAdminOnly on the server (§7.58). The
 * buttons still read the `Roles` row of the grid, so the SuperAdmin's own seeded grid decides
 * what shows, as everywhere else.
 *
 * `userCount` spans every school, since roles are global.
 */
export default function RoleListPage() {
  const { canCreate, canEdit, canDelete } = useModulePermissions('Roles')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const { data, isLoading, isFetching, error, refetch } = useGetRolesQuery(
    includeInactive ? { includeInactive: true } : undefined,
  )

  const columns = useMemo<GridColDef<Role>[]>(
    () => [
      {
        field: 'roleName',
        headerName: 'Role',
        flex: 1,
        minWidth: 180,
        renderCell: ({ row }) => (
          <Link component={RouterLink} to={`/roles/${row.id}`} underline="hover">
            {row.roleName}
          </Link>
        ),
      },
      { field: 'roleCode', headerName: 'Code', width: 140 },
      {
        field: 'isSystemRole',
        headerName: 'Type',
        width: 120,
        valueGetter: (value: boolean) => (value ? 'Built-in' : 'Custom'),
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.isSystemRole ? 'default' : 'primary'}
            label={row.isSystemRole ? 'Built-in' : 'Custom'}
          />
        ),
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 2,
        minWidth: 200,
        valueGetter: (value: string | null) => value ?? '',
      },
      {
        field: 'userCount',
        headerName: 'Users',
        type: 'number',
        width: 90,
        description: 'Across every school, inactive accounts included',
      },
      {
        field: 'moduleCount',
        headerName: 'Modules',
        type: 'number',
        width: 100,
        description: 'Modules this role can see, of 15',
      },
      ...(includeInactive
        ? [
            {
              field: 'isActive',
              headerName: 'Status',
              width: 110,
              valueGetter: (value: boolean) => (value ? 'Active' : 'Inactive'),
              renderCell: ({ row }) =>
                row.isActive ? (
                  <Chip size="small" color="success" variant="outlined" label="Active" />
                ) : (
                  <Chip size="small" variant="outlined" label="Inactive" />
                ),
            } satisfies GridColDef<Role>,
          ]
        : []),
      ...(canEdit || canDelete
        ? [
            {
              field: 'actions',
              headerName: '',
              sortable: false,
              filterable: false,
              width: 110,
              align: 'right',
              renderCell: ({ row }) => {
                const blocked = deleteBlockedReason(row)
                return (
                  <Stack direction="row" spacing={0.5}>
                    {canEdit && (
                      <Tooltip title="Edit details">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${row.roleName}`}
                          onClick={() => {
                            setEditing(row)
                            setFormOpen(true)
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title={blocked ?? 'Delete'}>
                        {/* A span so the tooltip still fires on a disabled button. */}
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Delete ${row.roleName}`}
                            disabled={blocked !== null}
                            onClick={() => setDeleting(row)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Stack>
                )
              },
            } satisfies GridColDef<Role>,
          ]
        : []),
    ],
    [canEdit, canDelete, includeInactive],
  )

  const addButton = canCreate ? (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => {
        setEditing(null)
        setFormOpen(true)
      }}
    >
      Create role
    </Button>
  ) : undefined

  return (
    <Box>
      <PageHeader
        title="Roles & permissions"
        subtitle="Shared by every school. Open a role to edit what it can do."
        actions={addButton}
      />

      <Stack
        direction="row"
        sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          The five built-in roles cannot be renamed, deactivated or deleted. Custom roles can hold
          school staff moved into them from the Users screen.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
          }
          label="Show inactive"
          sx={{ flexShrink: 0 }}
        />
      </Stack>

      <ClientDataGrid
        rows={data}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        autoHeight
        emptyTitle={includeInactive ? 'No roles' : 'No active roles'}
        emptyDescription="The built-in roles are seeded with the database, so an empty list means it was not set up."
        emptyAction={addButton}
      />

      <RoleFormDialog open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />
      <DeleteRoleDialog role={deleting} onClose={() => setDeleting(null)} />
    </Box>
  )
}
