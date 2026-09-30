/**
 * Mirrors SchoolManagment.Models/DTOs/Classes and the procedures behind them.
 *
 * The school is never part of these shapes: `SchoolId` comes from the token, and the
 * API takes it from there. Sending one would be ignored at best.
 */

/** DTOs/Classes/ClassDTO.cs */
export interface ClassRow {
  id: number
  className: string
  grade: string
  section: string
  /** A **Teachers.Id**, not a UserId. */
  classTeacherId: number | null
  classTeacherName: string | null
  /** Active students on the roll, from the procedure -- not `students.length`. */
  totalStudents: number
  maxStudents: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * DTOs/Classes/ClassDetailsDTO.cs -> ClassStatsDTO, as `sp_GetClassStats` returns it.
 *
 * `averageAttendance` is `null` when the register has not been opened in the last 30
 * days at all. That is not 0 -- 0% means marks were taken and nobody was present --
 * so it is rendered as "no marks yet", never as a zero.
 */
export interface ClassStats {
  totalStudents: number
  maxStudents: number
  maleStudents: number
  femaleStudents: number
  averageAttendance: number | null
  /** Individual present/absent marks in the window, not student-days. */
  presentLast30Days: number
  absentLast30Days: number
  totalExaminations: number
  totalFees: number
  overdueFees: number
}

/**
 * A row from `GET /api/Classes/{id}/students`.
 *
 * Deliberately narrower than the server's `StudentDTO`. `sp_GetClassStudents` selects
 * eleven columns of it, so the rest arrive as C# defaults -- `username: ""`,
 * `isActive: false`, `admissionDate` present but `gender` absent. Typing only what the
 * procedure actually sends keeps a screen from rendering `isActive: false` for a
 * student the procedure only returned *because* they are active.
 */
export interface ClassStudentRow {
  id: number
  userId: number
  studentId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string | null
  rollNumber: string | null
  dateOfBirth: string | null
  admissionDate: string
  fatherName: string | null
  motherName: string | null
  bloodGroup: string | null
}

export interface ClassDetails {
  classInfo: ClassRow | null
  students: ClassStudentRow[] | null
  stats: ClassStats | null
}

/** DTOs/Classes/ClassTimetableDTO.cs */
export interface TimetablePeriod {
  /** A `TimeSpan` serialised by `.ToString()`, e.g. "09:00:00". */
  startTime: string
  endTime: string
  subjectName: string
  teacherName: string
  room: string | null
}

export interface TimetableDay {
  /** 1 = Monday .. 7 = Sunday. */
  dayOfWeek: number
  dayName: string
  periods: TimetablePeriod[]
}

export interface ClassTimetable {
  className: string
  timetable: TimetableDay[]
}

/** Query string for `GET /api/Classes`. */
export interface ClassListQuery {
  grade?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

/**
 * DTOs/Classes/ClassCreateDTO.cs and ClassUpdateDTO.cs -- identical shapes, which is
 * why one dialog serves both.
 */
export interface ClassPayload {
  className: string
  grade: string
  section: string
  classTeacherId: number | null
  maxStudents: number
}
