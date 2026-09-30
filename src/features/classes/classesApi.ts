import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type { PaginatedResponse } from '@/types/api'
import type {
  ClassDetails,
  ClassListQuery,
  ClassPayload,
  ClassRow,
  ClassStudentRow,
  ClassTimetable,
} from './types'

/**
 * ClassesController -- all nine endpoints.
 *
 * Tag strategy: every read provides `Class`, either for its own id or for the list.
 * Writes invalidate the list plus the affected id, so a rename shows up in the grid and
 * on an open details page without either screen knowing about the other.
 */
export const classesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** GET /api/Classes -- paginated, Admin/Teacher. */
    getClasses: build.query<PaginatedResponse<ClassRow>, ClassListQuery>({
      query: (params) => ({ url: '/classes', params }),
      providesTags: (result) => [
        { type: 'Class' as const, id: LIST_ID },
        ...(result?.items ?? []).map((row) => ({ type: 'Class' as const, id: row.id })),
      ],
    }),

    /** GET /api/Classes/{id} */
    getClass: build.query<ClassRow, number>({
      query: (classId) => `/classes/${classId}`,
      providesTags: (_result, _error, classId) => [{ type: 'Class', id: classId }],
    }),

    /**
     * GET /api/Classes/{id}/details -- class, roster and stats in one round trip.
     *
     * Reads with `@IncludeInactive = 1`, so this is the one endpoint that still finds a
     * class after it has been deleted (the delete is a soft one). The details page
     * relies on that to explain what happened rather than 404.
     */
    getClassDetails: build.query<ClassDetails, number>({
      query: (classId) => `/classes/${classId}/details`,
      providesTags: (_result, _error, classId) => [
        { type: 'Class', id: classId },
        // The roster changes when students move, so a student write must refresh this.
        { type: 'Student', id: LIST_ID },
      ],
    }),

    /** GET /api/Classes/{id}/students -- the roster on its own. */
    getClassStudents: build.query<ClassStudentRow[], number>({
      query: (classId) => `/classes/${classId}/students`,
      providesTags: (_result, _error, classId) => [
        { type: 'Class', id: classId },
        { type: 'Student', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Classes/{id}/timetable -- the only Classes endpoint with no policy
     * attribute, so any signed-in user can read it. 404 means "no periods scheduled",
     * not "no such class": the procedure returns no rows either way.
     */
    getClassTimetable: build.query<ClassTimetable, { classId: number; dayOfWeek?: number }>({
      query: ({ classId, dayOfWeek }) => ({
        url: `/classes/${classId}/timetable`,
        params: dayOfWeek ? { dayOfWeek } : undefined,
      }),
      providesTags: (_result, _error, { classId }) => [
        { type: 'Class', id: classId },
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /** POST /api/Classes -- Admin. Returns the new id. */
    createClass: build.mutation<{ classId: number }, ClassPayload>({
      query: (body) => ({ url: '/classes', method: 'POST', body }),
      invalidatesTags: [{ type: 'Class', id: LIST_ID }],
    }),

    /** PUT /api/Classes/{id} -- Admin. */
    updateClass: build.mutation<void, { classId: number; body: ClassPayload }>({
      query: ({ classId, body }) => ({ url: `/classes/${classId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { classId }) => [
        { type: 'Class', id: LIST_ID },
        { type: 'Class', id: classId },
      ],
    }),

    /**
     * PUT /api/Classes/{id}/status -- Admin.
     *
     * Suspending a class also deactivates its `TeacherSchedule` rows, so the timetable
     * and the schedule module both go stale.
     */
    updateClassStatus: build.mutation<void, { classId: number; isActive: boolean }>({
      query: ({ classId, isActive }) => ({
        url: `/classes/${classId}/status`,
        method: 'PUT',
        body: { isActive },
      }),
      invalidatesTags: (_result, _error, { classId }) => [
        { type: 'Class', id: LIST_ID },
        { type: 'Class', id: classId },
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /**
     * DELETE /api/Classes/{id} -- Admin. A soft delete, refused while the class has
     * enrolled students, recorded attendance or active examinations; it cascades to
     * teacher schedules and subject assignments. The refusal reason comes back in the
     * message, so callers should surface it rather than saying "could not delete".
     */
    deleteClass: build.mutation<void, number>({
      query: (classId) => ({ url: `/classes/${classId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, classId) => [
        { type: 'Class', id: LIST_ID },
        { type: 'Class', id: classId },
        { type: 'Schedule', id: LIST_ID },
        { type: 'Subject', id: LIST_ID },
      ],
    }),
  }),
})

export const {
  useGetClassesQuery,
  useGetClassQuery,
  useGetClassDetailsQuery,
  useGetClassStudentsQuery,
  useGetClassTimetableQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useUpdateClassStatusMutation,
  useDeleteClassMutation,
} = classesApi
