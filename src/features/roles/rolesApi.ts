import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  Role,
  RoleCreatePayload,
  RolePermissionSave,
  RoleUpdatePayload,
} from './types'

/**
 * RolesController.
 *
 * **Reads are the grid; writes are the SuperAdmin.** `GET /roles` and `GET /roles/{id}` are
 * `[RequiresPermission(Roles, View)]`, which the seeded Admin holds -- the Users screen's
 * role-change dialog depends on that. Every write is also `SuperAdminOnly` since Phase 14,
 * because roles are global and a school admin holding `Roles:Edit` could otherwise rewrite
 * every school's grid (§7.58).
 *
 * Not wrapped: `GET /roles/modules` (the same list as `MODULES` in `types/enums`),
 * `GET /roles/{id}/permissions` (the detail read already carries the grid), and the single-row
 * `PUT` and `DELETE /roles/{id}/permissions/...` -- the editor saves through `/bulk`.
 */
export const rolesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Roles -- every role, with how many users hold it.
     *
     * `includeInactive` defaults to false server-side. Left out of the request rather than
     * sent as false, so the query key stays stable for the common case.
     */
    getRoles: build.query<Role[], { includeInactive?: boolean } | void>({
      query: (params) => ({
        url: '/roles',
        params: params?.includeInactive ? { includeInactive: true } : undefined,
      }),
      providesTags: (result) => [
        { type: 'Role' as const, id: LIST_ID },
        ...(result ?? []).map((role) => ({ type: 'Role' as const, id: role.id })),
      ],
    }),

    /** GET /api/Roles/{roleId} -- one role and its grid. 404 for an unknown id. */
    getRole: build.query<Role, number>({
      query: (roleId) => `/roles/${roleId}`,
      providesTags: (_result, _error, roleId) => [{ type: 'Role' as const, id: roleId }],
    }),

    /** POST /api/Roles -- answers `{ roleId }`. 409 when the name or code is taken. */
    createRole: build.mutation<{ roleId: number }, RoleCreatePayload>({
      query: (body) => ({ url: '/roles', method: 'POST', body }),
      invalidatesTags: [{ type: 'Role', id: LIST_ID }],
    }),

    /** PUT /api/Roles/{roleId}. 400 for a system-role rename or deactivation. */
    updateRole: build.mutation<void, { roleId: number; body: RoleUpdatePayload }>({
      query: ({ roleId, body }) => ({ url: `/roles/${roleId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { roleId }) => [
        { type: 'Role', id: roleId },
        { type: 'Role', id: LIST_ID },
      ],
    }),

    /** DELETE /api/Roles/{roleId}. 409 while any user, active or not, holds it. */
    deleteRole: build.mutation<void, number>({
      query: (roleId) => ({ url: `/roles/${roleId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, roleId) => [
        { type: 'Role', id: roleId },
        { type: 'Role', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Roles/{roleId}/permissions/bulk -- one row per module sent. Not a transaction:
     * the server stops at the first refusal and says how many were applied, so the role is
     * refetched on failure as well as success.
     */
    saveRolePermissions: build.mutation<void, { roleId: number; body: RolePermissionSave[] }>({
      query: ({ roleId, body }) => ({
        url: `/roles/${roleId}/permissions/bulk`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { roleId }) => [
        { type: 'Role', id: roleId },
        { type: 'Role', id: LIST_ID },
      ],
    }),
  }),
})

export const {
  useGetRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useSaveRolePermissionsMutation,
} = rolesApi
