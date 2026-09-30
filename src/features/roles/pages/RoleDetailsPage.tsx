import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { useModulePermissions } from '@/features/auth/permissions'
import { getErrorStatus } from '@/lib/serverErrors'
import { ROLE_IDS } from '@/types/enums'
import { DeleteRoleDialog } from '../components/DeleteRoleDialog'
import { PermissionGridEditor } from '../components/PermissionGridEditor'
import { RoleFormDialog } from '../components/RoleFormDialog'
import { deleteBlockedReason } from '../permissionGrid'
import { useGetRoleQuery } from '../rolesApi'

/** `/roles/:roleId` — one role's details and its permission grid. */
export default function RoleDetailsPage() {
  const params = useParams<{ roleId: string }>()
  const roleId = Number(params.roleId)
  const validId = Number.isInteger(roleId) && roleId > 0
  const navigate = useNavigate()

  const { canEdit, canDelete } = useModulePermissions('Roles')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: role, isLoading, error, refetch } = useGetRoleQuery(roleId, { skip: !validId })

  const backButton = (
    <Button component={RouterLink} to="/roles" startIcon={<ArrowBackIcon />} size="small">
      Roles
    </Button>
  )

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid role reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the role…" />

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        {getErrorStatus(error) === 404 ? (
          <EmptyState
            title="No such role"
            description="It may have been deleted."
            action={backButton}
          />
        ) : (
          <ErrorState error={error} title="Could not load this role" onRetry={() => void refetch()} />
        )}
      </Box>
    )
  }

  if (!role) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState title="No such role" action={backButton} />
      </Box>
    )
  }

  const blocked = deleteBlockedReason(role)
  const holders = `${role.userCount} user${role.userCount === 1 ? '' : 's'}`
  // Remount the editor on every new grid from the server, so a save starts a clean draft.
  const gridKey = role.permissions.map((p) => `${p.moduleName}:${p.updatedAt}`).join('|')

  return (
    <Box>
      <Box sx={{ mt: 2 }}>{backButton}</Box>

      <PageHeader
        title={role.roleName}
        subtitle={`${role.isSystemRole ? 'Built-in' : 'Custom'} · code ${role.roleCode} · ${holders} across all schools${role.isActive ? '' : ' · inactive'}`}
        actions={
          <>
            {canEdit && (
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                onClick={() => setEditOpen(true)}
              >
                Edit details
              </Button>
            )}
            {canDelete && !role.isSystemRole && (
              <Tooltip title={blocked ?? ''}>
                <span>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteOutlineIcon />}
                    disabled={blocked !== null}
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                </span>
              </Tooltip>
            )}
          </>
        }
      />

      {role.description && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          {role.description}
        </Alert>
      )}

      {!role.isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This role is inactive: it is not offered in the Users screen’s role picker.
        </Alert>
      )}

      <PermissionGridEditor
        key={gridKey}
        role={role}
        editable={canEdit && role.id !== ROLE_IDS.SuperAdmin}
      />

      <RoleFormDialog open={editOpen} editing={role} onClose={() => setEditOpen(false)} />
      <DeleteRoleDialog
        role={deleteOpen ? role : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => void navigate('/roles', { replace: true })}
      />
    </Box>
  )
}
