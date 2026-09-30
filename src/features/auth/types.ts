import type { ModuleName, RoleName } from '@/types/enums'

/** DTOs/Roles/RolePermissionDTO.cs */
export interface RolePermission {
  id: number
  roleId: number
  roleName: string | null
  moduleName: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  isActive: boolean
  updatedAt: string
}

/** DTOs/Auth/LoginRequestDTO.cs */
export interface LoginRequest {
  username: string
  password: string
}

/**
 * DTOs/Auth/LoginResponseDTO.cs
 *
 * Returned by BOTH /auth/login and /auth/refresh-token, which is why a token renewal
 * also refreshes the permission grid for free.
 */
export interface LoginResponse {
  userId: number
  username: string
  email: string
  firstName: string
  lastName: string
  role: string
  roleId: number
  schoolId: number | null
  schoolCode: string | null
  schoolName: string | null
  requirePasswordChange: boolean
  accessToken: string
  refreshToken: string
  /** Seconds until accessToken expires (Constants.Settings.AccessTokenExpiryMinutes = 60). */
  expiresIn: number
  /** A module absent from this list is denied. */
  permissions: RolePermission[]
}

/** DTOs/Auth/ChangePasswordRequestDTO.cs */
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * DTOs/Auth/ResetPasswordRequestDTO.cs -- Admin/SuperAdmin only.
 *
 * `requirePasswordChange` defaults to **true** server-side, so omitting it forces the user
 * onto the change-password screen at their next sign-in. That is the right default for a
 * password an admin chose and then has to pass on out of band; send false only when the
 * admin is setting a password the user already knows.
 */
export interface ResetPasswordRequest {
  userId: number
  newPassword: string
  requirePasswordChange?: boolean
}

/** Shape returned by GET /auth/me, built inline in AuthController. */
export interface CurrentUserInfo {
  userId: number | null
  username: string | null
  role: string | null
  roleId: number | null
  schoolId: number | null
  schoolCode: string | null
  isSuperAdmin: boolean
  permissions: Array<
    Pick<RolePermission, 'moduleName' | 'canView' | 'canCreate' | 'canEdit' | 'canDelete'>
  >
}

/* -------------------------------------------------------------------------- */
/* Client-side session shape                                                   */
/* -------------------------------------------------------------------------- */

/** The identity half of LoginResponse, without the tokens or the grid. */
export interface SessionUser {
  userId: number
  username: string
  email: string
  firstName: string
  lastName: string
  role: string
  roleId: number
  schoolId: number | null
  schoolCode: string | null
  schoolName: string | null
  requirePasswordChange: boolean
}

/** One module's four flags, stripped of the server bookkeeping fields. */
export interface PermissionFlags {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * The grid, normalised by module name for O(1) lookup -- a permission check runs on
 * nearly every render, so scanning a 15-element array each time is waste.
 *
 * Partial: a missing key means denied, which is exactly the server's rule.
 */
export type PermissionMap = Partial<Record<ModuleName, PermissionFlags>>

export interface AuthState {
  user: SessionUser | null
  accessToken: string | null
  refreshToken: string | null
  permissions: PermissionMap
  /** True once localStorage has been read, so guards don't redirect on first paint. */
  bootstrapped: boolean
}

/** Narrowing helper: is this session the platform SuperAdmin? */
export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.role === ('SuperAdmin' satisfies RoleName)
}
