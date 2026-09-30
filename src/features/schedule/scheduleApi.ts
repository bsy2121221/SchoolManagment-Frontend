import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  ClassScheduleEntry,
  CurrentNextLessons,
  ScheduleEntryPayload,
  ScheduleOperationResult,
  TeacherScheduleEntry,
  TeacherScheduleStats,
} from './types'

/**
 * ScheduleController — all eight endpoints.
 *
 * One tag type, `Schedule`:
 *
 *   `LIST`          every timetable read. Classes (the timetable tab, and suspending a class)
 *                   and Subjects (deactivating one) already provide or invalidate it, which is
 *                   how those screens stay in step with this one.
 *   `teacher-{id}`  one teacher's week, day, stats and current/next.
 *   `class-{id}`    one class's timetable.
 *
 * Every write invalidates `LIST`. A lesson belongs to a teacher and a class at once, and an
 * edit can move it to a different teacher and a different class, so the only narrower tag set
 * that is always right is "old teacher, new teacher, old class, new class" — which the
 * mutation does not know. One extra refetch of a small list is the cheaper mistake.
 */
const teacherTag = (teacherId: number) => ({ type: 'Schedule', id: `teacher-${teacherId}` }) as const
const classTag = (classId: number) => ({ type: 'Schedule', id: `class-${classId}` }) as const

export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** GET /api/Schedule/teacher/{teacherId} — AdminOrTeacher, `Schedule:View`. Monday first. */
    getTeacherSchedule: build.query<TeacherScheduleEntry[], number>({
      query: (teacherId) => `/schedule/teacher/${teacherId}`,
      providesTags: (_result, _error, teacherId) => [
        teacherTag(teacherId),
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /** GET /api/Schedule/teacher/{teacherId}/day/{day} — one weekday, by start time. */
    getTeacherScheduleByDay: build.query<
      TeacherScheduleEntry[],
      { teacherId: number; dayOfWeek: number }
    >({
      query: ({ teacherId, dayOfWeek }) => `/schedule/teacher/${teacherId}/day/${dayOfWeek}`,
      providesTags: (_result, _error, { teacherId }) => [
        teacherTag(teacherId),
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Schedule/teacher/{teacherId}/current-next.
     *
     * "Now" is the database server's clock. The caller polls it, since the answer changes with
     * the time rather than with any write.
     */
    getTeacherCurrentNext: build.query<CurrentNextLessons, number>({
      query: (teacherId) => `/schedule/teacher/${teacherId}/current-next`,
      providesTags: (_result, _error, teacherId) => [
        teacherTag(teacherId),
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /** GET /api/Schedule/teacher/{teacherId}/stats */
    getTeacherScheduleStats: build.query<TeacherScheduleStats, number>({
      query: (teacherId) => `/schedule/teacher/${teacherId}/stats`,
      providesTags: (_result, _error, teacherId) => [
        teacherTag(teacherId),
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /** GET /api/Schedule/class/{classId}[?dayOfWeek=] — AdminOrTeacher, `Schedule:View`. */
    getClassSchedule: build.query<ClassScheduleEntry[], { classId: number; dayOfWeek?: number }>({
      query: ({ classId, dayOfWeek }) => ({
        url: `/schedule/class/${classId}`,
        params: dayOfWeek ? { dayOfWeek } : undefined,
      }),
      providesTags: (_result, _error, { classId }) => [
        classTag(classId),
        { type: 'Schedule', id: LIST_ID },
      ],
    }),

    /**
     * POST /api/Schedule — AdminOnly, `Schedule:Create`.
     *
     * 409 when the teacher, the class or the room is already busy; the message names the
     * lesson in the way and `data.conflictWith` is its id (see `conflictOf`).
     */
    createScheduleEntry: build.mutation<ScheduleOperationResult, ScheduleEntryPayload>({
      query: (body) => ({ url: '/schedule', method: 'POST', body }),
      invalidatesTags: [{ type: 'Schedule', id: LIST_ID }],
    }),

    /** PUT /api/Schedule/{id} — AdminOnly, `Schedule:Edit`. 404 if the entry was deleted. */
    updateScheduleEntry: build.mutation<
      ScheduleOperationResult,
      { id: number; body: ScheduleEntryPayload }
    >({
      query: ({ id, body }) => ({ url: `/schedule/${id}`, method: 'PUT', body }),
      invalidatesTags: [{ type: 'Schedule', id: LIST_ID }],
    }),

    /** DELETE /api/Schedule/{id} — AdminOnly, `Schedule:Delete`. Soft delete. */
    deleteScheduleEntry: build.mutation<void, number>({
      query: (id) => ({ url: `/schedule/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Schedule', id: LIST_ID }],
    }),
  }),
})

export const {
  useGetTeacherScheduleQuery,
  useGetTeacherScheduleByDayQuery,
  useGetTeacherCurrentNextQuery,
  useGetTeacherScheduleStatsQuery,
  useGetClassScheduleQuery,
  useCreateScheduleEntryMutation,
  useUpdateScheduleEntryMutation,
  useDeleteScheduleEntryMutation,
} = scheduleApi
