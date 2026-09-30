import type { RolePermission } from '@/features/auth/types'

/**
 * DTOs/Roles/RoleDTO.cs.
 *
 * Roles are **global**, not per-school: there is no school in any RolesController route,
 * because one set of roles serves the whole platform. `userCount` is therefore a count
 * across every tenant, and is the one field on here a school admin cannot act on.
 *
 * Defined in Phase 8, for the Users screen's role-change dialog; Phase 14 added the write
 * payloads below.
 */
export interface Role {
  id: number
  roleName: string
  roleCode: string
  description: string | null
  /** The five seeded roles. They cannot be renamed or deleted. */
  isSystemRole: boolean
  isActive: boolean
  /** Across all schools, since roles are global. Returned by the list endpoint. */
  userCount: number
  /** Modules the role can see (active row with CanView). Both endpoints, since Phase 14. */
  moduleCount: number
  createdBy: number | null
  createdByUsername: string | null
  modifiedBy: number | null
  modifiedByUsername: string | null
  createdAt: string
  updatedAt: string
  /** Populated by `GET /api/Roles/{roleId}` only; empty on the list. */
  permissions: RolePermission[]
}

/** DTOs/Roles/RoleCreateDTO.cs. The starting grid is left out: the editor saves it after. */
export interface RoleCreatePayload {
  roleName: string
  /** Letters, digits and underscores. Derived from the name when null. */
  roleCode: string | null
  description: string | null
}

/**
 * DTOs/Roles/RoleUpdateDTO.cs. `roleName` is always sent -- the DTO requires it -- and resending
 * a system role's own name is not a rename (§7.58). An empty `description` clears it.
 */
export interface RoleUpdatePayload {
  roleName: string
  description: string
  isActive: boolean
}

/** DTOs/Roles/RolePermissionSaveDTO.cs -- one module's four flags. */
export interface RolePermissionSave {
  moduleName: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  isActive: boolean
}
