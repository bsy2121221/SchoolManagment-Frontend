import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type { PaginatedResponse } from '@/types/api'
import type { SubjectListQuery, SubjectPayload, SubjectRow } from './types'

/**
 * SubjectsController -- all seven endpoints.
 *
 * Tag strategy as for Classes: reads provide `Subject` for their own id or for the list,
 * writes invalidate the list plus the affected id. Deleting or deactivating a subject
 * also pulls it off the timetable server-side, so those two also invalidate `Schedule`.
 */
export const subjectsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Subjects -- paginated, Admin/Teacher.
     *
     * Note there is no search parameter: the procedure filters on grade and status only.
     * A client-side name filter would silently search one page, so the list does not
     * offer one.
     */
    getSubjects: build.query<PaginatedResponse<SubjectRow>, SubjectListQuery>({
      query: (params) => ({ url: '/subjects', params }),
      providesTags: (result) => [
        { type: 'Subject' as const, id: LIST_ID },
        ...(result?.items ?? []).map((row) => ({ type: 'Subject' as const, id: row.id })),
      ],
    }),

    /** GET /api/Subjects/{id} -- reads deactivated subjects too, so an edit can revive one. */
    getSubject: build.query<SubjectRow, number>({
      query: (subjectId) => `/subjects/${subjectId}`,
      providesTags: (_result, _error, subjectId) => [{ type: 'Subject', id: subjectId }],
    }),

    /**
     * GET /api/Subjects/by-grade/{grade} -- unpaged, active subjects only.
     *
     * Not what the list screen uses (that filters through the paged endpoint). This is
     * the picker feed: an examination or a timetable period has to choose among the
     * subjects taught in one grade.
     */
    getSubjectsByGrade: build.query<SubjectRow[], string>({
      query: (grade) => `/subjects/by-grade/${encodeURIComponent(grade)}`,
      providesTags: [{ type: 'Subject', id: LIST_ID }],
    }),

    /**
     * POST /api/Subjects -- Admin. Returns the new id.
     *
     * A code already held by a deactivated subject does not collide: the procedure
     * revives that row under the name and grade sent here, and the id that comes back is
     * the old one.
     */
    createSubject: build.mutation<{ subjectId: number }, SubjectPayload>({
      query: (body) => ({ url: '/subjects', method: 'POST', body }),
      invalidatesTags: [{ type: 'Subject', id: LIST_ID }],
    }),

    /** PUT /api/Subjects/{id} -- Admin. Refused for a deactivated subject. */
    updateSubject: build.mutation<void, { subjectId: number; body: SubjectPayload }>({
      query: ({ subjectId, body }) => ({ url: `/subjects/${subjectId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { subjectId }) => [
        { type: 'Subject', id: LIST_ID },
        { type: 'Subject', id: subjectId },
      ],
    }),

    /**
     * PUT /api/Subjects/{id}/status -- Admin.
     *
     * Deactivating takes the subject off the timetable. Who studies it and who is
     * qualified to teach it are left alone, and reactivating does not put the periods
     * back, so the schedule cache has to be dropped either way.
     */
    updateSubjectStatus: build.mutation<void, { subjectId: number; isActive: boolean }>({
      query: ({ subjectId, isActive }) => ({
        url: `/subjects/${subjectId}/status`,
        method: 'PUT',
        body: { isActive },
      }),
      invalidatesTags: (_result, _error, { subjectId }) => [
        { type: 'Subject', id: LIST_ID },
        { type: 'Subject', id: subjectId },
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /**
     * DELETE /api/Subjects/{id} -- Admin. A soft delete, refused while the subject has
     * active examinations; it cascades to student enrolments, teacher qualifications,
     * teacher assignments and the timetable. The refusal reason comes back in the
     * message, so callers should show it rather than "could not delete".
     */
    deleteSubject: build.mutation<void, number>({
      query: (subjectId) => ({ url: `/subjects/${subjectId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, subjectId) => [
        { type: 'Subject', id: LIST_ID },
        { type: 'Subject', id: subjectId },
        { type: 'Schedule', id: LIST_ID },
        // Student and teacher subject links are deactivated with it.
        { type: 'Student', id: LIST_ID },
        { type: 'Teacher', id: LIST_ID },
      ],
    }),
  }),
})

export const {
  useGetSubjectsQuery,
  useGetSubjectQuery,
  useGetSubjectsByGradeQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useUpdateSubjectStatusMutation,
  useDeleteSubjectMutation,
} = subjectsApi
