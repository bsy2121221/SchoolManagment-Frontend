import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  BulkGradeEntryPayload,
  BulkGradeEntryResult,
  GradeEntryRow,
  SingleResultPayload,
  StudentResultRow,
} from './types'

/** The grade-entry feed. Needs all three ids: the exam alone is not what the endpoint takes. */
export interface GradeEntryQuery {
  subjectId: number
  classId: number
  /**
   * Always sent by this client. Omitted, the server picks the most recent examination for the
   * class and subject — which is a different examination from the one the user chose as soon as a
   * newer one is scheduled, and the roll would come back marked against it.
   */
  examinationId: number
}

/**
 * Cache ids under the `Result` tag.
 *
 * The entry roll is keyed on the examination, because marks for one exam are not marks for
 * another and a teacher moving between exams should not lose the cached rolls.
 *
 * `sheetTag` is deliberately the same shape Phase 10's `examinationsApi` invalidates: that module
 * tags its mark sheet `{ type: 'Result', id: 'exam-<id>' }` precisely so this one can invalidate
 * it without either feature importing the other. Entering marks here refreshes the mark sheet
 * there.
 */
const rollTag = (examinationId: number) =>
  ({ type: 'Result', id: `entry-${examinationId}` }) as const

const sheetTag = (examinationId: number) =>
  ({ type: 'Result', id: `exam-${examinationId}` }) as const

const studentTag = (studentId: number) =>
  ({ type: 'Result', id: `student-${studentId}` }) as const

/**
 * What a write to one examination invalidates.
 *
 * The student report cards are invalidated as a whole (`LIST_ID`) rather than per student. A bulk
 * submission touches up to a full class, and listing the affected students here would mean
 * trusting the client's idea of who was in the payload over the server's idea of who was actually
 * saved — and those differ whenever `entriesSkipped` is non-zero.
 *
 * `Examination` is invalidated too, because Phase 10's list carries a `resultsEntered` count and a
 * marking-progress bar that this write is exactly what changes.
 */
const writeInvalidates = (examinationId: number) => [
  rollTag(examinationId),
  sheetTag(examinationId),
  { type: 'Result' as const, id: LIST_ID },
  { type: 'Examination' as const, id: LIST_ID },
  { type: 'Examination' as const, id: examinationId },
]

/**
 * ResultsController — all four endpoints.
 *
 * Every one is gated on the `Results` module in the permission grid as of this phase; the
 * controller carried no `[RequiresPermission]` at all before. Both writes need `Results:Create`,
 * including corrections — they are upserts, so there is no separate update for `Results:Edit` to
 * gate, the same shape as Attendance's marking.
 */
export const resultsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * The class roll for one examination, with any marks already entered.
     *
     * A 403 here is a real answer, not a bug: a teacher is held to their subject-and-class
     * assignments. An administrator bypasses that check. An empty array means the roll is empty or
     * no such examination is active — it no longer also means "you are not allowed", which it did
     * before this phase.
     */
    getGradeEntryRoll: build.query<GradeEntryRow[], GradeEntryQuery>({
      query: ({ subjectId, classId, examinationId }) => ({
        url: '/Results/grade-entry',
        params: { subjectId, classId, examinationId },
      }),
      providesTags: (_result, _error, { examinationId }) => [rollTag(examinationId)],
    }),

    /** Every mark one student has been given, newest examination first. */
    getStudentResults: build.query<StudentResultRow[], number>({
      query: (studentId) => `/Results/student/${studentId}`,
      providesTags: (_result, _error, studentId) => [
        studentTag(studentId),
        { type: 'Result', id: LIST_ID },
      ],
    }),

    /**
     * One mark, for correcting a single student without resubmitting the class.
     *
     * Returns no body worth having, so the caller gets the envelope's message. Note there is no
     * delete: this is an upsert, and a mark entered against the wrong student can be corrected but
     * never withdrawn.
     */
    saveResult: build.mutation<void, SingleResultPayload>({
      query: (body) => ({ url: '/Results', method: 'POST', body }),
      invalidatesTags: (_result, error, { examinationId }) =>
        error ? [] : writeInvalidates(examinationId),
    }),

    /**
     * A whole class in one write.
     *
     * Answers 200 with counts even when it saved nothing it was asked to, so the caller must read
     * `entriesSkipped` rather than treating the status as the outcome. The skipped rows are those
     * whose student is not in the examination's class or whose marks fall outside 0..maxMarks; the
     * server does not say which rows, only how many.
     */
    bulkGradeEntry: build.mutation<BulkGradeEntryResult, BulkGradeEntryPayload>({
      query: (body) => ({ url: '/Results/bulk', method: 'POST', body }),
      invalidatesTags: (_result, error, { examinationId }) =>
        error ? [] : writeInvalidates(examinationId),
    }),
  }),
})

export const {
  useGetGradeEntryRollQuery,
  useGetStudentResultsQuery,
  useSaveResultMutation,
  useBulkGradeEntryMutation,
} = resultsApi
