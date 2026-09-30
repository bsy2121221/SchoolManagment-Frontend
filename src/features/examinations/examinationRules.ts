import { isAfter, isSameDay } from 'date-fns'
import { parseApiDate, today } from '@/lib/dates'
import type { ExaminationRow, MarkSheetRow } from './types'

/**
 * The judgements the examination screens share, kept out of the components.
 *
 * A separate module for the reason `attendanceRules.ts` and `classLookup.ts` are: a file
 * exporting both a component and a helper trips oxlint's `react(only-export-components)`.
 */

/**
 * Suggestions for the exam-type box, which is free text in the column (`NVARCHAR(50)`) and
 * validated nowhere. Offering a list keeps a school's reports from splitting across
 * "Mid Term", "Mid-term" and "midterm", which are three different types as far as every
 * filter here is concerned — and since the type is part of the upsert key, also three
 * different examinations.
 *
 * "Mid Term" is what the seed writes, so it is first.
 */
export const EXAM_TYPES = [
  'Mid Term',
  'Unit Test',
  'Final Term',
  'Annual',
  'Pre-Board',
  'Practical',
  'Assignment',
] as const

/** The server's DataAnnotations ranges, so the form refuses what the API would. */
export const MARK_LIMITS = {
  maxMarks: { min: 1, max: 1000 },
  passingMarks: { min: 0, max: 1000 },
  /** Minutes. Optional — `Examinations.Duration` is nullable. */
  duration: { min: 1, max: 600 },
} as const

/** Where an exam sits relative to today. Drives the chip on the list, nothing else. */
export type ExamTiming = 'past' | 'today' | 'upcoming'

export function examTiming(examDate: string): ExamTiming {
  const date = parseApiDate(examDate)
  if (!date) return 'past'
  const now = today()
  if (isSameDay(date, now)) return 'today'
  return isAfter(date, now) ? 'upcoming' : 'past'
}

/**
 * How far marking has got: `{ entered, total, percent }`.
 *
 * `percent` is clamped to 100 deliberately. `resultsEntered` counts results and `studentCount`
 * counts the class, and a student who was marked and has since transferred out still has a
 * result — so 31 of 30 is a real state, not a fault, and a progress bar has to survive it.
 *
 * `total` of 0 gives a percent of 0 rather than a division by zero: an exam for a class with
 * nobody in it has nothing to mark, which is not the same as being finished.
 */
export function markingProgress(row: ExaminationRow): {
  entered: number
  total: number
  percent: number
  complete: boolean
} {
  const { resultsEntered: entered, studentCount: total } = row
  const percent = total === 0 ? 0 : Math.min(100, Math.round((entered / total) * 100))
  return { entered, total, percent, complete: total > 0 && entered >= total }
}

/** Minutes as `2h 00m`, `45m`, or a dash when the exam has no recorded duration. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return `${hours}h ${String(rest).padStart(2, '0')}m`
}

/**
 * What a mark sheet row actually says about a student.
 *
 * This function exists to stop anything reading `isPass` on its own. The procedure computes
 * it as `ObtainedMarks >= @PassingMarks`, and `NULL >= 40` is unknown in SQL, so it falls to
 * the ELSE — an unmarked student comes back with `isPass: false`. A grid that binds the
 * column straight to that field shows "Fail" against every student nobody has marked yet,
 * which is both wrong and the kind of wrong that gets shown to a parent.
 */
export type MarkStatus = 'unmarked' | 'pass' | 'fail'

export function markStatus(row: MarkSheetRow): MarkStatus {
  if (row.obtainedMarks === null) return 'unmarked'
  return row.isPass ? 'pass' : 'fail'
}

/** MUI palette key for a status. Unmarked is grey, not red — it is an absence, not a failure. */
export function markTone(status: MarkStatus): 'success' | 'error' | 'default' {
  if (status === 'unmarked') return 'default'
  return status === 'pass' ? 'success' : 'error'
}

/** `72 / 100`, or a dash when there is no mark. Never `0 / 100` for an unmarked student. */
export function formatMarks(row: MarkSheetRow): string {
  if (row.obtainedMarks === null) return '—'
  return `${row.obtainedMarks} / ${row.maxMarks}`
}

/** A percentage to one decimal place, or "Not marked" when there is nothing to show. */
export function formatPercentage(percentage: number | null): string {
  if (percentage === null) return 'Not marked'
  return `${percentage.toFixed(1)}%`
}

/**
 * The figures above a mark sheet.
 *
 * Every rate is over the **marked** students, and `marked` is reported alongside so the
 * screen can say what the denominator was. Averaging over the whole class instead would let
 * an exam that is a third marked report a third of its real average, which looks like a
 * catastrophe rather than like unfinished work.
 */
export function markSheetSummary(rows: readonly MarkSheetRow[]): {
  onRoll: number
  marked: number
  unmarked: number
  passed: number
  failed: number
  passRate: number | null
  averagePercentage: number | null
  highest: MarkSheetRow | null
} {
  const marked = rows.filter((row) => row.obtainedMarks !== null)
  const passed = marked.filter((row) => row.isPass).length

  // Reduce rather than sort: a sort would need a copy, since `rows` is RTK Query's frozen
  // array. Ties resolve to the first, which the procedure already ranked by roll number.
  const highest = marked.reduce<MarkSheetRow | null>(
    (best, row) =>
      best === null || (row.obtainedMarks ?? 0) > (best.obtainedMarks ?? 0) ? row : best,
    null,
  )

  const totalPercentage = marked.reduce((sum, row) => sum + (row.percentage ?? 0), 0)

  return {
    onRoll: rows.length,
    marked: marked.length,
    unmarked: rows.length - marked.length,
    passed,
    failed: marked.length - passed,
    passRate: marked.length === 0 ? null : (passed / marked.length) * 100,
    averagePercentage: marked.length === 0 ? null : totalPercentage / marked.length,
    highest,
  }
}
