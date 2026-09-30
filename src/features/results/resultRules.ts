import type { GradeEntryRecord, GradeEntryRow, StudentResultRow } from './types'

/**
 * Non-component module, like `examinationRules` and `attendanceRules`. A file that exports both a
 * component and a helper trips oxlint's `react(only-export-components)`, and these are needed by
 * two components and a page.
 */

/** What the user has typed into one row of the entry grid. Strings, because inputs hold strings. */
export interface GradeDraft {
  /** `''` means the box is empty, which is **not** the same as 0. */
  marks: string
  remarks: string
}

/** A row's draft as it starts out: whatever is on record, or empty if nothing is. */
export function draftFromRow(row: GradeEntryRow): GradeDraft {
  return {
    // The one place this whole module turns on. An unmarked student's box starts empty, not at 0,
    // because a 0 the teacher never touched is indistinguishable from one they meant.
    marks: row.currentMarks === null ? '' : String(row.currentMarks),
    remarks: row.currentRemarks ?? '',
  }
}

/** Every row's draft, keyed by `Students.Id`. */
export function draftsFromRows(rows: readonly GradeEntryRow[]): Record<number, GradeDraft> {
  const drafts: Record<number, GradeDraft> = {}
  for (const row of rows) drafts[row.studentId] = draftFromRow(row)
  return drafts
}

export type MarksProblem =
  | { kind: 'empty' }
  | { kind: 'not-a-number' }
  | { kind: 'not-an-integer' }
  | { kind: 'negative' }
  | { kind: 'over-max'; maxMarks: number }

/**
 * Whether a typed mark can be sent, and if not, why.
 *
 * `empty` is not an error — it is a row to leave alone. Everything else is, and the server would
 * reject them: `sp_AddOrUpdateResult` refuses marks outside 0..MaxMarks outright, and
 * `sp_BulkGradeEntry` silently drops them into its skipped count, which is worse because the
 * teacher is told the batch succeeded.
 */
export function marksProblem(raw: string, maxMarks: number): MarksProblem | null {
  const trimmed = raw.trim()
  if (trimmed === '') return { kind: 'empty' }

  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { kind: 'not-a-number' }
  // The column is INT, so a decimal would be truncated by SQL Server rather than refused --
  // silently turning 49.5 into 49. Caught here instead.
  if (!Number.isInteger(value)) return { kind: 'not-an-integer' }
  if (value < 0) return { kind: 'negative' }
  if (value > maxMarks) return { kind: 'over-max', maxMarks }
  return null
}

/** The message for a problem, or null when there is nothing to say. */
export function marksProblemMessage(problem: MarksProblem | null): string | null {
  if (!problem) return null
  switch (problem.kind) {
    case 'empty':
      return null
    case 'not-a-number':
      return 'Numbers only'
    case 'not-an-integer':
      return 'Whole marks only'
    case 'negative':
      return 'Cannot be negative'
    case 'over-max':
      return `Maximum is ${problem.maxMarks}`
  }
}

/**
 * The record to send for one row, or null to leave that student alone.
 *
 * Null in three cases, and they are three genuinely different reasons:
 *
 *   1. The box is empty. The student stays unmarked. There is no way to *clear* a mark through
 *      this API — the upsert's MERGE has no DELETE branch — so an emptied box on a student who
 *      already has a mark cannot be honoured either, and is treated as "leave as it was".
 *   2. The mark is invalid. Sending it would have it dropped into `entriesSkipped`.
 *   3. Nothing changed. Resubmitting an identical mark would bump `UpdatedAt` and make the record
 *      claim it was corrected when it was not.
 *
 * `grade` is never sent. The server derives the letter from the school's own thresholds, and
 * supplying one overrides that school's scale for a single mark.
 */
export function pendingRecord(row: GradeEntryRow, draft: GradeDraft): GradeEntryRecord | null {
  if (marksProblem(draft.marks, row.maxMarks)) return null

  const marks = Number(draft.marks.trim())
  const remarks = draft.remarks.trim()
  const currentRemarks = (row.currentRemarks ?? '').trim()

  if (row.hasResult && marks === row.currentMarks && remarks === currentRemarks) return null

  return {
    studentId: row.studentId,
    obtainedMarks: marks,
    remarks: remarks === '' ? null : remarks,
  }
}

/** Whether a row differs from what is on record — what drives the "unsaved" marker. */
export function isRowDirty(row: GradeEntryRow, draft: GradeDraft): boolean {
  const marks = draft.marks.trim()
  const onRecord = row.currentMarks === null ? '' : String(row.currentMarks)
  if (marks !== onRecord) return true
  return draft.remarks.trim() !== (row.currentRemarks ?? '').trim()
}

export interface EntryProgress {
  /** Students on the roll. */
  onRoll: number
  /** Students with a mark on record, before anything typed this session. */
  marked: number
  /** Rows the user has changed, valid or not. */
  touched: number
  /** Rows that would be sent. */
  sendable: number
  /** Rows the user has changed that cannot be sent as they stand. */
  invalid: number
}

