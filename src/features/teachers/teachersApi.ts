import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  TeacherClass,
  TeacherPayload,
  TeacherProfile,
  TeacherProfilePayload,
  TeacherRegistrationResult,
  TeacherRow,
  TeacherSubject,
  TeacherSubjectClass,
  TeacherSubjectClassPayload,
} from './types'

/**
 * TeachersController -- all twelve endpoints.
 *
 * Tag strategy as for Students, with one wrinkle that is specific to this module: a
 * teacher is addressed by two different ids depending on the endpoint (`Teachers.Id` for
 * writes, `Users.Id` for the profile reads). Tagging by `Teachers.Id` alone would leave
 * the profile stale after an edit, and tagging by `Users.Id` alone would leave the list
 * stale. So the list is the anchor -- every write invalidates `{ Teacher, LIST }` and both
 * ids it knows -- and the profile provides its own `userId`.
 *
 * Cross-module invalidations:
 *
 *  - `Class` -- a teacher's classes carry their roll counts, and deleting a teacher
 *    detaches them from the classes they were class teacher of.
 *  - `Subject` -- assignment changes which teachers a subject has.
 *  - `User` -- registering or deleting a teacher creates or deactivates a login.
 */
export const teachersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Teachers -- Admin/Teacher. **Not paginated and not searchable.**
     *
     * `sp_GetTeachersWithDetails` takes only `@SubjectId` and returns every active
     * teacher in one array, ordered by join date descending. The list screen therefore
     * filters by subject on the server and searches in the browser; see `ClientDataGrid`.
     */
    getTeachers: build.query<TeacherRow[], { subjectId?: number } | void>({
      query: (params) => ({ url: '/teachers', params: params ?? undefined }),
      providesTags: (result) => [
        { type: 'Teacher' as const, id: LIST_ID },
        ...(result ?? []).map((row) => ({ type: 'Teacher' as const, id: row.id })),
      ],
    }),

    /**
     * GET /api/Teachers/profile/{userId} -- Admin/Teacher. Keyed on **Users.Id**.
     *
     * Returns null -- a 404 -- for a deactivated teacher, because `sp_GetTeacherProfile`
     * filters on `IsActive`. That is the opposite of the student profile, which reads a
     * deactivated student on purpose.
     *
     * Carries `salary`, and the endpoint is Admin/Teacher, so any teacher can read a
     * colleague's pay by calling it directly. See FRONTEND_PLAN.md §7.
     */
    getTeacherProfile: build.query<TeacherProfile, number>({
      query: (userId) => `/teachers/profile/${userId}`,
      providesTags: (result, _error, userId) => [
        { type: 'Teacher', id: `user-${userId}` },
        ...(result ? [{ type: 'Teacher' as const, id: result.id }] : []),
        // The stats half counts attendance and marks entered in the last month.
        { type: 'Attendance', id: LIST_ID },
        { type: 'Result', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Teachers/my-profile -- Teacher role only, resolved from the token.
     *
     * A separate cache entry from `getTeacherProfile` even though the body is identical,
     * because the seeded Teacher role holds no `Teachers` permission at all: a teacher can
     * reach this and nothing else in the module.
     */
    getMyTeacherProfile: build.query<TeacherProfile, void>({
      query: () => '/teachers/my-profile',
      providesTags: (result) => [
        { type: 'Teacher', id: 'me' },
        ...(result ? [{ type: 'Teacher' as const, id: result.id }] : []),
        { type: 'Attendance', id: LIST_ID },
        { type: 'Result', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Teachers/{teacherId}/subjects -- the teacher's active subject links.
     *
     * Keyed on `Teachers.Id`. Only active links come back, so this is the current set
     * rather than a history.
     */
    getTeacherSubjects: build.query<TeacherSubject[], number>({
      query: (teacherId) => `/teachers/${teacherId}/subjects`,
      providesTags: (_result, _error, teacherId) => [
        { type: 'Teacher', id: teacherId },
        { type: 'Subject', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Teachers/{teacherId}/classes -- classes this teacher is **class teacher**
     * of, with each roll count. Not the classes they teach a subject in; that is the
     * matrix below.
     */
    getTeacherClasses: build.query<TeacherClass[], number>({
      query: (teacherId) => `/teachers/${teacherId}/classes`,
      providesTags: (_result, _error, teacherId) => [
        { type: 'Teacher', id: teacherId },
        { type: 'Class', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Teachers/{teacherId}/subject-assignments -- the subject×class matrix.
     *
     * These rows are what gate mark entry, so an empty answer here is the explanation for
     * "the teacher cannot enter results" even when they hold the subject.
     */
    getTeacherSubjectAssignments: build.query<TeacherSubjectClass[], number>({
      query: (teacherId) => `/teachers/${teacherId}/subject-assignments`,
      providesTags: (_result, _error, teacherId) => [
        { type: 'Teacher', id: teacherId },
        { type: 'Class', id: LIST_ID },
        { type: 'Subject', id: LIST_ID },
      ],
    }),

    /**
     * POST /api/Teachers -- Admin. Returns the generated username and employee number,
     * both of which the admin has to pass on, plus the two ids.
     *
     * The refusals worth showing arrive in the message: a duplicate email, a username the
     * sequence has already handed out.
     */
    registerTeacher: build.mutation<TeacherRegistrationResult, TeacherPayload>({
      query: (body) => ({ url: '/teachers', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Teacher', id: LIST_ID },
        { type: 'Subject', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Teachers/{teacherId} -- Admin. Keyed on `Teachers.Id`.
     *
     * A full replacement, not a patch: every column named is written, so a box left empty
     * clears what is on file. `subjectIds` replaces the whole link set when sent and
     * leaves it untouched when null.
     *
     * `userId` is not part of the request -- it is here so the profile cache entry, which
     * is keyed on it, can be invalidated.
     */
    updateTeacher: build.mutation<
      void,
      { teacherId: number; userId: number; body: TeacherPayload }
    >({
      query: ({ teacherId, body }) => ({ url: `/teachers/${teacherId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { teacherId, userId }) => [
        { type: 'Teacher', id: LIST_ID },
        { type: 'Teacher', id: teacherId },
        { type: 'Teacher', id: `user-${userId}` },
        { type: 'Subject', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Teachers/my-profile -- Teacher role only.
     *
     * Same procedure family as the admin edit, minus salary and subjects. It writes an
     * audit row where the admin edit does not.
     */
    updateMyTeacherProfile: build.mutation<void, TeacherProfilePayload>({
      query: (body) => ({ url: '/teachers/my-profile', method: 'PUT', body }),
      invalidatesTags: [
        { type: 'Teacher', id: 'me' },
        { type: 'Teacher', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * DELETE /api/Teachers/{teacherId} -- Admin. A soft delete that cascades through the
     * subject links, the matrix, the timetable, the login and any live session.
     *
     * Refused outright in two cases -- still class teacher of an active class, or has
     * attendance history -- and those refusals have different remedies, so callers must
     * surface the message rather than say "could not delete".
     *
     * There is no reactivate endpoint, so this is one-way from the app.
     */
    deleteTeacher: build.mutation<void, { teacherId: number; userId: number }>({
      query: ({ teacherId }) => ({ url: `/teachers/${teacherId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { teacherId, userId }) => [
        { type: 'Teacher', id: LIST_ID },
        { type: 'Teacher', id: teacherId },
        { type: 'Teacher', id: `user-${userId}` },
        { type: 'Class', id: LIST_ID },
        { type: 'Subject', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * POST /api/Teachers/{teacherId}/subjects -- Admin. **Replaces** the subject set:
     * anything absent from the list is deactivated.
     *
     * Unlike the student equivalent, an empty list is accepted -- the DTO carries no
     * `[MinLength(1)]` -- and clears every link. That is the only way to express "teaches
     * no subjects", so the panel allows it and says what it does.
     *
     * The response's count is what survived, not what was added.
     */
    assignTeacherSubjects: build.mutation<
      { subjectsAssigned: number },
      { teacherId: number; userId: number; subjectIds: number[] }
    >({
      query: ({ teacherId, subjectIds }) => ({
        url: `/teachers/${teacherId}/subjects`,
        method: 'POST',
        body: { subjectIds },
      }),
      invalidatesTags: (_result, _error, { teacherId, userId }) => [
        { type: 'Teacher', id: LIST_ID },
        { type: 'Teacher', id: teacherId },
        { type: 'Teacher', id: `user-${userId}` },
        { type: 'Subject', id: LIST_ID },
      ],
    }),

    /**
     * POST /api/Teachers/subject-class-assignments -- Admin. One subject in one class.
     *
     * Both directions go through here: `isActive: false` withdraws the assignment, because
     * the procedure is a MERGE and there is no DELETE. The teacher id is in the body
     * rather than the path, which is why it is passed explicitly for invalidation.
     */
    assignTeacherSubjectClass: build.mutation<
      { assignmentId: number | null },
      TeacherSubjectClassPayload & { userId: number }
    >({
      query: ({ teacherId, subjectId, classId, isActive }) => ({
        url: '/teachers/subject-class-assignments',
        method: 'POST',
        body: { teacherId, subjectId, classId, isActive },
      }),
      invalidatesTags: (_result, _error, { teacherId, userId }) => [
        { type: 'Teacher', id: teacherId },
        { type: 'Teacher', id: `user-${userId}` },
        { type: 'Class', id: LIST_ID },
        { type: 'Subject', id: LIST_ID },
      ],
    }),
  }),
})

export const {
  useGetTeachersQuery,
  useGetTeacherProfileQuery,
  useGetMyTeacherProfileQuery,
  useGetTeacherSubjectsQuery,
  useGetTeacherClassesQuery,
  useGetTeacherSubjectAssignmentsQuery,
  useRegisterTeacherMutation,
  useUpdateTeacherMutation,
  useUpdateMyTeacherProfileMutation,
  useDeleteTeacherMutation,
  useAssignTeacherSubjectsMutation,
  useAssignTeacherSubjectClassMutation,
} = teachersApi
