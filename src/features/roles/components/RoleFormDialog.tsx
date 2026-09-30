import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useCreateRoleMutation, useUpdateRoleMutation } from '../rolesApi'
import type { Role } from '../types'

/** Mirrors RoleCreateDTO / RoleUpdateDTO. */
const schema = z.object({
  roleName: z
    .string()
    .trim()
    .min(1, 'Role name is required')
    .max(50, 'Role name cannot exceed 50 characters'),
  roleCode: z
    .string()
    .trim()
    .max(20, 'Role code cannot exceed 20 characters')
    .regex(/^[A-Za-z0-9_]*$/, 'Role code may contain only letters, numbers and underscores'),
  description: z.string().trim().max(255, 'Description cannot exceed 255 characters'),
  isActive: z.boolean(),
})

type RoleForm = z.input<typeof schema>

const FIELDS = ['roleName', 'roleCode', 'description', 'isActive'] as const

const EMPTY: RoleForm = { roleName: '', roleCode: '', description: '', isActive: true }

interface RoleFormDialogProps {
  open: boolean
  /** The role being edited, or null to create one. */
  editing: Role | null
  onClose: () => void
}

/**
 * Create a custom role, or edit one.
 *
 * **System roles.** Only the description can change: `sp_UpdateRole` refuses renaming or
 * deactivating the five seeded roles, because policies and database checks refer to them by
 * name and id. The name and active switch are shown disabled rather than hidden, so it is
 * clear they exist and why they do not move.
 *
 * **The code** is fixed at creation -- RoleUpdateDTO has no code -- and optional then:
 * `sp_CreateRole` derives it from the name.
 *
 * **Deactivating** is refused while any *active* user holds the role, since they could no
 * longer sign in. A new role opens on its page with an empty grid, rather than taking a
 * starting grid here: the editor there is the one place the grid is shown with its notes.
 */
export function RoleFormDialog({ open, editing, onClose }: RoleFormDialogProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const [createRole, { isLoading: creating }] = useCreateRoleMutation()
  const [updateRole, { isLoading: updating }] = useUpdateRoleMutation()

  const { control, handleSubmit, reset, setError } = useForm<RoleForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(
      editing
        ? {
            roleName: editing.roleName,
            roleCode: editing.roleCode,
            description: editing.description ?? '',
            isActive: editing.isActive,
          }
        : EMPTY,
    )
  }, [open, editing, reset])

  const system = editing?.isSystemRole === true

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const roleName = values.roleName.trim()
    const description = values.description.trim()

    try {
      if (editing) {
        await updateRole({
          roleId: editing.id,
          body: {
            // A system role resends its own name, which the server reads as "no rename".
            roleName: system ? editing.roleName : roleName,
            description,
            isActive: system ? true : values.isActive,
          },
        }).unwrap()
        dispatch(toastSuccess(`${roleName} updated.`))
        onClose()
      } else {
        const { roleId } = await createRole({
          roleName,
          roleCode: values.roleCode.trim() === '' ? null : values.roleCode.trim().toUpperCase(),
          description: description === '' ? null : description,
        }).unwrap()
        dispatch(toastSuccess(`${roleName} created. It grants nothing until you tick its grid.`))
        onClose()
        void navigate(`/roles/${roleId}`)
      }
    } catch (caught) {
      const unassigned = applyServerErrors<RoleForm>(caught, setError, FIELDS)
      const message = unassigned[0] ?? getErrorMessage(caught, 'Could not save the role.')
      const status = getErrorStatus(caught)
      // 409 names what is taken: "Role 'X' already exists." or "Role code 'X' already exists."
      if (status === 409 && /^Role code/i.test(message)) {
        setError('roleCode', { type: 'server', message: 'Another role already has this code' })
      } else if (status === 409 && /already exists/i.test(message)) {
        setError('roleName', { type: 'server', message: 'Another role already has this name' })
      } else if (status === 409) {
        setError('isActive', { type: 'server', message })
      } else if (status === 404) {
        setFormError('This role has been deleted since you opened it.')
      } else {
        setFormError(message)
      }
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.roleName}` : 'Create a role'}
      description={
        <Typography variant="body2" color="text.secondary">
          {system
            ? 'This is one of the five built-in roles. Its name and status are fixed; the description can change.'
            : 'Roles are shared by every school on the platform. A custom role can hold school staff moved into it from the Users screen.'}
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Create role'}
      busy={creating || updating}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="roleName"
        control={control}
        label="Name"
        required
        autoFocus={!system}
        disabled={system}
        slotProps={{ htmlInput: { maxLength: 50 } }}
        hint={system ? 'Built-in roles cannot be renamed' : 'Unique across the platform'}
      />
      <RHFTextField
        name="roleCode"
        control={control}
        label="Code"
        disabled={editing !== null}
        slotProps={{ htmlInput: { maxLength: 20 } }}
        hint={
          editing
            ? 'Fixed once the role exists'
            : 'Optional. Letters, digits and underscores; made from the name if left blank.'
        }
      />
      <RHFTextField
        name="description"
        control={control}
        label="Description"
        multiline
        minRows={2}
        autoFocus={system}
        slotProps={{ htmlInput: { maxLength: 255 } }}
      />
      {editing && (
        <Controller
          name="isActive"
          control={control}
          render={({ field, fieldState }) => (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                    disabled={system}
                  />
                }
                label="Active"
              />
              <Typography
                variant="caption"
                color={fieldState.error ? 'error' : 'text.secondary'}
                sx={{ mt: -1 }}
              >
                {fieldState.error?.message ??
                  (system
                    ? 'Built-in roles cannot be deactivated.'
                    : 'Refused while any active user holds the role, since they could no longer sign in.')}
              </Typography>
            </>
          )}
        />
      )}
    </FormDialog>
  )
}
