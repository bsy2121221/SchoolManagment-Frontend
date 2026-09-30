/**
 * Mirrors SchoolManagment.Models/DTOs/Attendance and the six procedures in
 * 09_Procs_Attendance.sql.
 *
 * The shape to understand before reading anything else in this module: attendance has
 * **three** states on screen and **two** in the database. `Attendance.IsPresent` is
 * `BIT NOT NULL`, so a stored row always says present or absent; "not marked" is the
 * absence of a row. `sp_GetClassAttendance` is the only endpoint that can express the
 * third state, and it does so by being driven from the class roll with a LEFT JOIN.
 *
 * The consequence runs through every screen here: a student can be marked, and a mark can
 * be corrected, but nothing can return a student to unmarked. There is no DELETE in the
 * module.
 *
 * Dates arrive as `DateTime` strings and are sent as `yyyy-MM-dd`. Both go through
 * `lib/dates.ts`, never through `toISOString()` -- the date is half of
 * `UQ_Attendance_Student_Date`, so a zone-shifted one writes the wrong row rather than
 * merely displaying oddly.
 */

/**
 * DTOs/Attendance/ClassAttendanceDTO.cs -- one row per student on a class roll for one
 * date. The register.
 *
 * `id`, `isPresent`, `remarks` and `markedAt` are null *together*: that is the LEFT JOIN
 * finding no attendance row, and it means nobody has decided about this student yet. In
 * particular `isPresent === null` is not "absent".
 */
export interface ClassAttendanceRow {
  /** The `Attendance` row id, or null when the student is unmarked. */
  id: number | null
  /** `Students.Id`, which is what both write endpoints take. */
  studentId: number
  /** Present, absent, or undecided. See the note above. */
  isPresent: boolean | null
  remarks: string | null
  markedAt: string | null
  /** The printed admission number (`STU2026001`), not an id. */
  studentNumber: string
  /** Null for a student admitted but not yet given one. */
  rollNumber: string | null
  firstName: string
  lastName: string
  email: string
}

/**
 * DTOs/Attendance/StudentAttendanceDTO.cs -- one student's history over a window.
 *
 * Only marked days appear, so this list is shorter than the number of school days and the
 * gaps are registers nobody opened.
 *
 * Note what is **missing**: there is no `classId`. `sp_GetStudentAttendance` joins Classes
 * for the name but does not return the id, so a correction cannot be driven from this
 * view -- `POST /api/Attendance` needs the class. That is why the single-mark dialog is
 * opened from the summary, which does carry `classId`.
 */
export interface StudentAttendanceRow {
  id: number
  attendanceDate: string
  isPresent: boolean
  remarks: string | null
  markedAt: string | null
  /** From an INNER JOIN on a NOT NULL `Attendance.ClassId`, so never null here. */
  className: string
  grade: string
  section: string
}

/**
 * DTOs/Attendance/AttendanceSummaryDTO.cs -- per-student percentages over a window.
 *
 * Driven from `Students`, so every active student appears whether or not they have been
 * marked. Two nullables carry real meaning:
 *
 *  - `attendancePercentage` null means nothing was recorded in the window. It is not 0%,
 *    which means recorded absent every time.
 *  - `classId` null means the student is not placed in a class. They cannot be marked at
 *    all until they are, because attendance is filed against a class.
 */
export interface AttendanceSummaryRow {
  /** `Students.Id`. */
  studentId: number
  studentNumber: string
  rollNumber: string | null
  firstName: string
  lastName: string
  classId: number | null
  className: string | null
  grade: string | null
  section: string | null
  presentDays: number
  absentDays: number
  /** Days with a record either way -- the denominator, not the days the school was open. */
  totalDays: number
  attendancePercentage: number | null
}

/**
 * DTOs/Attendance/DailyAttendanceReportDTO.cs -- one row per date.
 *
 * Driven from `Attendance` rather than from a calendar, so a date on which nobody was
 * marked is **absent from the list** rather than present with zeroes. Gaps are unopened
 * registers, and the screen has to say so -- an empty row and a missing row would
 * otherwise look like the same thing.
 */
export interface DailyAttendanceRow {
  attendanceDate: string
  presentCount: number
  absentCount: number
  totalMarked: number
  attendancePercentage: number | null
}

/** Body of `POST /api/Attendance` -- one student, one date. An upsert. */
export interface AttendanceMarkPayload {
  studentId: number
  classId: number
  /** `yyyy-MM-dd`, from `toApiDate`. */
  attendanceDate: string
  isPresent: boolean
  /** Null rather than `''` for "nothing to say", so the column stays NULL. Max 255. */
  remarks: string | null
}

/**
 * One student inside a bulk submission.
 *
 * `studentId` must be unique across the list: `sp_MarkAttendanceBulk` reads the JSON into
 * a table variable declaring `StudentId INT PRIMARY KEY`, so a duplicate does not
 * overwrite or get ignored -- it throws, and the whole register fails. Building the list
 * from a map keyed on student id is what keeps that impossible.
 */
export interface AttendanceRecord {
  studentId: number
  isPresent: boolean
  remarks: string | null
}

/** Body of `POST /api/Attendance/bulk`. The server requires at least one record. */
export interface AttendanceBulkMarkPayload {
  classId: number
  attendanceDate: string
  records: AttendanceRecord[]
}

/**
 * DTOs/Attendance/AttendanceBulkMarkResponseDTO.cs.
 *
 * Worth reading rather than discarding. The bulk endpoint skips records for students who
 * are not actively enrolled in the class and counts them, rather than refusing the
 * submission -- so a 200 can mean "saved less than you asked". A non-zero
 * `recordsSkipped` says the roll on screen is stale, which the user has to be told
 * because their next assumption is that the register is complete.
 */
export interface AttendanceBulkMarkResult {
  /** Rows the MERGE touched, inserted plus updated. */
  recordsMarked: number
  /** Records dropped because the student is not enrolled in that class. */
  recordsSkipped: number
}
