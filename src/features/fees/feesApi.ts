import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  CollectionPeriod,
  FeeAssignmentItem,
  FeeAssignResult,
  FeeDetails,
  FeePaymentPayload,
  FeePaymentRecorded,
  FeeType,
  FeeTypeCreated,
  FeeTypePayload,
  FeeUpdatePayload,
  OutstandingFee,
  OutstandingQuery,
  PaymentRangeQuery,
  PaymentRow,
  Receipt,
  StudentFee,
} from './types'

/**
 * FeesController — all eighteen endpoints.
 *
 * One tag type, `Fee`, split by id:
 *
 *   `LIST`            every money figure: the reports, the ledger, every student account. The
 *                     student profile (Phase 5) provides it too, which is how recording a
 *                     payment here refreshes the balance panel there without either feature
 *                     importing the other.
 *   `types`           the price list. Kept apart so editing a fee type does not refetch every
 *                     account, and billing does not refetch the price list.
 *   `student-{id}`    one student's fees and payment history.
 *   `receipt-{no}`    one receipt. Refunds invalidate the whole LIST, which covers it.
 *
 * Money writes invalidate `LIST` rather than a narrower id on purpose. A payment moves the
 * student's balance, the outstanding report, the collection summary, the ledger and the student
 * profile at once; a narrower tag would leave one of them showing a figure the others disagree
 * with, which on a finance screen is worse than one extra request.
 */
const TYPES_ID = 'types'
const studentTag = (studentId: number) => ({ type: 'Fee', id: `student-${studentId}` }) as const

