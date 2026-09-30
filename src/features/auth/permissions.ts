import { useAppSelector } from '@/app/hooks'
import type { RootState } from '@/app/store'
import { ROLES } from '@/types/enums'
import type { ModuleName, PermissionAction } from '@/types/enums'
import type { PermissionFlags, SessionUser } from './types'

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export const selectAccessToken = (s: RootState): string | null => s.auth.accessToken
export const selectRefreshToken = (s: RootState): string | null => s.auth.refreshToken
export const selectCurrentUser = (s: RootState): SessionUser | null => s.auth.user
export const selectIsBootstrapped = (s: RootState): boolean => s.auth.bootstrapped

export const selectIsAuthenticated = (s: RootState): boolean =>
  Boolean(s.auth.accessToken && s.auth.user)

/** True while the user is held on the forced password-change screen. */
export const selectMustChangePassword = (s: RootState): boolean =>
  s.auth.user?.requirePasswordChange === true

export const selectIsSuperAdmin = (s: RootState): boolean =>
  s.auth.user?.role === ROLES.SuperAdmin

export const selectRoleName = (s: RootState): string | null => s.auth.user?.role ?? null

const ACTION_KEY = {
  View: 'canView',
  Create: 'canCreate',
  Edit: 'canEdit',
  Delete: 'canDelete',
} as const satisfies Record<PermissionAction, keyof PermissionFlags>

/**
 * The one permission check in the app.
 *
 * Denies by default: a module the server never sent has no entry, and the server
 * treats an absent module as denied. Reproducing that default here is what keeps the
 * UI from offering actions the API will refuse.
 */
export function can(state: RootState, module: ModuleName, action: PermissionAction): boolean {
  const flags = state.auth.permissions[module]
  if (!flags) return false
  return flags[ACTION_KEY[action]]
}

/** All four flags for a module, for screens that need more than one at a time. */
export function permissionsFor(state: RootState, module: ModuleName): PermissionFlags {
  return (
    state.auth.permissions[module] ?? {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    }
  )
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                       */
/* -------------------------------------------------------------------------- */

/** `const canEdit = useCan('Students', 'Edit')` */
export function useCan(module: ModuleName, action: PermissionAction): boolean {
  return useAppSelector((s) => can(s, module, action))
}

/** `const { canCreate, canDelete } = useModulePermissions('Fees')` */
export function useModulePermissions(module: ModuleName): PermissionFlags {
  return useAppSelector((s) => permissionsFor(s, module))
}

export function useCurrentUser(): SessionUser | null {
  return useAppSelector(selectCurrentUser)
}

export function useIsSuperAdmin(): boolean {
  return useAppSelector(selectIsSuperAdmin)
}

/** Display name, falling back to the username when the person record has no name. */
export function displayName(user: SessionUser | null): string {
  if (!user) return ''
  const full = `${user.firstName} ${user.lastName}`.trim()
  return full || user.username
}

/** Initials for the avatar. */
export function initialsOf(user: SessionUser | null): string {
  if (!user) return '?'
  const first = user.firstName?.charAt(0) ?? ''
  const last = user.lastName?.charAt(0) ?? ''
  const initials = `${first}${last}`.trim()
  return (initials || user.username.charAt(0)).toUpperCase()
}
