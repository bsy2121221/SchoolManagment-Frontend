import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type { PaginatedResponse } from '@/types/api'
import type {
  StudentListQuery,
  StudentProfile,
  StudentPromotePayload,
  StudentRegistrationPayload,
  StudentRegistrationResult,
  StudentRow,
  StudentSubject,
  StudentUpdatePayload,
} from './types'

/**
 * StudentsController -- all eleven endpoints.
 *
 * Tag strategy as for Classes and Subjects: reads provide `Student` for their own id or
 * for the list, writes invalidate the list plus the affected id. Two extras are specific
 * to this module:
 *
 *  - `Class` is invalidated by anything that changes who is on a roll (register, delete,
 *    promote), because a class carries `totalStudents` and a roster.
 *  - The profile aggregates attendance, results and fees, so it provides those tags too:
 *    marking a register or taking a payment must refresh the figures on this screen
 *    rather than leave a stale average sitting there.
 */
export const studentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Students -- paginated, Admin/Teacher.
     *
     * `isActive` filters on `Students.IsActive`; the account is deactivated with the
     * student, so there is only ever one answer. `searchTerm` is matched server-side
     * across name, email, username, admission number and roll number -- LIKE
     * metacharacters in it are escaped by the procedure, so a search for `100%` is a
     * search for the text.
     */
    getStudents: build.query<PaginatedResponse<StudentRow>, StudentListQuery>({
      query: (params) => ({ url: '/students', params }),
      providesTags: (result) => [
        { type: 'Student' as const, id: LIST_ID },
        ...(result?.items ?? []).map((row) => ({ type: 'Student' as const, id: row.id })),
      ],
    }),

    /**
     * GET /api/Students/{id} -- reads deactivated students too, so the list's "inactive"
     * filter leads somewhere.
     *
     * Note this endpoint carries no policy attribute: any authenticated user can call it
     * for any student in their school. See FRONTEND_PLAN.md §7.
     */
    getStudent: build.query<StudentRow, number>({
      query: (studentId) => `/students/${studentId}`,
      providesTags: (_result, _error, studentId) => [{ type: 'Student', id: studentId }],
    }),

    /**
     * GET /api/Students/{id}/profile -- the student, their academic figures, their
     * subjects and their fee balance in one round trip.
     *
     * Readable for a deactivated student: a school still has to answer questions about
     * someone who left.
     */
    getStudentProfile: build.query<StudentProfile, number>({
      query: (studentId) => `/students/${studentId}/profile`,
      providesTags: (_result, _error, studentId) => [
        { type: 'Student', id: studentId },
        // The figures are aggregates over these three modules.
        { type: 'Attendance', id: LIST_ID },
        { type: 'Result', id: LIST_ID },
        { type: 'Fee', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Students/{id}/subjects -- what this student is enrolled in.
     *
     * Only active enrolments, so a subject removed here or dropped by a promotion is gone
     * from the answer.
     */
    getStudentSubjects: build.query<StudentSubject[], number>({
      query: (studentId) => `/students/${studentId}/subjects`,
      providesTags: (_result, _error, studentId) => [
        { type: 'Student', id: studentId },
        { type: 'Subject', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Students/by-class/{classId} -- the class roster, unpaged and active only.
     *
     * Not what the list screen uses (that filters through the paged endpoint). This is the
     * feed for anything that works a class at a time: attendance, mark entry.
     */
    getStudentsByClass: build.query<StudentRow[], number>({
      query: (classId) => `/students/by-class/${classId}`,
      providesTags: (_result, _error, classId) => [
        { type: 'Student', id: LIST_ID },
        { type: 'Class', id: classId },
      ],
    }),

    /**
     * POST /api/Students -- Admin. Returns the new record id, the generated username and
     * the roll number the server allocated.
     *
     * The refusals worth showing come back in the message: a full class, a class in
     * another school, an email already in use.
     */
    registerStudent: build.mutation<StudentRegistrationResult, StudentRegistrationPayload>({
      query: (body) => ({ url: '/students', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Student', id: LIST_ID },
        // The class gains a student, so its roll count and roster are stale.
        { type: 'Class', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Students/{id} -- Admin.
     *
     * Identity fields go through `sp_UpdateUserIdentity`, so this also rewrites the
     * `Users`/`Persons` rows behind the student. There is no `classId` here on purpose:
     * see `StudentUpdatePayload`.
     */
    updateStudent: build.mutation<void, { studentId: number; body: StudentUpdatePayload }>({
      query: ({ studentId, body }) => ({ url: `/students/${studentId}`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, { studentId }) => [
        { type: 'Student', id: LIST_ID },
        { type: 'Student', id: studentId },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * DELETE /api/Students/{id} -- Admin. A soft delete that deactivates the login with
     * the student, and is refused outright once there is attendance, result or fee
     * history. That refusal is the usual answer and it tells the admin what to do
     * instead, so callers must surface the message.
     */
    deleteStudent: build.mutation<void, number>({
      query: (studentId) => ({ url: `/students/${studentId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, studentId) => [
        { type: 'Student', id: LIST_ID },
        { type: 'Student', id: studentId },
        { type: 'Class', id: LIST_ID },
        { type: 'User', id: LIST_ID },
      ],
    }),

    /**
     * PUT /api/Students/{id}/promote -- Admin.
     *
     * Three things change, and the dialog says so: the class, the roll number (a fresh one
     * from the target class's own counter, because roll numbers are unique per class), and
     * the subject enrolments (those belonging to the old grade are dropped; the new
     * grade's subjects are **not** assigned automatically).
     */
    promoteStudent: build.mutation<void, { studentId: number; body: StudentPromotePayload }>({
      query: ({ studentId, body }) => ({
        url: `/students/${studentId}/promote`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { studentId }) => [
        { type: 'Student', id: LIST_ID },
        { type: 'Student', id: studentId },
        // Both the old and the new class change their roll count.
        { type: 'Class', id: LIST_ID },
        { type: 'Subject', id: LIST_ID },
      ],
    }),

    /**
     * POST /api/Students/{id}/subjects -- Admin. Replaces the enrolment set with the ids
     * sent, reviving any link that was previously deactivated rather than duplicating it.
     */
    assignStudentSubjects: build.mutation<void, { studentId: number; subjectIds: number[] }>({
      query: ({ studentId, subjectIds }) => ({
        url: `/students/${studentId}/subjects`,
        method: 'POST',
        body: { subjectIds },
      }),
      invalidatesTags: (_result, _error, { studentId }) => [
        { type: 'Student', id: studentId },
        { type: 'Subject', id: LIST_ID },
      ],
    }),

    /**
     * DELETE /api/Students/{id}/subjects/{subjectId} -- Admin.
     *
     * Deactivates the link, so marks already recorded for that subject survive. Removing
     * a subject the student does not have succeeds quietly.
     */
    removeStudentSubject: build.mutation<void, { studentId: number; subjectId: number }>({
      query: ({ studentId, subjectId }) => ({
        url: `/students/${studentId}/subjects/${subjectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { studentId }) => [
        { type: 'Student', id: studentId },
        { type: 'Subject', id: LIST_ID },
      ],
    }),
  }),
})

export const {
  useGetStudentsQuery,
  useGetStudentQuery,
  useGetStudentProfileQuery,
  useGetStudentSubjectsQuery,
  useGetStudentsByClassQuery,
  useRegisterStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  usePromoteStudentMutation,
  useAssignStudentSubjectsMutation,
  useRemoveStudentSubjectMutation,
} = studentsApi
