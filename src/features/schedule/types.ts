/**
 * ScheduleController DTOs, as they arrive after the ApiResponse envelope is stripped.
 *
 * **Times.** `StartTime` / `EndTime` are C# `TimeSpan`s over SQL `TIME(0)`, and
 * System.Text.Json writes a TimeSpan as `"HH:mm:ss"` — a time of day with no date and no
 * zone, so it never passes through a JavaScript `Date` on the way in. See `scheduleRules.ts`.
 *
 * The `*Formatted` strings are SQL `FORMAT(..., 'hh:mm tt')` and follow the database server's
 * culture, so nothing here displays them.
 *
 * `teacherId` is always `Teachers.Id`, not the teacher's user id.
 */

/** A time of day as the API sends and takes it: `"09:00:00"`. */
export type TimeOfDay = string

/** DTOs/Schedule/ScheduleEntryDTO.cs — a row of a teacher's timetable. */
export interface TeacherScheduleEntry {
  id: number
  teacherId: number
  /** 1 = Monday .. 7 = Sunday, independent of the server's DATEFIRST. */
  dayOfWeek: number
  startTime: TimeOfDay
  endTime: TimeOfDay
  room: string | null
  isActive: boolean
  subjectId: number
  subjectName: string
  subjectCode: string | null
  classId: number
  className: string
  grade: string
  section: string
  dayName: string
  startTimeFormatted: string
  endTimeFormatted: string
}

/** DTOs/Schedule/ClassScheduleDTO.cs — a row of a class's timetable. */
export interface ClassScheduleEntry {
  id: number
  dayOfWeek: number
  dayName: string
  startTime: TimeOfDay
  endTime: TimeOfDay
  startTimeFormatted: string
  endTimeFormatted: string
  room: string | null
  subjectId: number
  subjectName: string
  subjectCode: string | null
  teacherId: number
  employeeId: string
  teacherName: string
  classId: number
  className: string
  grade: string
  section: string
}

/** DTOs/Schedule/CurrentNextClassDTO.cs */
export interface CurrentNextLesson {
  classType: 'Current' | 'Next'
  id: number
  teacherId: number
  dayOfWeek: number
  startTime: TimeOfDay
  endTime: TimeOfDay
  room: string | null
  subjectId: number
  subjectName: string
  subjectCode: string | null
  classId: number
  className: string
  grade: string
  section: string
  dayName: string
}

export interface CurrentNextLessons {
  currentClass: CurrentNextLesson | null
  nextClass: CurrentNextLesson | null
}

/** DTOs/Schedule/TeacherScheduleStatsDTO.cs — every field zero/null for an empty week. */
export interface TeacherScheduleStats {
  totalClasses: number
  totalSubjects: number
  totalClassesAssigned: number
  daysInWeek: number
  earliestClass: TimeOfDay | null
  latestClass: TimeOfDay | null
  totalMinutesPerWeek: number
}

/** DTOs/Schedule/ScheduleEntryCreateDTO.cs — the body of both POST and PUT /{id}. */
export interface ScheduleEntryPayload {
  teacherId: number
  subjectId: number
  classId: number
  dayOfWeek: number
  startTime: TimeOfDay
  endTime: TimeOfDay
  room: string | null
}

/** DTOs/Schedule/ScheduleOperationResponseDTO.cs */
export interface ScheduleOperationResult {
  result: 'Success' | 'Conflict' | 'Error'
  message: string
  id: number | null
  /** Set on a 409: the entry already in the slot. */
  conflictWith: number | null
}

/**
 * The fields the edit dialog needs, which both row shapes carry. Lets either timetable
 * (by teacher or by class) open the same dialog on one of its rows.
 */
export interface EditableEntry {
  id: number
  teacherId: number
  subjectId: number
  classId: number
  dayOfWeek: number
  startTime: TimeOfDay
  endTime: TimeOfDay
  room: string | null
  subjectName: string
  className: string
}
