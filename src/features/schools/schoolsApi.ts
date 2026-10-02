import { baseApi } from '@/app/baseApi'
import { LIST_ID, TAG_TYPES } from '@/app/tags'
import { schoolScopeChanged } from '@/features/auth/authSlice'
import type { PaginatedResponse } from '@/types/api'
import type {
  PlatformStats,
  School,
  SchoolAdminPayload,
  SchoolAdminResult,
  SchoolBranding,
  SchoolCreatePayload,
  SchoolCreateResult,
  SchoolListQuery,
  SchoolRow,
  SchoolSession,
  SchoolUpdatePayload,
  SchoolUsageRow,
} from './types'

/**
 * SchoolsController -- all fourteen endpoints.
 *
 * Authorisation here is two-layered, and the difference shows up in the UI:
 *
 *   * The `Schools` permission grid decides whether the caller may read or write
 *     schools at all. The seed gives a school Admin **view and edit but not create
 *     or delete** -- which is exactly "may see and maintain my own school".
 *   * Cross-tenant actions (the list, platform stats, the usage report, suspending a
 *     tenant, switching into one) additionally require the SuperAdmin *role*,
 *     because `Schools:View` alone is held by every school admin.
 *
 * So a screen guarded on the grid alone is not enough for the platform screens:
 * they need `RequireRole([SuperAdmin])` too, the same way Roles does.
 *
 * Tag strategy: reads provide `School` for their id or for the list; writes
 * invalidate the list plus the affected id. Onboarding and suspension also
 * invalidate `Platform`, because both move the totals on the landing page.
 */
