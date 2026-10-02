import type { StudentResultRow } from '@/features/results/types'
import type {
  ClassScheduleEntry,
  CurrentNextLesson,
  TeacherScheduleEntry,
  TeacherScheduleStats,
} from '@/features/schedule/types'
import type { PlatformStats, SchoolRow } from '@/features/schools/types'
import type { TeacherClass } from '@/features/teachers/types'

/**
 * Mirrors SchoolManagment.Models/DTOs/Dashboard.
 *
 * One response for every role. The sections that do not apply to the caller are absent
 * (null); a section that is present but holds null figures was trimmed by the permission
 * grid, and `omitted` names what was dropped. **A null figure is "withheld", never zero**,
 * and every screen reading these types has to keep the two apart.
 */

/** DTOs/Dashboard/SchoolStatsDTO.cs: sp_GetDashboardStats, every figure nullable. */
export interface SchoolStats {
  totalStudents: number | null
  totalTeachers: number | null
  totalParents: number | null
  totalClasses: number | null
  totalSubjects: number | null
  todayPresent: number | null
  todayAbsent: number | null
  /** Of the marks taken today, not of the roll. Null when nobody has been marked today. */
  todayAttendancePercentage: number | null
  /** Fees past due and not covered by completed payments. */
  overdueFees: number | null
  /** Owed across all active fees, due yet or not. */
  feesOutstandingAmount: number | null
  feesCollectedThisMonth: number | null
}

/** DTOs/Dashboard/PlatformSectionDTO.cs: a SuperAdmin with no school in scope. */
export interface PlatformSection {
  stats: PlatformStats | null
  /** First page of schools, newest first. `totalSchools` says whether there are more. */
  recentSchools: SchoolRow[]
  totalSchools: number
}

/** DTOs/Dashboard/TeacherSectionDTO.cs */
export interface TeacherSection {
  teacherId: number
  currentClass: CurrentNextLesson | null
  nextClass: CurrentNextLesson | null
  todaySchedule: TeacherScheduleEntry[]
  scheduleStats: TeacherScheduleStats | null
  /** The classes this teacher is class teacher of. */
  classes: TeacherClass[]
}

/** DTOs/Dashboard/StudentSectionDTO.cs. The counts are since admission, not this term. */
export interface StudentSection {
  studentId: number
  studentNumber: string | null
  rollNumber: string | null
  /** Null for a student admitted but not yet placed in a class. */
  classId: number | null
  className: string | null
  presentDays: number | null
  absentDays: number | null
  totalDays: number | null
  /** Null when attendance has never been taken, as well as when it is withheld. */
  attendancePercentage: number | null
  totalResults: number | null
  averageMarks: number | null
  highestMarks: number | null
  totalFees: number | null
  paidAmount: number | null
  pendingAmount: number | null
  subjectCount: number
  recentResults: StudentResultRow[]
  todaySchedule: ClassScheduleEntry[]
}

/** DTOs/Dashboard/ParentSectionDTO.cs -> ParentChildSummaryDTO. Attendance is the last month. */
export interface ParentChildSummary {
  studentId: number
  studentNumber: string
  firstName: string
  lastName: string
  relationship: string
  className: string
  grade: string
  section: string
  presentDays: number | null
  absentDays: number | null
  totalDays: number | null
  attendancePercentage: number | null
  outstandingAmount: number | null
  overdueFeeCount: number | null
}

export interface ParentSection {
  parentId: number
  children: ParentChildSummary[]
}

/** DTOs/Dashboard/ActivityDTO.cs: one of the caller's own audit rows. */
export interface Activity {
  activityType: string
  activityDate: string
  /** Assembled by the procedure; shown as-is. */
  activityDescription: string
  entityType: string | null
  entityId: number | null
  ipAddress: string | null
}

/** DTOs/Dashboard/DashboardDTO.cs -> OmittedSectionDTO, e.g. `school.feesOutstandingAmount`. */
export interface OmittedSection {
  field: string
  reason: string
}

/** DTOs/Dashboard/DashboardDTO.cs */
export interface Dashboard {
  role: string
  schoolId: number | null
  schoolCode: string | null
  /** Server time of the read. Several figures are "today" counts, so it is shown. */
  generatedAt: string
  school: SchoolStats | null
  platform: PlatformSection | null
  teacher: TeacherSection | null
  student: StudentSection | null
  parent: ParentSection | null
  recentActivity: Activity[]
  omitted: OmittedSection[]
}
