import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { getErrorMessage } from '@/lib/serverErrors'
import { MODULES, PERMISSION_ACTIONS, ROLE_IDS } from '@/types/enums'
import type { ModuleName } from '@/types/enums'
import { toastSuccess } from '@/ui/uiSlice'
import { MODULE_NOTES } from '../moduleNotes'
import type { Enforcement } from '../moduleNotes'
import { ACTION_KEY, changedRows, setAll, toggle, toGrid } from '../permissionGrid'
import type { Grid, GridRow } from '../permissionGrid'
import { useSaveRolePermissionsMutation } from '../rolesApi'
import type { Role } from '../types'

const ENFORCEMENT_CHIP: Record<
  Enforcement,
  { label: string; color: 'success' | 'warning' | 'default' }
> = {
  grid: { label: 'Grid decides', color: 'success' },
  partial: { label: 'Grid + role', color: 'warning' },
  role: { label: 'UI only', color: 'default' },
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

interface PermissionGridEditorProps {
  role: Role
  /** False for a viewer without the right to save, and always for the SuperAdmin role. */
  editable: boolean
}

/**
 * The 15 × 4 grid for one role.
 *
 * Edits are a local draft until Save, which sends only the modules that changed through
 * `PUT /roles/{id}/permissions/bulk`. The parent keys this component on the saved grid, so a
 * save (which refetches the role) starts a fresh draft from the server's answer -- including
 * after a partial failure, where the server stops at the first refused module.
 *
 * **Where a tick does nothing.** Each module carries a chip saying how far the API honours
 * its row; see `moduleNotes.ts`. The row matters to the app either way, because menus and
 * buttons read it, so a "UI only" tick is not useless -- it is just not a security control.
 *
 * **When it applies.** The server authorises from the permission claims in the access token,
 * which are re-read at sign-in and at every token refresh. A signed-in holder of the role
 * keeps the old grid until their token next refreshes (the configured lifetime is an hour)
 * or they sign in again.
 */
export function PermissionGridEditor({ role, editable }: PermissionGridEditorProps) {
  const dispatch = useAppDispatch()
  const saved = useMemo(() => toGrid(role.permissions), [role.permissions])
  const [draft, setDraft] = useState<Grid>(saved)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savePermissions, { isLoading: saving }] = useSaveRolePermissionsMutation()

  const changes = useMemo(() => changedRows(saved, draft), [saved, draft])
  const dirty = changes.length > 0

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  const update = (module: ModuleName, next: GridRow) =>
    setDraft((current) => ({ ...current, [module]: next }))

  const handleSave = async () => {
    setSaveError(null)
    try {
      await savePermissions({ roleId: role.id, body: changes }).unwrap()
      dispatch(toastSuccess(`${role.roleName}: ${plural(changes.length, 'module')} saved.`))
    } catch (caught) {
      setSaveError(getErrorMessage(caught, 'Could not save the permissions.'))
    }
  }

  return (
    <Stack spacing={2}>
      {role.id === ROLE_IDS.SuperAdmin ? (
        <Alert severity="info">
          The SuperAdmin passes every permission check whatever this grid says, so it is shown
          for reference and cannot be changed.
        </Alert>
      ) : (
        <Alert severity="info">
          Users who hold this role and are signed in keep their current access until their
          session next refreshes (within the hour) or they sign in again.
        </Alert>
      )}

      {saveError && <Alert severity="error">{saveError}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={`Permissions of ${role.roleName}`}>
          <TableHead>
            <TableRow>
              <TableCell>Module</TableCell>
              <TableCell>Enforced by</TableCell>
              {PERMISSION_ACTIONS.map((action) => (
                <TableCell key={action} align="center">
                  {action}
                </TableCell>
              ))}
              <TableCell align="center">All</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {MODULES.map((module) => {
              const row = draft[module]
              const info = MODULE_NOTES[module]
              const chip = ENFORCEMENT_CHIP[info.enforcement]
              const all = PERMISSION_ACTIONS.every((action) => row[ACTION_KEY[action]])
              const some = PERMISSION_ACTIONS.some((action) => row[ACTION_KEY[action]])
              const changed = changes.some((c) => c.moduleName === module)
              return (
                <TableRow key={module} sx={changed ? { bgcolor: 'action.selected' } : undefined}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {info.label}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {info.note ? (
                      <Tooltip title={info.note}>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={chip.color}
                          label={chip.label}
                          icon={<InfoOutlinedIcon />}
                          aria-label={`${chip.label}: ${info.note}`}
                        />
                      </Tooltip>
                    ) : (
                      <Chip size="small" variant="outlined" color={chip.color} label={chip.label} />
                    )}
                  </TableCell>
                  {PERMISSION_ACTIONS.map((action) => (
                    <TableCell key={action} align="center" padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={row[ACTION_KEY[action]]}
                        disabled={!editable || saving}
                        onChange={(event) =>
                          update(module, toggle(row, action, event.target.checked))
                        }
                        slotProps={{ input: { 'aria-label': `${info.label}: ${action}` } }}
                      />
                    </TableCell>
                  ))}
                  <TableCell align="center" padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={all}
                      indeterminate={some && !all}
                      disabled={!editable || saving}
                      onChange={(event) => update(module, setAll(event.target.checked))}
                      slotProps={{ input: { 'aria-label': `${info.label}: all four` } }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary">
        Create, Edit and Delete each include View. “Grid + role”: the API also checks the user’s
        role, so a tick can open nothing for some roles; hover the chip for which. “UI only”: the
        API ignores the row, which only decides what the app shows.
      </Typography>

      {editable && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button disabled={!dirty || saving} onClick={() => setDraft(saved)}>
            Discard changes
          </Button>
          <Button variant="contained" disabled={!dirty || saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : dirty ? `Save ${plural(changes.length, 'module')}` : 'Saved'}
          </Button>
        </Box>
      )}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        message={`${plural(changes.length, 'module')} of ${role.roleName} changed and not saved.`}
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </Stack>
  )
}