export function entryProgress(
  rows: readonly GradeEntryRow[],
  drafts: Record<number, GradeDraft>,
): EntryProgress {
  let marked = 0
  let touched = 0
  let sendable = 0
  let invalid = 0

  for (const row of rows) {
    if (row.hasResult) marked += 1

    const draft = drafts[row.studentId]
    if (!draft) continue

    const dirty = isRowDirty(row, draft)
    if (dirty) touched += 1

    if (pendingRecord(row, draft)) {
      sendable += 1
    } else if (dirty && marksProblem(draft.marks, row.maxMarks)?.kind !== 'empty') {
      // Dirty, not sendable, and not merely blank: the mark is bad rather than absent.
      invalid += 1
    }
  }

  return { onRoll: rows.length, marked, touched, sendable, invalid }
}

/** A percentage from a mark, or null if there is no mark. Rounded as the server rounds. */
export function marksPercentage(marks: number | null, maxMarks: number): number | null {
  if (marks === null || maxMarks <= 0) return null
  return Math.round((marks / maxMarks) * 100 * 100) / 100
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`
}

/**
 * How a typed mark stands against the pass mark, for the live indicator beside the input.
 *
 * `null` for an empty or invalid box rather than a guess, so an unmarked row shows nothing at all
 * instead of the "Fail" that a boolean would give it — the same trap §7.32 records on the server
 * side of Examinations.
 */
export function draftOutcome(row: GradeEntryRow, draft: GradeDraft): 'pass' | 'fail' | null {
  if (marksProblem(draft.marks, row.maxMarks)) return null
  return Number(draft.marks.trim()) >= row.passingMarks ? 'pass' : 'fail'
}

export interface ReportCardSummary {
  /** Marks on the card. */
  count: number
  passed: number
  failed: number
  /** Mean of the per-result percentages, or null with nothing on the card. */
  averagePercentage: number | null
  /** Best and worst by percentage. Null when the card is empty. */
  best: StudentResultRow | null
  worst: StudentResultRow | null
  /** Distinct subjects examined. */
  subjects: number
  /** How many distinct examinations. Not the same as `count` only if data is inconsistent. */
  examinations: number
}

/**
 * The figures across a whole report card.
 *
 * The average is of the *percentages*, not of the raw marks: a 40-mark quiz and a 100-mark final
 * are not comparable as marks, and averaging them would weight the final two and a half times as
 * heavily by accident rather than by intent.
 *
 * `best`/`worst` use `reduce` rather than a sort, because RTK Query's cached array is frozen and
 * `sort` mutates in place.
 */
export function reportCardSummary(rows: readonly StudentResultRow[]): ReportCardSummary {
  if (rows.length === 0) {
    return {
      count: 0,
      passed: 0,
      failed: 0,
      averagePercentage: null,
      best: null,
      worst: null,
      subjects: 0,
      examinations: 0,
    }
  }

  let passed = 0
  let total = 0
  // Nullable rather than seeded from `rows[0]`, which the compiler types as possibly undefined
  // under `noUncheckedIndexedAccess` even after the length check above.
  let best: StudentResultRow | null = null
  let worst: StudentResultRow | null = null
  const subjects = new Set<number>()
  const examinations = new Set<number>()

  for (const row of rows) {
    if (row.isPass) passed += 1
    total += row.percentage
    if (best === null || row.percentage > best.percentage) best = row
    if (worst === null || row.percentage < worst.percentage) worst = row
    subjects.add(row.subjectId)
    examinations.add(row.examinationId)
  }

  return {
    count: rows.length,
    passed,
    failed: rows.length - passed,
    averagePercentage: Math.round((total / rows.length) * 100) / 100,
    best,
    worst,
    subjects: subjects.size,
    examinations: examinations.size,
  }
}

export interface SubjectBreakdown {
  subjectId: number
  subjectName: string
  subjectCode: string | null
  count: number
  passed: number
  averagePercentage: number
  /** Most recent first, as the endpoint returns them. */
  results: StudentResultRow[]
}

/**
 * The card grouped by subject, each group's own average alongside.
 *
 * Grouped on `subjectId` rather than on `subjectName`, because two subjects can share a display
 * name across grades and collapsing them would average unrelated marks together.
 */
export function subjectBreakdown(rows: readonly StudentResultRow[]): SubjectBreakdown[] {
  const groups = new Map<number, SubjectBreakdown>()

  for (const row of rows) {
    let group = groups.get(row.subjectId)
    if (!group) {
      group = {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        count: 0,
        passed: 0,
        averagePercentage: 0,
        results: [],
      }
      groups.set(row.subjectId, group)
    }
    group.count += 1
    if (row.isPass) group.passed += 1
    // Running total for now; divided once the group is complete.
    group.averagePercentage += row.percentage
    group.results.push(row)
  }

  const breakdown = [...groups.values()]
  for (const group of breakdown) {
    group.averagePercentage = Math.round((group.averagePercentage / group.count) * 100) / 100
  }

  return breakdown.sort((a, b) => a.subjectName.localeCompare(b.subjectName))
}

/** Tone for a percentage, shared by the cards and the tables so one figure reads one way. */
export function percentTone(
  value: number | null,
): 'success' | 'warning' | 'error' | 'default' {
  if (value === null) return 'default'
  if (value >= 60) return 'success'
  if (value >= 40) return 'warning'
  return 'error'
}
