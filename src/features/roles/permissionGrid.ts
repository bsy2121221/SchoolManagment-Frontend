import { MODULES, PERMISSION_ACTIONS } from '@/types/enums'
import type { ModuleName, PermissionAction } from '@/types/enums'
import type { RolePermission } from '@/features/auth/types'
import type { Role, RolePermissionSave } from './types'

export interface GridRow {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

export type Grid = Record<ModuleName, GridRow>

export const ACTION_KEY = {
  View: 'canView',
  Create: 'canCreate',
  Edit: 'canEdit',
  Delete: 'canDelete',
} as const satisfies Record<PermissionAction, keyof GridRow>

const NONE: GridRow = { canView: false, canCreate: false, canEdit: false, canDelete: false }

/**
 * The server's rows as a full 15-module grid. A module with no row, or an inactive one, is
 * shown unticked -- both deny -- and a row for a name outside `MODULES` is dropped, as the
 * session's permission map drops it.
 */
export function toGrid(rows: readonly RolePermission[]): Grid {
  const grid = Object.fromEntries(MODULES.map((m) => [m, { ...NONE }])) as Grid
  for (const row of rows) {
    const module = MODULES.find((m) => m === row.moduleName)
    if (!module || !row.isActive) continue
    grid[module] = {
      canView: row.canView,
      canCreate: row.canCreate,
      canEdit: row.canEdit,
      canDelete: row.canDelete,
    }
  }
  return grid
}

/**
 * Toggle one cell, keeping the rule `sp_SaveRolePermission` enforces: create, edit or delete
 * implies view. Ticking one of those ticks View; unticking View clears the other three --
 * the alternative is a row the server silently turns back on.
 */
export function toggle(row: GridRow, action: PermissionAction, on: boolean): GridRow {
  if (action === 'View') return on ? { ...row, canView: true } : { ...NONE }
  return { ...row, [ACTION_KEY[action]]: on, ...(on ? { canView: true } : {}) }
}

export function setAll(on: boolean): GridRow {
  return on ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : { ...NONE }
}

const same = (a: GridRow, b: GridRow) =>
  PERMISSION_ACTIONS.every((action) => a[ACTION_KEY[action]] === b[ACTION_KEY[action]])

/**
 * The rows to send: only modules that differ from what was loaded. Sending all fifteen would
 * write an all-off row for every module never configured, which denies exactly as no row
 * does but makes every save touch every module in the audit log.
 */
export function changedRows(saved: Grid, draft: Grid): RolePermissionSave[] {
  return MODULES.filter((m) => !same(saved[m], draft[m])).map((m) => ({
    moduleName: m,
    ...draft[m],
    isActive: true,
  }))
}

/** Why a role cannot be deleted, or null if it can. */
export function deleteBlockedReason(role: Role): string | null {
  if (role.isSystemRole) return 'Built-in roles cannot be deleted'
  if (role.userCount > 0) {
    return `${role.userCount} user${role.userCount === 1 ? ' holds' : 's hold'} this role (inactive accounts included). Move them to another role first.`
  }
  return null
}
