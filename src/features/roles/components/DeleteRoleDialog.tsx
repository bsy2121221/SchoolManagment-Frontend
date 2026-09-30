import { useAppDispatch } from '@/app/hooks'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { useDeleteRoleMutation } from '../rolesApi'
import type { Role } from '../types'

interface DeleteRoleDialogProps {
  role: Role | null
  onClose: () => void
  onDeleted?: () => void
}

/**
 * Delete a custom role and its grid.
 *
 * Only offered for a role nobody holds: `sp_DeleteRole` refuses while *any* user has it,
 * active or not, because the user row's foreign key points at it. Callers disable the button
 * and say so with the count, rather than letting the confirmation fail. The count is the one
 * from the last read, so the server can still answer 409 if someone was moved in since.
 */
export function DeleteRoleDialog({ role, onClose, onDeleted }: DeleteRoleDialogProps) {
  const dispatch = useAppDispatch()
  const [deleteRole, { isLoading }] = useDeleteRoleMutation()

  const handleConfirm = async () => {
    if (!role) return
    try {
      await deleteRole(role.id).unwrap()
      dispatch(toastSuccess(`${role.roleName} deleted.`))
      onDeleted?.()
    } catch (caught) {
      dispatch(
        toastError(
          getErrorStatus(caught) === 404
            ? 'That role had already been deleted.'
            : getErrorMessage(caught, 'Could not delete the role.'),
        ),
      )
    } finally {
      onClose()
    }
  }

  return (
    <ConfirmDialog
      open={role !== null}
      title={`Delete ${role?.roleName ?? 'role'}?`}
      message="Nobody holds this role. It and its permission grid are removed for every school, and this cannot be undone."
      confirmLabel="Delete role"
      destructive
      busy={isLoading}
      onConfirm={() => void handleConfirm()}
      onCancel={onClose}
    />
  )
}
