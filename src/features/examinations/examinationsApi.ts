import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  ExaminationPayload,
  ExaminationRow,
  ExaminationSaveResult,
  MarkSheetRow,
} from './types'

/**
 * ExaminationsController — all five endpoints.
 *
 * Two things shape the cache here.
 *
 * The list is unpaged and the only filter is the class, so `GET /api/Examinations` is cached
 * per class id with `undefined` (all classes) as its own entry. Client-side filtering by
 * subject, type or name happens on top of whichever entry is loaded, so narrowing by subject
 * costs no request.
 *
 * The mark sheet is tagged `Result`, not `Examination`. It reads from `Results`, which
 * ResultsController writes — so entering a mark in Phase 11 has to invalidate this sheet, and
 * tagging it by the module that owns the data is what lets that work without either feature
 * importing the other. The counts on the list row (`resultsEntered`) move for the same
 * reason, which is why the mark-sheet tag is paired with the list tag on the write side.
 */
const sheetTag = (examinationId: number) =>
  ({ type: 'Result', id: `exam-${examinationId}` }) as const

export const examinationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * GET /api/Examinations — every active exam for the school, newest first, Admin/Teacher.
     *
     * Unpaged by the procedure, so `ClientDataGrid` rather than `ServerDataGrid`: the browser
     * genuinely holds every row and can sort all of them.
     */
    getExaminations: build.query<ExaminationRow[], { classId?: number } | void>({
      query: (args) => ({
        url: '/examinations',
        params: args?.classId === undefined ? undefined : { classId: args.classId },
      }),
      providesTags: (result) => [
        { type: 'Examination' as const, id: LIST_ID },
        ...(result ?? []).map((row) => ({ type: 'Examination' as const, id: row.id })),
      ],
    }),

    /**
     * GET /api/Examinations/{id} — 404 for a soft-deleted exam.
     *
     * The mark-sheet screen depends on that 404. `GET {id}/results` returns an empty array
     * both for an exam that does not exist and for a class with no students, so the header
     * read is the only thing that can tell the two apart.
     */
    getExamination: build.query<ExaminationRow, number>({
      query: (examinationId) => `/examinations/${examinationId}`,
      providesTags: (_result, _error, examinationId) => [
        { type: 'Examination', id: examinationId },
      ],
    }),

    /**
     * POST /api/Examinations — Admin/Teacher, `Examinations:Create`.
     *
     * Create *and* update, matched on (examName, examType, classId, subjectId). 201 on an
     * insert and 200 on an update, which the server now answers correctly from the
     * procedure's own `Operation` column rather than by guessing.
     *
     * The whole list is invalidated rather than one id, because the caller cannot know which
     * it got: a payload intended as an edit whose name was altered creates a new row instead
     * of touching the old one, and only the server knows that happened.
     */
    saveExamination: build.mutation<ExaminationSaveResult, ExaminationPayload>({
      query: (body) => ({ url: '/examinations', method: 'POST', body }),
      invalidatesTags: [{ type: 'Examination', id: LIST_ID }],
    }),

    /**
     * DELETE /api/Examinations/{id} — Admin only, `Examinations:Delete`.
     *
     * Soft, and it takes the marks with it: every result for the exam is deactivated in the
     * same transaction. So this invalidates `Result` as well — a student's own results screen
     * must stop showing a score for an exam that no longer exists.
     */
    deleteExamination: build.mutation<void, number>({
      query: (examinationId) => ({ url: `/examinations/${examinationId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, examinationId) => [
        { type: 'Examination', id: LIST_ID },
        { type: 'Examination', id: examinationId },
        sheetTag(examinationId),
        { type: 'Result', id: LIST_ID },
      ],
    }),

    /**
     * GET /api/Examinations/{id}/results — the mark sheet, ranked.
     *
     * A read only. Marks are entered through ResultsController, which is Phase 11; this is
     * the sheet those writes produce.
     */
    getExaminationResults: build.query<MarkSheetRow[], number>({
      query: (examinationId) => `/examinations/${examinationId}/results`,
      providesTags: (_result, _error, examinationId) => [
        sheetTag(examinationId),
        { type: 'Result', id: LIST_ID },
      ],
    }),
  }),
})

export const {
  useGetExaminationsQuery,
  useGetExaminationQuery,
  useSaveExaminationMutation,
  useDeleteExaminationMutation,
  useGetExaminationResultsQuery,
} = examinationsApi
