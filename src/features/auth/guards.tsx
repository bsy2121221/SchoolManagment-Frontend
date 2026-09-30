import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import type { ModuleName, PermissionAction } from '@/types/enums'
import { useGetCurrentUserQuery } from './authApi'
import {
  selectIsAuthenticated,
  selectIsBootstrapped,
  selectMustChangePassword,
  selectRoleName,
  useCan,
} from './permissions'

export const CHANGE_PASSWORD_PATH = '/change-password'
export const LOGIN_PATH = '/login'

/**
 * Layout route that requires a session.
 *
 * Also enforces the forced password change. That is not an edge case here: teachers,
 * students and parents are all created with Temp@123 and RequirePasswordChange set, so
 * this is the normal first-login path for most of the user base.
 */
export function RequireAuth() {
  const location = useLocation()
  const bootstrapped = useAppSelector(selectIsBootstrapped)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const mustChangePassword = useAppSelector(selectMustChangePassword)

  // Revalidate a session restored from localStorage. If the access token died while
  // the tab was closed, this 401s, baseApi refreshes it, and an unrecoverable refresh
  // dispatches loggedOut -- so we never render a screen against a dead session.
  useGetCurrentUserQuery(undefined, { skip: !isAuthenticated })

  if (!bootstrapped) return <FullPageLoader />

  if (!isAuthenticated) {
    // Remember where they were headed so login can return them there.
    return <Navigate to={LOGIN_PATH} replace state={{ from: location }} />
  }

  if (mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }

  return <Outlet />
}

/** Inverse of RequireAuth: keeps a signed-in user off the login page. */
export function RequireAnonymous() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const mustChangePassword = useAppSelector(selectMustChangePassword)

  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? CHANGE_PASSWORD_PATH : '/'} replace />
  }
  return <Outlet />
}

interface RequirePermissionProps {
  module: ModuleName
  /** Defaults to View, which is what guarding a route almost always means. */
  action?: PermissionAction
  children?: ReactNode
}

/**
 * Route guard for a module permission. Redirects to /forbidden rather than rendering
 * nothing, so a bookmarked URL explains itself instead of showing a blank page.
 */
export function RequirePermission({ module, action = 'View', children }: RequirePermissionProps) {
  const allowed = useCan(module, action)
  if (!allowed) return <Navigate to="/forbidden" replace state={{ module, action }} />
  return <>{children ?? <Outlet />}</>
}

interface RequireRoleProps {
  roles: readonly string[]
  children?: ReactNode
}

/**
 * Route guard on the role name.
 *
 * Needed alongside RequirePermission because some controllers gate on the role
 * directly and ignore the grid -- RolesController is `[Authorize(Roles="SuperAdmin")]`
 * at the class level, so a school admin holding Roles:View still gets a 403. Guarding
 * on the grid alone there would offer a screen that cannot load.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const role = useAppSelector(selectRoleName)
  if (!role || !roles.includes(role)) {
    return <Navigate to="/forbidden" replace state={{ roles }} />
  }
  return <>{children ?? <Outlet />}</>
}
