/**
 * Mirrors SchoolManagment.Models/DTOs/Fees and the procedures in 11_Procs_Fees.sql.
 *
 * As everywhere else, the school is absent from the request shapes: `SchoolId` comes from the
 * token. Dates arrive as `2026-09-26T00:00:00` (a `DateTime` with no offset) and go out as
 * `yyyy-MM-dd`; read them through `parseApiDate` / `formatDate`, never `new Date()`.
 *
 * Two ids are easy to confuse in this module:
 *   - `studentId` is always `Students.Id`, the record id, on every shape here.
 *   - `studentNumber` is the printed admission number (`STU2026001`).
 */

/** What `sp_GetStudentFees` and friends compute. `Overdue` is unpaid past its due date. */
export type FeeStatusName = 'Paid' | 'Pending' | 'Overdue'

/** `FeeTypeDTO` — one line of the school's price list. */
export interface FeeType {
  id: number
  feeTypeName: string
  description: string | null
  /** A suggestion for the billing dialogs, not a price anything is held to. */
  defaultAmount: number | null
  isActive: boolean
}

/** `FeeTypeCreateDTO`, used for both create and update. */
export interface FeeTypePayload {
  feeTypeName: string
  description: string | null
  defaultAmount: number | null
}

/** `FeeTypeResponseDTO`. */
export interface FeeTypeCreated {
  feeTypeId: number
}

/** `StudentFeeDTO` — one fee billed to one student, with what has been paid against it. */
export interface StudentFee {
  id: number
  amount: number
  dueDate: string
  feeMonth: number
  feeYear: number
  feeTypeId: number
  feeTypeName: string
  description: string | null
  /** Completed payments only; refunded ones stop counting. */
  totalPaid: number
  balance: number
  status: FeeStatusName
}

/** `FeeDetailsDTO` — as `StudentFee`, plus who it is billed to. */
export interface FeeDetails extends StudentFee {
  studentId: number
  studentNumber: string
  rollNumber: string | null
  firstName: string
  lastName: string
}

/** `FeeUpdateDTO`. */
export interface FeeUpdatePayload {
  amount: number
  dueDate: string
}

/** `FeeAssignmentItemDTO`. A null period is taken from the due date by the procedure. */
export interface FeeAssignmentItem {
  feeTypeId: number
  amount: number
  dueDate: string
  feeMonth: number | null
  feeYear: number | null
}

/** `FeeAssignResponseDTO`. A non-zero `feesSkipped` on a 200 is a partial success. */
export interface FeeAssignResult {
  feesCreated: number
  feesSkipped: number
}

/** `FeePaymentCreateDTO`. There is no status and no date: always Completed, always today. */
export interface FeePaymentPayload {
  feeId: number
  amountPaid: number
  paymentMethod: string
  transactionId: string | null
  remarks: string | null
}

/** `FeePaymentResponseDTO`. */
export interface FeePaymentRecorded {
  paymentId: number
  /** Server-generated, e.g. `DPSNOIDA_RCPT_2026_000123`. The receipt route is keyed on it. */
  receiptNumber: string
}

/** `PaymentHistoryDTO` — one row of a student's history or of the school ledger. */
export interface PaymentRow {
  id: number
  receiptNumber: string
  amountPaid: number
  paymentDate: string
  paymentMethod: string
  transactionId: string | null
  /** `Completed` or `Refunded` in practice; the column allows Pending and Failed too. */
  paymentStatus: string
  remarks: string | null
  feeId: number
  feeMonth: number
  feeYear: number
  /** The fee's amount, not a running total. */
  totalAmount: number
  feeTypeName: string
  studentId: number
  studentNumber: string
  rollNumber: string | null
  firstName: string
  lastName: string
  className: string | null
  /** The cashier. Null only for a payment whose user has since been removed. */
  receivedBy: string | null
}

/** `ReceiptDTO` — everything a printed receipt carries. */
export interface Receipt {
  paymentId: number
  receiptNumber: string
  amountPaid: number
  paymentDate: string
  paymentMethod: string
  transactionId: string | null
  paymentStatus: string
  remarks: string | null

  feeId: number
  feeAmount: number
  feeMonth: number
  feeYear: number
  dueDate: string
  feeTypeName: string
  /** As of now, not as of this receipt — a later payment moves it. */
  feeTotalPaid: number
  /** As of now, not as of this receipt. */
  feeBalance: number

  studentId: number
  studentNumber: string
  rollNumber: string | null
  firstName: string
  lastName: string
  className: string | null
  grade: string | null
  section: string | null

  receivedBy: string | null
  schoolName: string
  schoolCode: string
  schoolAddress: string | null
  schoolPhone: string | null
}

/** `OutstandingFeeDTO` — one unpaid fee. Includes students who have left, flagged. */
export interface OutstandingFee {
  feeId: number
  studentId: number
  studentNumber: string
  rollNumber: string | null
  firstName: string
  lastName: string
  studentIsActive: boolean
  classId: number | null
  className: string | null
  grade: string | null
  section: string | null
  feeTypeId: number
  feeTypeName: string
  amount: number
  totalPaid: number
  balance: number
  dueDate: string
  feeMonth: number
  feeYear: number
  /** Zero or negative when the fee is not yet due. */
  daysOverdue: number
  status: FeeStatusName
}

/** Query string for `GET /api/Fees/outstanding`. */
export interface OutstandingQuery {
  classId?: number
  feeTypeId?: number
  overdueOnly?: boolean
}

/** `FeeCollectionPeriodDTO` — one billing month. Grouped by billing period, not payment date. */
export interface CollectionPeriod {
  feeYear: number
  feeMonth: number
  feeCount: number
  billed: number
  collected: number
  outstanding: number
}

/** Query string for the two payment reads. Both `yyyy-MM-dd`, inclusive. */
export interface PaymentRangeQuery {
  startDate?: string
  endDate?: string
}
