import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  AttendanceBulkMarkPayload,
  AttendanceBulkMarkResult,
  AttendanceMarkPayload,
  AttendanceSummaryRow,
  ClassAttendanceRow,
  DailyAttendanceRow,
  StudentAttendanceRow,
} from './types'

/** A window, as three of the four reads take it. Omitted dates default server-side. */
export interface AttendanceWindow {
  /** `yyyy-MM-dd`. Omitted, the procedures use one month ago. */
  startDate?: string
  /** `yyyy-MM-dd`. Omitted, the procedures use today. */
  endDate?: string
}

export interface ClassAttendanceQuery {
  classId: number
  /** `yyyy-MM-dd`. Omitted, the controller uses `DateTime.Today` -- the server's today. */
  attendanceDate?: string
}

export interface StudentAttendanceQuery extends AttendanceWindow {
  /** `Students.Id`. */
  studentId: number
}

export interface AttendanceReportQuery extends AttendanceWindow {
  /** Omitted for the whole school. */
  classId?: number
}

/**
 * Cache ids under the single `Attendance` tag.
 *
 * Four reads that answer four different questions, so one blanket tag would refetch all of
 * them on every mark. The register is keyed on the class *and* the date because saving
 * Tuesday's register does not change Monday's, and a teacher moving between dates should
 * not lose the cached ones.
 */
const registerTag = (classId: number, attendanceDate?: string) =>
  ({ type: 'Attendance', id: `class-${classId}-${attendanceDate ?? 'today'}` }) as const

const historyTag = (studentId: number) =>
  ({ type: 'Attendance', id: `student-${studentId}` }) as const

/** The two aggregates. Any mark anywhere changes both, so neither is keyed on a window. */
const SUMMARY_TAG = { type: 'Attendance', id: 'summary' } as const
const DAILY_TAG = { type: 'Attendance', id: 'daily' } as const

/**
 * AttendanceController -- all six endpoints.
 *
 * Every one is `AdminOrTeacher` *and*, as of this phase, gated on the `Attendance` module
 * in the permission grid. Both writes need `Attendance:Create`, including corrections:
 * marking is a MERGE, so there is no separate update for `Attendance:Edit` to gate.
 *
 * The audience gap is worth knowing before wiring a link to any of this. The seeded grid
 * gives Student and Parent `Attendance:View`, but all six endpoints are Admin/Teacher only,
 * so those two roles would get a 403 from every one of them. The nav entry is
 * role-restricted to match, and FRONTEND_PLAN.md §7 records it.
 *
 * Cross-module invalidation: `Student` is invalidated on both writes, because
 * `sp_GetStudentProfile` reports the student's own attendance figures and would otherwise
 * keep showing the numbers from before the register was taken.
 */
export const attendanceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Attendance/class/{classId} -- `Attendance:View`. The register.
     *
     * The only endpoint that reports unmarked students, because it is driven from the class
     * roll and LEFT JOINs the attendance rows. An empty list here means the class has no
     * students, not that nobody was marked.
     *
     * `attendanceDate` is sent explicitly even for today: the controller's fallback is
     * `DateTime.Today` on the *server*, which is a different day from the user's whenever
     * the two are in different zones either side of midnight.
     */
    getClassAttendance: build.query<ClassAttendanceRow[], ClassAttendanceQuery>({
      query: ({ classId, attendanceDate }) => ({
        url: `/attendance/class/${classId}`,
        params: { attendanceDate },
      }),
      providesTags: (_result, _error, { classId, attendanceDate }) => [
        registerTag(classId, attendanceDate),
      ],
    }),

    /**
     * GET /api/Attendance/student/{studentId} -- `Attendance:View`. One student's history.
     *
     * Marked days only, newest first. Carries no `classId`, so nothing can be corrected
     * from here; see the note on `StudentAttendanceRow`.
     */
    getStudentAttendance: build.query<StudentAttendanceRow[], StudentAttendanceQuery>({
      query: ({ studentId, startDate, endDate }) => ({
        url: `/attendance/student/${studentId}`,
        params: { startDate, endDate },
      }),
      providesTags: (_result, _error, { studentId }) => [historyTag(studentId)],
    }),

    /**
     * GET /api/Attendance/summary -- `Attendance:View`. Per-student percentages.
     *
     * Every active student appears, including those with nothing recorded -- whose
     * percentage is null rather than zero. This is also the only read that carries both
     * `studentId` and `classId`, which makes it the one place a single-day correction can
     * be started from.
     */
    getAttendanceSummary: build.query<AttendanceSummaryRow[], AttendanceReportQuery>({
      query: (params) => ({ url: '/attendance/summary', params }),
      providesTags: [SUMMARY_TAG],
    }),

    /**
     * GET /api/Attendance/daily-report -- `Attendance:View`. One row per date.
     *
     * Driven from the attendance rows, so dates with nothing marked are missing rather than
     * zeroed. The gaps are the finding: they are the days no register was taken.
     */
    getDailyAttendanceReport: build.query<DailyAttendanceRow[], AttendanceReportQuery>({
      query: (params) => ({ url: '/attendance/daily-report', params }),
      providesTags: [DAILY_TAG],
    }),

    /**
     * POST /api/Attendance -- `Attendance:Create`. One student, one date.
     *
     * An upsert, so this both marks and corrects. Its one refusal is a student who is not
     * actively enrolled in the class given -- `sp_MarkAttendance` checks that so a wrong
     * class id cannot file a record against another register -- and the message has to be
     * shown, because the remedy is to fix the class rather than to retry.
     */
    markAttendance: build.mutation<void, AttendanceMarkPayload>({
      query: (body) => ({ url: '/attendance', method: 'POST', body }),
      invalidatesTags: (_result, _error, { classId, attendanceDate, studentId }) => [
        registerTag(classId, attendanceDate),
        historyTag(studentId),
        SUMMARY_TAG,
        DAILY_TAG,
        { type: 'Student', id: studentId },
      ],
    }),

    /**
     * POST /api/Attendance/bulk -- `Attendance:Create`. A whole register in one transaction.
     *
     * Partial success is the case to design for. One MERGE inside an explicit transaction
     * with `XACT_ABORT ON`, so a failure leaves the register untouched rather than
     * half-marked -- but records naming a student who is not enrolled in the class are
     * filtered out beforehand and merely counted. A 200 with `recordsSkipped > 0` is
     * therefore a save that did less than asked, and callers must read the counts instead
     * of showing a bare success.
     *
     * `records` must not contain a repeated `studentId`: the procedure's table variable
     * declares it `PRIMARY KEY`, so a duplicate throws and takes the whole submission with
     * it.
     */
    markAttendanceBulk: build.mutation<AttendanceBulkMarkResult, AttendanceBulkMarkPayload>({
      query: (body) => ({ url: '/attendance/bulk', method: 'POST', body }),
      invalidatesTags: (_result, _error, { classId, attendanceDate, records }) => [
        registerTag(classId, attendanceDate),
        SUMMARY_TAG,
        DAILY_TAG,
        // Derived from the payload rather than blanketed: we know exactly whose history and
        // whose profile figures just changed.
        ...records.map((record) => historyTag(record.studentId)),
        ...records.map((record) => ({ type: 'Student' as const, id: record.studentId })),
        { type: 'Student' as const, id: LIST_ID },
      ],
    }),
  }),
})

export const {
  useGetClassAttendanceQuery,
  useGetStudentAttendanceQuery,
  useGetAttendanceSummaryQuery,
  useGetDailyAttendanceReportQuery,
  useMarkAttendanceMutation,
  useMarkAttendanceBulkMutation,
} = attendanceApi
