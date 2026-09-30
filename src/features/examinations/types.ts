/**
 * Mirrors SchoolManagment.Models/DTOs/Examinations and the four procedures behind them.
 *
 * As everywhere else, the school is absent from these shapes: `SchoolId` comes from the
 * token. `ExaminationDTO` does carry a `schoolId`, so it is typed here, but nothing reads it.
 *
 * The one fact to hold on to before reading further: **an examination is scoped to a class
 * and a subject, both required.** There is no school-wide exam and no all-subjects exam in
 * this schema. "Term 1" across six subjects in four classes is twenty-four rows sharing a
 * name, and the screens are built around that being normal rather than a mistake.
 */

/** DTOs/Examinations/ExaminationDTO.cs */
export interface ExaminationRow {
  id: number
  examName: string
  /** Free text, 50 characters. "Mid Term" is what the seed uses; nothing constrains it. */
  examType: string
  /** ISO date-time, but the column is DATE — read it with `parseApiDate`, not `new Date`. */
  examDate: string
  maxMarks: number
  passingMarks: number
  /** Minutes. Genuinely optional. */
  duration: number | null
  classId: number
  subjectId: number
  subjectName: string
  /** Nullable because `Subjects.SubjectCode` is; every write path now requires one. */
  subjectCode: string | null
  className: string
  /** The **class's** grade ("10"), not a letter grade. NOT NULL server-side. */
  grade: string
  section: string
  schoolId: number
  /** Active students in the exam's class — the denominator for marking progress. */
  studentCount: number
  /**
   * Active results recorded against this exam.
   *
   * Also the count of marks that a delete destroys: `sp_DeleteExamination` deactivates the
   * results in the same transaction. It can exceed `studentCount` when a marked student has
   * since moved class, so anything computing a percentage has to clamp.
   */
  resultsEntered: number
}

/**
 * `POST /api/Examinations` — ExaminationCreateDTO.
 *
 * One body for both create and update, because the endpoint is an upsert. What it matches
 * on is the part worth knowing: **(examName, examType, classId, subjectId)**, never the id,
 * which the procedure does not take.
 *
 * So those four fields are not editable. Posting an existing exam under a new name does not
 * rename it — it creates a second exam and leaves the first standing, with its marks. Only
 * `examDate`, `maxMarks`, `passingMarks` and `duration` are ever written to an existing row.
 * `ExaminationFormDialog` locks the four in edit mode for that reason.
 */
export interface ExaminationPayload {
  examName: string
  examType: string
  classId: number
  subjectId: number
  /** `yyyy-MM-dd`. Sent through `toApiDate`, so the day is the local day. */
  examDate: string
  maxMarks: number
  passingMarks: number
  duration: number | null
}

/** What the upsert answers with. The status code says which branch ran; this does not. */
export interface ExaminationSaveResult {
  examinationId: number
}

/**
 * DTOs/Examinations/ExaminationResultsDTO.cs — one row of the mark sheet.
 *
 * `sp_GetExaminationResults` is driven from `Students` with a LEFT JOIN to `Results`, so
 * this is the **whole class**, not the students who have marks. An unmarked student arrives
 * with `obtainedMarks`, `percentage`, `grade` and `remarks` all null, which is what makes
 * the sheet double as the list of who is still outstanding.
 */
export interface MarkSheetRow {
  /** `Students.Id`. */
  studentId: number
  /** The admission number, `Students.StudentId`. */
  studentNumber: string
  /** Nullable: a student can be enrolled before a roll number is assigned. */
  rollNumber: string | null
  firstName: string
  lastName: string
  /** Null when this student has no active result for the exam. */
  obtainedMarks: number | null
  /** From the examination, so identical on every row of one sheet. */
  maxMarks: number
  passingMarks: number
  /** Null exactly when `obtainedMarks` is. */
  percentage: number | null
  /** The letter grade as entered — optional even on a marked result. */
  grade: string | null
  /**
   * **Never read this without checking `obtainedMarks` first.**
   *
   * The procedure computes `ObtainedMarks >= @PassingMarks`, and in SQL `NULL >= 40` is
   * unknown, so it falls to the ELSE and an unmarked student arrives as `false`. Trusting
   * this field alone renders "Fail" against every student nobody has marked yet.
   * `markStatus()` in `examinationRules.ts` is the only thing that should read it.
   */
  isPass: boolean
  remarks: string | null
  /**
   * `RANK()`, so ties share a position and the next one skips — two firsts are followed by
   * third. Unmarked students are sorted to the end and all tie on that last rank, so for
   * them the number is an artefact rather than a standing.
   */
  classRank: number
}