export const schoolsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* ---------------------------------------------------------------------- */
    /* Reads                                                                   */
    /* ---------------------------------------------------------------------- */

    /** GET /api/Schools -- paginated tenant list with counts. SuperAdmin only. */
    getSchools: build.query<PaginatedResponse<SchoolRow>, SchoolListQuery>({
      query: (params) => ({ url: '/schools', params }),
      providesTags: (result) => [
        { type: 'School' as const, id: LIST_ID },
        ...(result?.items ?? []).map((row) => ({ type: 'School' as const, id: row.id })),
      ],
    }),

    /**
     * GET /api/Schools/current -- the caller's own school, with no id in the URL, so
     * it cannot be pointed at another tenant. This is what a school admin's settings
     * screen reads.
     *
     * 404 for a SuperAdmin who is not currently acting inside a school: they have no
     * "own school" to return. MySchoolPage treats that as a state, not an error.
     */
    getCurrentSchool: build.query<School, void>({
      query: () => '/schools/current',
      providesTags: (result) =>
        result ? [{ type: 'School', id: result.id }] : [{ type: 'School', id: 'CURRENT' }],
    }),

    /** GET /api/Schools/platform-stats -- totals across every tenant. SuperAdmin only. */
    getPlatformStats: build.query<PlatformStats, void>({
      query: () => '/schools/platform-stats',
      providesTags: [{ type: 'Platform', id: 'STATS' }],
    }),

    /**
     * GET /api/Schools/usage-report -- per-tenant activity over a window, defaulting
     * to the last 30 days. SuperAdmin only. Not paginated: one row per tenant.
     *
     * Dates go on the query string as ISO strings; the API rejects fromDate > toDate
     * with a 400 rather than silently returning nothing.
     */
    getUsageReport: build.query<SchoolUsageRow[], { fromDate?: string; toDate?: string } | void>({
      query: (args) => ({
        url: '/schools/usage-report',
        params: args ? { fromDate: args.fromDate, toDate: args.toDate } : undefined,
      }),
      providesTags: [{ type: 'Platform', id: 'USAGE' }],
    }),

    /**
     * GET /api/Schools/branding -- anonymous, by id or code. Intended for theming a
     * login page before anyone has signed in, which is why it returns `isActive`:
     * a suspended school can be named as suspended instead of letting its staff fail
     * authentication with no explanation.
     */
    getSchoolBranding: build.query<SchoolBranding, { schoolId?: number; schoolCode?: string }>({
      query: (params) => ({ url: '/schools/branding', params }),
      providesTags: (result) =>
        result ? [{ type: 'School', id: result.schoolId }] : [],
    }),

    /** GET /api/Schools/by-subdomain/{subdomain} -- anonymous; resolves a wildcard host. */
    getSchoolBySubdomain: build.query<SchoolBranding, string>({
      query: (subdomain) => `/schools/by-subdomain/${encodeURIComponent(subdomain)}`,
      providesTags: (result) => (result ? [{ type: 'School', id: result.schoolId }] : []),
    }),

    /** GET /api/Schools/by-code/{schoolCode} -- the full record. SuperAdmin only. */
    getSchoolByCode: build.query<School, string>({
      query: (schoolCode) => `/schools/by-code/${encodeURIComponent(schoolCode)}`,
      providesTags: (result) => (result ? [{ type: 'School', id: result.id }] : []),
    }),

    /**
     * GET /api/Schools/{id}.
     *
     * A school admin may read only their own; any other id returns **404, not 403**,
     * so probing ids reveals nothing about which other tenants exist. A details page
     * therefore cannot distinguish "no such school" from "not yours" -- and should
     * not try to.
     */
    getSchool: build.query<School, number>({
      query: (schoolId) => `/schools/${schoolId}`,
      providesTags: (_result, _error, schoolId) => [{ type: 'School', id: schoolId }],
    }),

    /* ---------------------------------------------------------------------- */
    /* Writes                                                                  */
    /* ---------------------------------------------------------------------- */

    /**
     * POST /api/Schools -- onboarding. SuperAdmin + `Schools:Create`.
     *
     * Returns the sanitised code that was actually stored and the generated admin
     * username, neither of which the caller can predict. The result must be shown,
     * not swallowed by a success toast.
     */
    createSchool: build.mutation<SchoolCreateResult, SchoolCreatePayload>({
      query: (body) => ({ url: '/schools', method: 'POST', body }),
      invalidatesTags: [
        { type: 'School', id: LIST_ID },
        { type: 'Platform', id: 'STATS' },
        { type: 'Platform', id: 'USAGE' },
      ],
    }),

    /** PUT /api/Schools/{id} -- partial update. `Schools:Edit`; own school for an admin. */
    updateSchool: build.mutation<void, { schoolId: number; body: SchoolUpdatePayload }>({
      query: ({ schoolId, body }) => ({ url: `/schools/${schoolId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { schoolId }) => [
        { type: 'School', id: LIST_ID },
        { type: 'School', id: schoolId },
        { type: 'School', id: 'CURRENT' },
      ],
    }),

    /**
     * PUT /api/Schools/{id}/status -- suspend or restore. SuperAdmin only, and
     * deliberately not available to a school's own admin, who would be locking every
     * one of their own users out at once.
     *
     * Suspending also revokes the school's refresh tokens, so its staff are signed
     * out rather than lingering on valid tokens. Worth saying in the confirmation.
     */
    updateSchoolStatus: build.mutation<void, { schoolId: number; isActive: boolean }>({
      query: ({ schoolId, isActive }) => ({
        url: `/schools/${schoolId}/status`,
        method: 'PUT',
        body: { isActive },
      }),
      invalidatesTags: (_result, _error, { schoolId }) => [
        { type: 'School', id: LIST_ID },
        { type: 'School', id: schoolId },
        { type: 'Platform', id: 'STATS' },
      ],
    }),

    /**
     * POST /api/Schools/{id}/admins -- a further admin for an existing school.
     *
     * Needs `Schools:Create`, which the seeded Admin role does **not** hold, so in
     * practice this is a SuperAdmin action even though the endpoint has no role
     * guard. Returns the generated username (CODE_ADMIN2, ...).
     */
    createSchoolAdmin: build.mutation<
      SchoolAdminResult,
      { schoolId: number; body: SchoolAdminPayload }
    >({
      query: ({ schoolId, body }) => ({
        url: `/schools/${schoolId}/admins`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { schoolId }) => [
        { type: 'School', id: LIST_ID },
        { type: 'School', id: schoolId },
        { type: 'User', id: LIST_ID },
        { type: 'Platform', id: 'STATS' },
      ],
    }),

    /* ---------------------------------------------------------------------- */
    /* Tenant scope switching                                                  */
    /* ---------------------------------------------------------------------- */

    /**
     * POST /api/Schools/{id}/switch and POST /api/Schools/exit-switch.
     *
     * **Offered by one screen only: Settings.** The switch reissues the access token with
     * a `school_id`, but the tenant modules are guarded by `[Authorize(Roles = "Admin")]`
     * and the AdminOrTeacher / AllSchoolUsers policies, none of which name SuperAdmin. So a
     * switched platform administrator still gets 403 from Students, Classes, Teachers and
     * the rest, and no "manage this school" button exists. SettingsController and
     * DashboardController are grid-only, which makes them the two places a switch is
     * useful, and the Settings page is where the school picker is.
     *
     * These return a bare access token rather than a LoginResponse, so `onQueryStarted`
     * stores it through `schoolScopeChanged`, which replaces the token and the school fields
     * and leaves the refresh token and the grid alone. Every cached read was fetched for
     * the old scope, so every tag is invalidated **after** the new token is in the store.
     * Invalidating through `invalidatesTags` instead could refetch with the old token still
     * in place.
     */
    switchSchool: build.mutation<SchoolSession, number>({
      query: (schoolId) => ({ url: `/schools/${schoolId}/switch`, method: 'POST' }),
      onQueryStarted: async (_schoolId, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          dispatch(schoolScopeChanged(data))
          dispatch(baseApi.util.invalidateTags([...TAG_TYPES]))
        } catch {
          // The caller's unwrap() reports the failure. The scope is unchanged.
        }
      },
    }),

    exitSchoolSwitch: build.mutation<SchoolSession, void>({
      query: () => ({ url: '/schools/exit-switch', method: 'POST' }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          dispatch(schoolScopeChanged(data))
          dispatch(baseApi.util.invalidateTags([...TAG_TYPES]))
        } catch {
          // The caller's unwrap() reports the failure. The scope is unchanged.
        }
      },
    }),
  }),
})

export const {
  useGetSchoolsQuery,
  useGetCurrentSchoolQuery,
  useGetPlatformStatsQuery,
  useGetUsageReportQuery,
  useGetSchoolBrandingQuery,
  useGetSchoolBySubdomainQuery,
  useGetSchoolByCodeQuery,
  useGetSchoolQuery,
  useCreateSchoolMutation,
  useUpdateSchoolMutation,
  useUpdateSchoolStatusMutation,
  useCreateSchoolAdminMutation,
  useSwitchSchoolMutation,
  useExitSchoolSwitchMutation,
} = schoolsApi
