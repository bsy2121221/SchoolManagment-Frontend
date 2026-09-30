/**
 * Results — the marks themselves, where Examinations (Phase 10) is the thing being marked.
 *
 * Two screens read from two differently-shaped endpoints, and the difference is the whole story
 * of this module:
 *
 *   - `GET /Results/grade-entry` is driven from the class roll, so it returns a row for every
 *     student **including the ones nobody has marked**. Those rows have nulls in them.
 *   - `GET /Results/student/{id}` is driven from the marks, so every row is a real mark. An
 *     examination the student was never marked for simply is not there.
 *
 * So `GradeEntryRow` is nullable where `StudentResultRow` is not, and code that handles one must
 * not be reused on the other without checking which.
 */

/**
 * One student on the roll for one examination, with whatever mark they already have.
 *
 * Every `current*` field is null for a student nobody has marked yet. This used to be impossible
 * to see: the procedure coalesced the mark to 0 and the grade and remarks to `''`, so an unmarked
 * student was indistinguishable from one who scored nothing. On an entry grid that is destructive
 * rather than merely confusing — see `hasResult`.
 */
export interface GradeEntryRow {
  /** `Students.Id`. The id both write endpoints take. */
  studentId: number
  /** The school's own admission number. Display only; never a key. */
  studentNumber: string
  /** Null until a roll number is assigned; the server sorts those students first. */
  rollNumber: string | null
  firstName: string
  lastName: string
  email: string

  className: string
  classGrade: string
  section: string

  subjectName: string
  subjectCode: string | null

  /**
   * The mark on record, or null if this student has not been marked.
   *
   * Never default this to 0 when rendering an input. A pre-filled 0 that the teacher does not
   * touch looks identical to a mark they intended, and submitting the grid would then record a
   * zero for every student they had not got to yet.
   */
  currentMarks: number | null
  /** Can be null even on a marked student — the server derives it and may return nothing. */
  currentGrade: string | null
  currentRemarks: string | null
  /** Whether a result row exists at all. The direct answer to "has this student been marked?". */
  hasResult: boolean

  maxMarks: number
  passingMarks: number
  examinationId: number
  examName: string
  examType: string
  /** `yyyy-MM-dd` from a SQL `DATE`. Parse with `parseApiDate`, never `new Date`. */
  examDate: string
}

/**
 * One mark on a student's report card.
 *
 * Nothing here is null for want of a result, so `isPass` is safe to read on its own — unlike
 * `MarkSheetRow.isPass` in Examinations, which is false for unmarked students because `NULL >= 40`
 * is unknown in SQL. This endpoint has no unmarked rows.
 */
export interface StudentResultRow {
  /** `Results.Id`. Not a key for any write: the upsert matches on (studentId, examinationId). */
  id: number
  obtainedMarks: number
  grade: string | null
  remarks: string | null
  createdAt: string
  /** Null if the mark has never been corrected. The only trace of a revision the API exposes. */
  updatedAt: string | null

  examinationId: number
  examName: string
  examType: string
  maxMarks: number
  passingMarks: number
  /** `yyyy-MM-dd`. */
  examDate: string

  /** Computed server-side so it cannot disagree with the mark sheet's rounding of the same mark. */
  percentage: number
  isPass: boolean

  subjectId: number
  subjectName: string
  subjectCode: string | null

  /** The class the *examination* was set for — for an older mark, not necessarily the student's. */
  classId: number
  className: string
  classGrade: string
  section: string
}

/** One row of a bulk submission. Omitting a student is the only way to leave them unmarked. */
export interface GradeEntryRecord {
  studentId: number
  obtainedMarks: number
  /**
   * Always omitted by this client. The server derives the letter from the school's own thresholds,
   * and sending one overrides that school's grading scale for this mark alone — which is how two
   * students on the same percentage end up with different grades on the same report card.
   */
  remarks?: string | null
}

export interface BulkGradeEntryPayload {
  examinationId: number
  gradeEntries: GradeEntryRecord[]
}

/**
 * What a bulk submission did. Carries no `result` string: the success-or-refusal is the HTTP
 * status, and these are the counts.
 *
 * `entriesSaved + entriesSkipped` equals what was sent. A 200 with a non-zero `entriesSkipped` is
 * a partial success and has to be reported as one.
 */
export interface BulkGradeEntryResult {
  entriesSaved: number
  entriesSkipped: number
}

/** A single mark, for correcting one student without resubmitting the class. */
export interface SingleResultPayload {
  studentId: number
  examinationId: number
  obtainedMarks: number
  remarks?: string | null
}
