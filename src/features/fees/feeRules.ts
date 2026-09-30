import { addMonths } from 'date-fns'
import { toApiDate } from '@/lib/dates'
import type { FeeAssignmentItem, FeeStatusName, PaymentRow } from './types'

/**
 * The limits FeeAssignmentItemDTO, FeeUpdateDTO and FeePaymentCreateDTO enforce, and the
 * CHECK constraints on `Fees` behind them. One place, so the dialogs cannot drift apart.
 */
export const FEE_LIMITS = {
  amount: { min: 0.01, max: 999_999.99 },
  defaultAmount: { min: 0, max: 999_999.99 },
  year: { min: 2000, max: 2200 },
  /** StudentFeeAssignDTO's MaxLength. */
  batch: 50,
  /** The ledger endpoint refuses a wider window. */
  ledgerDays: 366,
} as const

/** PaymentMethod's [AllowedValues], with labels for the one that is not a word. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  Cash: 'Cash',
  Card: 'Card',
  UPI: 'UPI',
  BankTransfer: 'Bank transfer',
  Cheque: 'Cheque',
}

/** Methods for which a reference number is expected on the receipt. Cash has none. */
export const METHODS_WITH_REFERENCE = new Set(['Card', 'UPI', 'BankTransfer', 'Cheque'])

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** `Sep 2026`. The billing period, which is not the due date and not the payment date. */
export function formatPeriod(feeMonth: number, feeYear: number): string {
  return `${MONTHS[feeMonth - 1] ?? '?'} ${feeYear}`
}

export const MONTH_OPTIONS = MONTHS.map((label, index) => ({ value: index + 1, label }))

/**
 * Money for reading, always two places. No currency symbol: nothing in the schema records
 * which currency a school bills in, and guessing one would print the wrong symbol on a receipt.
 */
export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Round to the cent. Every amount crosses into a `DECIMAL(10,2)`, and `0.1 + 0.2` is not
 * `0.3`: a balance summed in floating point can come out a hair above the true figure, and the
 * server's "cannot exceed the outstanding balance" check would then refuse paying it in full.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100) / 100
}

export const STATUS_COLOR: Record<FeeStatusName, 'success' | 'warning' | 'error'> = {
  Paid: 'success',
  Pending: 'warning',
  Overdue: 'error',
}

export function paymentStatusColor(status: string): 'success' | 'default' | 'warning' {
  if (status === 'Completed') return 'success'
  if (status === 'Refunded') return 'default'
  return 'warning'
}

export function studentName(row: { firstName: string; lastName: string }): string {
  return `${row.firstName} ${row.lastName}`.trim()
}

/**
 * The rows sent to `POST /fees/students/{id}` for one fee type billed over consecutive months.
 *
 * Month `i` is billed for `start + i` and falls due `i` months after the first due date, so a
 * term's tuition billed in one go keeps the same day of the month for each instalment.
 * `addMonths` clamps a 31st to the end of a shorter month rather than rolling into the next.
 * The period is always sent explicitly — the procedure would otherwise take it from the due
 * date, and a fee due on the 5th of the following month would be filed under the wrong period.
 */
export function buildInstalments(args: {
  feeTypeId: number
  amount: number
  firstDueDate: Date
  feeMonth: number
  feeYear: number
  months: number
}): FeeAssignmentItem[] {
  const items: FeeAssignmentItem[] = []
  for (let i = 0; i < args.months; i += 1) {
    const offset = args.feeMonth - 1 + i
    items.push({
      feeTypeId: args.feeTypeId,
      amount: toCents(args.amount),
      dueDate: toApiDate(addMonths(args.firstDueDate, i)) ?? '',
      feeMonth: (offset % 12) + 1,
      feeYear: args.feeYear + Math.floor(offset / 12),
    })
  }
  return items
}

/** A sentence for a billing response, naming the skips rather than hiding them. */
export function assignSummary(created: number, skipped: number): string {
  const billed = `Billed ${created} fee${created === 1 ? '' : 's'}`
  if (skipped === 0) return `${billed}.`
  return `${billed}; ${skipped} skipped — already billed for that period, or the fee type is no longer active.`
}

/** Totals over payment rows. Refunded rows are counted apart: they are not money held. */
export function paymentTotals(rows: readonly PaymentRow[]): {
  collected: number
  refunded: number
  count: number
} {
  let collected = 0
  let refunded = 0
  let count = 0
  for (const row of rows) {
    if (row.paymentStatus === 'Completed') {
      collected += row.amountPaid
      count += 1
    } else if (row.paymentStatus === 'Refunded') {
      refunded += row.amountPaid
    }
  }
  return { collected: toCents(collected), refunded: toCents(refunded), count }
}
