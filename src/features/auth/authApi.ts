import { baseApi } from '@/app/baseApi'
import type {
  ChangePasswordRequest,
  CurrentUserInfo,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  RolePermission,
} from './types'

/**
 * AuthController + the one open endpoint on RolesController.
 *
 * These endpoints intentionally do not dispatch into authSlice themselves; the
 * screens do, so that the order of "store the session" and "navigate" stays visible
 * where it matters.
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** POST /api/auth/login */
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),

    /** POST /api/auth/logout -- revokes the refresh token server-side. */
    logout: build.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),

    /** POST /api/auth/change-password. Returns no token; see passwordChangeSatisfied. */
    changePassword: build.mutation<void, ChangePasswordRequest>({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
    }),

    /** POST /api/auth/reset-password -- Admin/SuperAdmin, scoped to their school. */
    resetPassword: build.mutation<void, ResetPasswordRequest>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),

    /**
     * GET /api/auth/me -- reads the token's own claims. Used to revalidate a session
     * restored from localStorage: if the token is dead, this 401s, the refresh runs,
     * and a failed refresh logs out before any screen renders stale data.
     */
    getCurrentUser: build.query<CurrentUserInfo, void>({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),

    /**
     * GET /api/roles/my-permissions -- the live grid, deliberately unguarded on the
     * server: everyone may ask what they themselves can do.
     */
    getMyPermissions: build.query<RolePermission[], void>({
      query: () => '/roles/my-permissions',
      providesTags: ['Permission'],
    }),
  }),
})

export const {
  useLoginMutation,
  useLogoutMutation,
  useChangePasswordMutation,
  useResetPasswordMutation,
  useGetCurrentUserQuery,
  useGetMyPermissionsQuery,
} = authApi
