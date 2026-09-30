import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  LinkStudentParentPayload,
  ParentChild,
  ParentPayload,
  ParentProfile,
  ParentRegistrationResult,
  ParentRow,
  UnlinkStudentParentPayload,
} from './types'

/**
 * ParentsController -- all eleven endpoints.
 *
 * Tag strategy as for Teachers, and for the same reason: a parent is addressed by
 * `Parents.Id` for every write and by `Users.Id` for the two profile reads, so neither id
 * alone can keep both screens fresh. The list is the anchor -- every write invalidates
 * `{ Parent, LIST }` plus both ids it knows -- and the profile provides `user-${userId}`
 * for itself.
 *
 * Cross-module invalidations:
 *
 *  - `Student` -- linking or unlinking changes who a student's contacts are, and the
 *    per-student parents read is cached under this module's tag rather than the student's.
 *  - `User` -- registering or deleting a parent creates or deactivates a login.
 */
export const parentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Parents -- Admin/Teacher. **Not paginated and not searchable.**
     *
     * `sp_GetAllParents` takes only `@IncludeInactive` and returns every parent in one
     * array, ordered by name. The list screen therefore searches in the browser; see
     * `ClientDataGrid`.
     *
     * `includeInactive` is the one filter the server does, and it is what makes a
     * soft-deleted parent reachable at all -- there is no reactivate endpoint, but the
     * record and its login can at least be found.
     */
    getParents: build.query<ParentRow[], { includeInactive?: boolean } | void>({
      query: (params) => ({ url: '/parents', params: params ?? undefined }),
      providesTags: (result) => [
        { type: 'Parent' as const, id: LIST_ID },
        ...(result ?? []).map((row) => ({ type: 'Parent' as const, id: row.id })),
      ],
    }),

    /**
     * GET /api/Parents/{parentId} -- Admin/Teacher. Keyed on **Parents.Id**.
     *
     * Reads deactivated parents too, on purpose: the admin who deactivated one has to be
     * able to see what they did.
     */
    getParent: build.query<ParentRow, number>({
      query: (parentId) => `/parents/${parentId}`,
      providesTags: (_result, _error, parentId) => [{ type: 'Parent', id: parentId }],
    }),

    /**
     * GET /api/Parents/profile/{userId} -- Admin/Teacher. Keyed on **Users.Id**.
     *
     * Carries the children list as a second result set, stitched on by the repository. No
     * `IsActive` filter, unlike the teacher profile, so a deactivated parent opens as a
     * read-only record rather than 404ing.
     *
     * This was a bare `[Authorize]` before Phase 7 -- any signed-in account in the school,
     * a student's included, could read every parent's phone number and home address.
     */
    getParentProfile: build.query<ParentProfile, number>({
      query: (userId) => `/parents/profile/${userId}`,
      providesTags: (result, _error, userId) => [
        { type: 'Parent', id: `user-${userId}` },
        ...(result ? [{ type: 'Parent' as const, id: result.id }] : []),
        // The children come from StudentParents joined to Students, so a student renamed
        // or deactivated elsewhere changes this answer.
        { type: 'Student', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Parents/my-profile -- Parent role only, resolved from the token.
     *
     * A separate cache entry from `getParentProfile` even though the body is identical,
     * because the seeded Parent role holds no `Parents` permission at all: a parent can
     * reach this and nothing else in the module. It is also how they get their children,
     * since `/{parentId}/children` is Admin/Teacher.
     *
     * There is no PUT counterpart -- `ParentsController` exposes no my-profile write -- so
     * the screen behind this is read-only.
     */
    getMyParentProfile: build.query<ParentProfile, void>({
      query: () => '/parents/my-profile',
      providesTags: (result) => [
        { type: 'Parent', id: 'me' },
        ...(result ? [{ type: 'Parent' as const, id: result.id }] : []),
        { type: 'Student', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Parents/student/{studentId} -- who to contact about one student.
     *
     * The only call that fills `relationship`, because it reads the link rows. Tagged under
     * both modules so linking from either side refreshes it.
     */
    getParentsByStudent: build.query<ParentRow[], number>({
      query: (studentId) => `/parents/student/${studentId}`,
      providesTags: (result, _error, studentId) => [
        { type: 'Parent', id: LIST_ID },
        { type: 'Student', id: studentId },
        ...(result ?? []).map((row) => ({ type: 'Parent' as const, id: row.id })),
      ],
    }),

    /**
     * GET /api/Parents/{parentId}/children -- Admin/Teacher. Keyed on **Parents.Id**.
     *
     * Also narrowed from a bare `[Authorize]` in Phase 7: a signed-in parent could walk the
     * ids and read other families' children.
     */
    getParentChildren: build.query<ParentChild[], number>({
      query: (parentId) => `/parents/${parentId}/children`,
      providesTags: (_result, _error, parentId) => [
        { type: 'Parent', id: parentId },
        { type: 'Student', id: LIST_ID },
      ],
    }),

    /**
     * POST /api/Parents -- Admin. Returns the generated username, which the admin has to
     * pass on, plus both ids.
     *
     * The refusals worth showing arrive in the message: an email already used in this
     * school, a username the sequence has already handed out, a deactivated school.
     */
    registerParent: build.mutation<ParentRegistrationResult, ParentPayload>({
      query: (body) => ({ url: '/parents', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Parent', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Parents/{parentId} -- Admin. Keyed on `Parents.Id`.
     *
     * A full replacement, not a patch: every column named is written, so a box left empty
     * clears what is on file.
     *
     * `userId` is not part of the request -- it is here so the profile cache entry, which
     * is keyed on it, can be invalidated.
     */
    updateParent: build.mutation<void, { parentId: number; userId: number; body: ParentPayload }>({
      query: ({ parentId, body }) => ({ url: `/parents/${parentId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { parentId, userId }) => [
        { type: 'Parent', id: LIST_ID },
        { type: 'Parent', id: parentId },
        { type: 'Parent', id: `user-${userId}` },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * DELETE /api/Parents/{parentId} -- Admin. A soft delete that cascades through the
     * child links, the login and any live session.
     *
     * Refused outright for a parent who has recorded fee payments -- `FeePayments.PaidBy`
     * points at their user row -- and the remedy in that case is to leave the account
     * deactivated rather than deleted, so the message has to be surfaced.
     *
     * There is no reactivate endpoint, so this is one-way from the app.
     */
    deleteParent: build.mutation<void, { parentId: number; userId: number }>({
      query: ({ parentId }) => ({ url: `/parents/${parentId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { parentId, userId }) => [
        { type: 'Parent', id: LIST_ID },
        { type: 'Parent', id: parentId },
        { type: 'Parent', id: `user-${userId}` },
        { type: 'Student', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * POST /api/Parents/link -- Admin. Attaches a parent to a student as Father, Mother or
     * Guardian.
     *
     * A MERGE, so this is also how an existing link is re-labelled or brought back: the
     * procedure validates the three words itself and names them in its refusal, which it
     * did not do before Phase 7 -- the `CK_StudentParents_Relationship` violation reached
     * the admin verbatim.
     *
     * `userId` is passed for invalidation only; the request body carries neither.
     */
    linkStudentParent: build.mutation<void, LinkStudentParentPayload & { userId: number }>({
      query: ({ studentId, parentId, relationship }) => ({
        url: '/parents/link',
        method: 'POST',
        body: { studentId, parentId, relationship },
      }),
      invalidatesTags: (_result, _error, { parentId, studentId, userId }) => [
        { type: 'Parent', id: LIST_ID },
        { type: 'Parent', id: parentId },
        { type: 'Parent', id: `user-${userId}` },
        { type: 'Student', id: studentId },
      ],
    }),

    /**
     * POST /api/Parents/unlink -- Admin. Deactivates the link rather than deleting it.
     *
     * Idempotent in the direction that matters: a link that is already inactive reports
     * success, and only a pair that has never been linked is refused.
     */
    unlinkStudentParent: build.mutation<void, UnlinkStudentParentPayload & { userId: number }>({
      query: ({ studentId, parentId }) => ({
        url: '/parents/unlink',
        method: 'POST',
        body: { studentId, parentId },
      }),
      invalidatesTags: (_result, _error, { parentId, studentId, userId }) => [
        { type: 'Parent', id: LIST_ID },
        { type: 'Parent', id: parentId },
        { type: 'Parent', id: `user-${userId}` },
        { type: 'Student', id: studentId },
      ],
    }),
  }),
})

export const {
  useGetParentsQuery,
  useGetParentQuery,
  useGetParentProfileQuery,
  useGetMyParentProfileQuery,
  useGetParentsByStudentQuery,
  useGetParentChildrenQuery,
  useRegisterParentMutation,
  useUpdateParentMutation,
  useDeleteParentMutation,
  useLinkStudentParentMutation,
  useUnlinkStudentParentMutation,
} = parentsApi
