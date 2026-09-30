import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type { ResetPasswordRequest } from '@/features/auth/types'
import type { PageQuery, PaginatedResponse } from '@/types/api'
import type { UserRolePayload, UserRow, UserUpdatePayload } from './types'

/** Query string for `GET /api/Users`. `pageSize` is clamped to 100 server-side. */
export interface UserListQuery extends PageQuery {
  /** Role name or code -- "Teacher", "TEACHER". Prefer `roleId`. */
  role?: string
  /** `Roles.Id`. Sending both narrows to their intersection, so send one or neither. */
  roleId?: number
  isActive?: boolean
  /** Matched across first name, last name, username and email. */
  searchTerm?: string
}

/**
 * UsersController -- all nine endpoints, plus the one admin action that lives on
 * AuthController because it touches a password.
 *
 * `FRONTEND_PLAN.md` promised eight; the controller has nine. The extra one is
 * `GET /users/{id}`, which the details screen is built on.
 *
 * Cross-module invalidations matter more here than anywhere else, because this module writes
 * the row the other modules read their identity from:
 *
 *  - `Student` / `Teacher` / `Parent` -- a status change, a delete or a profile edit all
 *    reach their role-specific row, so their lists and profiles are stale afterwards.
 *  - `Auth` and `Permission` -- a role change revokes the user's refresh tokens and hands
 *    them a different grid at their next sign-in.
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Users -- `Users:View`. Paginated, filterable and searchable, all server-side.
     *
     * The only list in the app that shows every kind of account side by side, and the only
     * one that shows deactivated records by choice rather than by accident.
     */
    getUsers: build.query<PaginatedResponse<UserRow>, UserListQuery>({
      query: (params) => ({ url: '/users', params }),
      providesTags: (result) => [
        { type: 'User' as const, id: LIST_ID },
        ...(result?.items ?? []).map((row) => ({ type: 'User' as const, id: row.id })),
      ],
    }),

    /**
     * GET /api/Users/{userId} -- **Admin or self**, checked by `CanAccessUser` rather than by
     * the permission grid. So a teacher can open their own account row and nobody else's.
     *
     * Unlike `sp_UpdateUser`, the read has no `IsActive` filter: a deactivated account does
     * open here, which is what makes reactivating one from the UI possible.
     */
    getUser: build.query<UserRow, number>({
      query: (userId) => `/users/${userId}`,
      providesTags: (_result, _error, userId) => [{ type: 'User', id: userId }],
    }),

    /**
     * PUT /api/Users/{userId} -- Admin or self. Writes `Users`, `Persons` and the primary
     * `Addresses` row in one transaction.
     *
     * `sp_UpdateUser` requires `IsActive = 1` and answers "User not found" otherwise, so a
     * deactivated account has to be reactivated before it can be edited. The other refusal is
     * "Email already exists", and the two have nothing in common -- which is why the server
     * repair in this phase was to stop collapsing them into "Failed to update user".
     */
    updateUser: build.mutation<void, { userId: number; body: UserUpdatePayload }>({
      query: ({ userId, body }) => ({ url: `/users/${userId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'User', id: LIST_ID },
        { type: 'User', id: userId },
        { type: 'Student', id: LIST_ID },
        { type: 'Teacher', id: LIST_ID },
        { type: 'Parent', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Users/{userId}/status -- `Users:Edit`.
     *
     * **`isActive: true` is the only reactivation path in the entire API.** DELETE on
     * Students, Teachers, Parents and Users all deactivate, and none of those modules offers
     * a way back; `sp_ToggleUserStatus` restores the login, the person row and the
     * Teachers/Students/Parents row together.
     *
     * What it does not restore: `StudentSubjects`, `TeacherSubjects`,
     * `TeacherSubjectAssignments`, `TeacherSchedule` and `StudentParents`. A delete switched
     * those off and they are re-established through their own modules. Reactivating a teacher
     * therefore gives them their login back and an empty timetable.
     *
     * Deactivating also revokes every live refresh token, so the user is signed out at once
     * rather than at their next hour boundary.
     */
    updateUserStatus: build.mutation<void, { userId: number; isActive: boolean }>({
      query: ({ userId, isActive }) => ({
        url: `/users/${userId}/status`,
        method: 'PUT',
        body: { isActive },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'User', id: LIST_ID },
        { type: 'User', id: userId },
        { type: 'Student', id: LIST_ID },
        { type: 'Teacher', id: LIST_ID },
        { type: 'Parent', id: LIST_ID },
        { type: 'Class', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Users/{userId}/role -- `Users:Edit`. An authorisation event, not a profile
     * edit: it revokes the user's refresh tokens, because their old JWT carries the old role
     * and the old permission grid until it expires.
     *
     * Four refusals, and `useRoleLookup` keeps the dialog from being able to trigger two of
     * them. The other two are "User not found in this school." and the one that matters --
     * students, teachers and parents cannot be reassigned, because their role is implied by
     * the row that owns them.
     */
    changeUserRole: build.mutation<void, { userId: number } & UserRolePayload>({
      query: ({ userId, roleId }) => ({
        url: `/users/${userId}/role`,
        method: 'PUT',
        body: { roleId },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'User', id: LIST_ID },
        { type: 'User', id: userId },
        { type: 'Role', id: LIST_ID },
        // Their grid changes, and if they are the signed-in user reading their own screen,
        // so does ours.
        'Permission',
        'Auth',
      ],
    }),

    /**
     * DELETE /api/Users/{userId} -- `Users:Delete`. A soft delete that cascades into
     * whichever role-specific rows the account owns.
     *
     * The most talkative procedure in the database: eight distinct refusals with eight
     * different remedies -- an admin at all, a teacher still class teacher of an active class,
     * a teacher with attendance history, a student with attendance, results or fees, a parent
     * with children still attached, and "User not found". Callers must show the message.
     *
     * Not one-way, unlike the equivalent on Students, Teachers and Parents: `updateUserStatus`
     * with `isActive: true` brings the account back.
     */
    deleteUser: build.mutation<void, number>({
      query: (userId) => ({ url: `/users/${userId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, userId) => [
        { type: 'User', id: LIST_ID },
        { type: 'User', id: userId },
        { type: 'Student', id: LIST_ID },
        { type: 'Teacher', id: LIST_ID },
        { type: 'Parent', id: LIST_ID },
        { type: 'Class', id: LIST_ID },
        { type: 'Subject', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Users/{userId}/profile-picture -- the bytes, as a browser-usable URL.
     *
     * Fetched rather than put in an `<img src>` because the endpoint needs the bearer token
     * and an image request cannot carry one. `baseApi`'s envelope unwrapper deliberately lets
     * a blob through untouched, so the only work here is turning it into an object URL and
     * revoking that URL when the cache entry goes -- otherwise every page visit leaks the
     * image for the lifetime of the tab.
     *
     * A user with no picture gets a 404 whose body is also a blob, so **any** error from here
     * means "nothing to show" rather than "something went wrong". Check `hasProfilePicture`
     * before asking, and skip the request when it is false.
     *
     * Note the endpoint carries no `CanAccessUser` check -- it is bare `[Authorize]` — so any
     * signed-in user can read any same-school user's photo. See FRONTEND_PLAN.md §7.
     */
    getProfilePicture: build.query<string, number>({
      query: (userId) => ({
        url: `/users/${userId}/profile-picture`,
        responseHandler: (response) => response.blob(),
      }),
      transformResponse: (blob: Blob) => URL.createObjectURL(blob),
      providesTags: (_result, _error, userId) => [{ type: 'User', id: `picture-${userId}` }],
      async onCacheEntryAdded(_userId, { cacheDataLoaded, cacheEntryRemoved }) {
        let objectUrl: string | undefined
        try {
          const { data } = await cacheDataLoaded
          objectUrl = data
          await cacheEntryRemoved
        } catch {
          // The entry was dropped before the request settled, or the request failed. Either
          // way there may be nothing to revoke; the finally block handles both.
        } finally {
          if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
      },
    }),

    /**
     * POST /api/Users/{userId}/profile-picture -- Admin or self. `multipart/form-data`, field
     * name `file`, because the action binds `IFormFile file` by name.
     *
     * The Content-Type header is left unset on purpose: the browser has to add the multipart
     * boundary, and setting the header by hand omits it and produces a 400 the server cannot
     * explain. `fetchBaseQuery` skips it for a `FormData` body.
     *
     * Validated twice -- here and in the controller -- on the same three rules: JPEG/PNG/GIF,
     * at most 5 MB, and not empty. Client-side so a 6 MB photo does not cost an upload.
     */
    uploadProfilePicture: build.mutation<void, { userId: number; file: File }>({
      query: ({ userId, file }) => {
        const body = new FormData()
        body.append('file', file)
        return { url: `/users/${userId}/profile-picture`, method: 'POST', body }
      },
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'User', id: `picture-${userId}` },
        // hasProfilePicture flips, and it is what every avatar decides on.
        { type: 'User', id: LIST_ID },
        { type: 'User', id: userId },
      ],
    }),

    /** DELETE /api/Users/{userId}/profile-picture -- Admin or self. Clears the bytes. */
    deleteProfilePicture: build.mutation<void, number>({
      query: (userId) => ({ url: `/users/${userId}/profile-picture`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, userId) => [
        { type: 'User', id: `picture-${userId}` },
        { type: 'User', id: LIST_ID },
        { type: 'User', id: userId },
      ],
    }),

    /**
     * POST /api/Auth/reset-password -- `[Authorize(Roles = "Admin,SuperAdmin")]`.
     *
     * Lives on AuthController, not UsersController, and is gated on the **role** rather than
     * on `Users:Edit`: a custom role holding every Users flag still cannot reset a password.
     * Exposed from here because the Users list is where an admin actually needs it.
     *
     * `authApi` already declares this mutation. Re-declared here so the Users screens do not
     * reach into the auth feature for an admin action, and so it can invalidate `User` --
     * `requirePasswordChange` flips, and that flag is on every row in the list.
     */
    resetUserPassword: build.mutation<void, ResetPasswordRequest>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'User', id: LIST_ID },
        { type: 'User', id: userId },
      ],
    }),
  }),
})

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useUpdateUserMutation,
  useUpdateUserStatusMutation,
  useChangeUserRoleMutation,
  useDeleteUserMutation,
  useGetProfilePictureQuery,
  useUploadProfilePictureMutation,
  useDeleteProfilePictureMutation,
  useResetUserPasswordMutation,
} = usersApi
