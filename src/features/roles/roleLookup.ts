import type { SelectOption } from '@/components/form/RHFSelect'
import { ROLE_IDS } from '@/types/enums'
import { useGetRolesQuery } from './rolesApi'
import type { Role } from './types'

/**
 * The role list for a picker, in two forms: every active role, and the subset a user can
 * actually be moved into.
 *
 * Modelled on `features/classes/classLookup.ts`, minus the pagination -- `GET /api/Roles`
 * returns the lot in one array, because a platform has a handful of roles and not a page of
 * them.
 */
export interface RoleLookup {
  /** Every active role, for labelling a user's current role. */
  roles: Role[]
  /** Options for the role-change dialog: only roles `sp_ChangeUserRole` will accept. */
  assignableOptions: SelectOption[]
  isLoading: boolean
}

/**
 * Roles no user can be **moved into**, and why. Each of these is a refusal
 * `sp_ChangeUserRole` returns, so offering them would only let an admin discover the rule
 * by hitting it:
 *
 *  - SuperAdmin (1) -- "SuperAdmin cannot be assigned to a school user." `CK_Users_SchoolScope`
 *    requires `SchoolId IS NULL` for role 1, and this procedure is school-scoped.
 *  - Teacher (3), Student (4), Parent (5) -- "Use the student, teacher or parent registration
 *    procedure to create those accounts." Those roles carry a row in `Teachers` / `Students` /
 *    `Parents` keyed on the user, and a role change does not create one.
 *
 * What is left is Admin (2) and the custom roles, which is the whole point of the endpoint:
 * promoting a member of staff to an admin, or into a role a school defined for itself.
 */
const UNASSIGNABLE_ROLE_IDS: readonly number[] = [
  ROLE_IDS.SuperAdmin,
  ROLE_IDS.Teacher,
  ROLE_IDS.Student,
  ROLE_IDS.Parent,
]

export function isAssignableRole(role: Role): boolean {
  return role.isActive && !UNASSIGNABLE_ROLE_IDS.includes(role.id)
}

/**
 * The mirror of the rule above: roles whose **holders** cannot be moved, rather than roles
 * nobody can be moved into.
 *
 * `sp_ChangeUserRole` refuses in both directions for Teacher, Student and Parent, and for the
 * same reason -- the role is implied by the `Teachers` / `Students` / `Parents` row keyed on
 * the user, and moving the login alone would leave the two disagreeing. The remedy the
 * procedure names is to deactivate the account and register the person afresh.
 *
 * Lives here rather than in `features/users` so both halves of one database rule are stated in
 * one place.
 */
const IMMOVABLE_ROLE_IDS: readonly number[] = [ROLE_IDS.Teacher, ROLE_IDS.Student, ROLE_IDS.Parent]

export function canChangeRole(user: { roleId: number }): boolean {
  return !IMMOVABLE_ROLE_IDS.includes(user.roleId)
}

/**
 * `skip` mirrors RTK Query's own option. Pass `skip: true` for a caller without
 * `Roles:View` -- the endpoint would 403, and the seeded Teacher, Student and Parent roles
 * hold no `Roles` row at all.
 */
export function useRoleLookup(options?: { skip?: boolean }): RoleLookup {
  const { data, isLoading } = useGetRolesQuery(undefined, { skip: options?.skip ?? false })

  const roles = data ?? []

  return {
    roles,
    assignableOptions: roles.filter(isAssignableRole).map((role) => ({
      value: role.id,
      label: role.isSystemRole ? role.roleName : `${role.roleName} (custom)`,
    })),
    isLoading,
  }
}