export const feesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** GET /api/Fees/fee-types — AllSchoolUsers, `Fees:View`. Active only, by name. */
    getFeeTypes: build.query<FeeType[], void>({
      query: () => '/fees/fee-types',
      providesTags: [{ type: 'Fee', id: TYPES_ID }],
    }),

    /** POST /api/Fees/fee-types — Admin, `Fees:Create`. Revives a deleted type of the same name. */
    createFeeType: build.mutation<FeeTypeCreated, FeeTypePayload>({
      query: (body) => ({ url: '/fees/fee-types', method: 'POST', body }),
      invalidatesTags: [{ type: 'Fee', id: TYPES_ID }],
    }),

    /**
     * PUT /api/Fees/fee-types/{id} — Admin, `Fees:Edit`.
     *
     * Invalidates `LIST` as well as the price list, because a rename shows on every fee row
     * that carries the type's name. Amounts already billed do not move.
     */
    updateFeeType: build.mutation<void, { feeTypeId: number; body: FeeTypePayload }>({
      query: ({ feeTypeId, body }) => ({
        url: `/fees/fee-types/${feeTypeId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        { type: 'Fee', id: TYPES_ID },
        { type: 'Fee', id: LIST_ID },
      ],
    }),

    /** DELETE /api/Fees/fee-types/{id} — Admin, `Fees:Delete`. Refused while any fee uses it. */
    deleteFeeType: build.mutation<void, number>({
      query: (feeTypeId) => ({ url: `/fees/fee-types/${feeTypeId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Fee', id: TYPES_ID }],
    }),

    /** GET /api/Fees/students/{studentId} — Admin, `Fees:View`. */
    getStudentFees: build.query<StudentFee[], number>({
      query: (studentId) => `/fees/students/${studentId}`,
      providesTags: (_result, _error, studentId) => [
        studentTag(studentId),
        { type: 'Fee', id: LIST_ID },
      ],
    }),

    /** GET /api/Fees/{feeId} — Admin, `Fees:View`. 404 for a cancelled fee. */
    getFeeDetails: build.query<FeeDetails, number>({
      query: (feeId) => `/fees/${feeId}`,
      providesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /** POST /api/Fees/students/{studentId} — Admin, `Fees:Create`. Duplicates are skipped. */
    assignFeesToStudent: build.mutation<
      FeeAssignResult,
      { studentId: number; fees: FeeAssignmentItem[] }
    >({
      query: ({ studentId, fees }) => ({
        url: `/fees/students/${studentId}`,
        method: 'POST',
        body: { fees },
      }),
      invalidatesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /** POST /api/Fees/classes/{classId} — Admin, `Fees:Create`. Every active student. */
    assignFeeToClass: build.mutation<FeeAssignResult, { classId: number; fee: FeeAssignmentItem }>(
      {
        query: ({ classId, fee }) => ({
          url: `/fees/classes/${classId}`,
          method: 'POST',
          body: fee,
        }),
        invalidatesTags: [{ type: 'Fee', id: LIST_ID }],
      },
    ),

    /** PUT /api/Fees/{feeId} — Admin, `Fees:Edit`. Refused below what has been paid. */
    updateFee: build.mutation<void, { feeId: number; body: FeeUpdatePayload }>({
      query: ({ feeId, body }) => ({ url: `/fees/${feeId}`, method: 'PUT', body }),
      invalidatesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /** DELETE /api/Fees/{feeId} — Admin, `Fees:Delete`. Refused while a payment stands. */
    cancelFee: build.mutation<void, number>({
      query: (feeId) => ({ url: `/fees/${feeId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /**
     * POST /api/Fees/payments — Admin, `Fees:Create`.
     *
     * **Not idempotent.** A retry records a second payment. The caller must disable its submit
     * while this is in flight and must not retry automatically; see RecordPaymentDialog.
     */
    recordPayment: build.mutation<FeePaymentRecorded, FeePaymentPayload>({
      query: (body) => ({ url: '/fees/payments', method: 'POST', body }),
      invalidatesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /** GET /api/Fees/payments — Admin, `Fees:View`. Both dates required, at most 366 days. */
    getPayments: build.query<PaymentRow[], Required<PaymentRangeQuery>>({
      query: (params) => ({ url: '/fees/payments', params }),
      providesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /** POST /api/Fees/payments/{paymentId}/refund — Admin, `Fees:Edit`. Irreversible. */
    refundPayment: build.mutation<void, { paymentId: number; reason: string }>({
      query: ({ paymentId, reason }) => ({
        url: `/fees/payments/${paymentId}/refund`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /** GET /api/Fees/students/{studentId}/payment-history — Admin, `Fees:View`. */
    getPaymentHistory: build.query<PaymentRow[], { studentId: number } & PaymentRangeQuery>({
      query: ({ studentId, ...params }) => ({
        url: `/fees/students/${studentId}/payment-history`,
        params,
      }),
      providesTags: (_result, _error, { studentId }) => [
        studentTag(studentId),
        { type: 'Fee', id: LIST_ID },
      ],
    }),

    /** GET /api/Fees/receipts/{receiptNumber} — Admin, `Fees:View`. 404 when unknown. */
    getReceipt: build.query<Receipt, string>({
      query: (receiptNumber) => `/fees/receipts/${encodeURIComponent(receiptNumber)}`,
      providesTags: (_result, _error, receiptNumber) => [
        { type: 'Fee', id: `receipt-${receiptNumber}` },
        { type: 'Fee', id: LIST_ID },
      ],
    }),

    /** GET /api/Fees/outstanding — Admin, `Fees:View`. Includes departed students, flagged. */
    getOutstandingFees: build.query<OutstandingFee[], OutstandingQuery>({
      query: (params) => ({ url: '/fees/outstanding', params }),
      providesTags: [{ type: 'Fee', id: LIST_ID }],
    }),

    /** GET /api/Fees/collection-summary — Admin, `Fees:View`. By billing period. */
    getCollectionSummary: build.query<CollectionPeriod[], { feeYear?: number }>({
      query: (params) => ({ url: '/fees/collection-summary', params }),
      providesTags: [{ type: 'Fee', id: LIST_ID }],
    }),
  }),
})

export const {
  useGetFeeTypesQuery,
  useCreateFeeTypeMutation,
  useUpdateFeeTypeMutation,
  useDeleteFeeTypeMutation,
  useGetStudentFeesQuery,
  useGetFeeDetailsQuery,
  useAssignFeesToStudentMutation,
  useAssignFeeToClassMutation,
  useUpdateFeeMutation,
  useCancelFeeMutation,
  useRecordPaymentMutation,
  useGetPaymentsQuery,
  useRefundPaymentMutation,
  useGetPaymentHistoryQuery,
  useGetReceiptQuery,
  useGetOutstandingFeesQuery,
  useGetCollectionSummaryQuery,
} = feesApi
