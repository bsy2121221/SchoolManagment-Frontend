import type { PageQuery } from '@/types/api'

/**
 * Mirrors SchoolManagment.Models/DTOs/Schools.
 *
 * This is the platform module: the only one whose endpoints address a school by id
 * instead of reading it from the caller's token. Everything else in the app is
 * implicitly scoped to one tenant.
 */

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/** SchoolDTO.cs -- one tenant, with contact details. Never served anonymously. */
export interface School {
  id: number
  schoolCode: string
  schoolName: string
  subdomain: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  contactEmail: string | null
  contactPhone: string | null
  principalName: string | null
  logoUrl: string | null
  themeColor: string
  /** 1-12. Decides which calendar months belong to a session. */
  academicYearStartMonth: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * SchoolListItemDTO.cs -- extends SchoolDTO with headline counts, so the tenant
 * list needs no follow-up call per row.
 */
export interface SchoolRow extends School {
  totalStudents: number
  totalTeachers: number
  totalClasses: number
  totalUsers: number
}

/** Query for GET /api/Schools. `searchTerm` matches name, code or city. */
export interface SchoolListQuery extends PageQuery {
  searchTerm?: string
  isActive?: boolean
}

/**
 * PlatformStatsDTO.cs -- totals across every tenant.
 *
 * The user counts are by role, so a member of a custom role is in none of them;
 * `totalAdmins + totalTeachers + totalStudents + totalParents` can therefore be
 * less than the real head count.
 */
export interface PlatformStats {
  totalSchools: number
  activeSchools: number
  inactiveSchools: number
  totalStudents: number
  totalTeachers: number
  totalParents: number
  totalAdmins: number
  totalClasses: number
  schoolsAddedLast30Days: number
}

/**
 * SchoolUsageReportDTO.cs -- per-tenant activity over a window.
 *
 * The activity counts are window-bound; the head counts are current. `feesCollected`
 * is a `decimal` server-side and arrives as a JSON number.
 */
export interface SchoolUsageRow {
  schoolId: number
  schoolCode: string
  schoolName: string
  isActive: boolean
  activeStudents: number
  activeTeachers: number
  attendanceRecords: number
  resultsEntered: number
  feesCollected: number
  /** Null for a school nobody has ever signed in to. */
  lastLoginAt: string | null
}

/**
 * SchoolBrandingDTO.cs -- the public subset, from the two anonymous endpoints.
 * Deliberately carries no contact details or counts.
 */
export interface SchoolBranding {
  schoolId: number
  schoolCode: string
  schoolName: string
  /** Set by the by-subdomain lookup only; the branding lookup does not select it. */
  subdomain: string | null
  logoUrl: string | null
  themeColor: string
  isActive: boolean
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * SchoolCreateDTO.cs -- onboarding. One transaction creates the school, its first
 * admin, the number sequences, the default fee types, the default settings and
 * (unless `seedSubjects` is off) a starter subject list for grades 1-12.
 */
export interface SchoolCreatePayload {
  schoolCode: string
  schoolName: string
  subdomain: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  contactEmail: string | null
  contactPhone: string | null
  principalName: string | null
  logoUrl: string | null
  themeColor: string
  academicYearStartMonth: number
  adminEmail: string
  adminFirstName: string
  adminLastName: string
  adminPhoneNumber: string | null
  /** Omit (null) to give the admin the shared temporary password. */
  adminPassword: string | null
  seedSubjects: boolean
}

/**
 * SchoolCreateResultDTO.cs.
 *
 * `adminUsername` is generated as `CODE_ADMIN` by sp_CreateSchool, and `schoolCode`
 * is the *sanitised* code actually stored -- both are things the caller cannot know
 * without being told, which is why the onboarding flow has to show them.
 */
export interface SchoolCreateResult {
  schoolId: number
  schoolCode: string
  adminUserId: number
  adminUsername: string
  /** True when no password was supplied, so the account holds TEMP_PASSWORD. */
  requiresPasswordChange: boolean
}

/**
 * SchoolUpdateDTO.cs -- a partial update: every field left null keeps its stored
 * value. `schoolCode` is absent by design, because it is embedded verbatim in every
 * username and admission number already issued.
 */
export interface SchoolUpdatePayload {
  schoolName?: string | null
  subdomain?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  principalName?: string | null
  logoUrl?: string | null
  themeColor?: string | null
  academicYearStartMonth?: number | null
  /**
   * Clearing a subdomain needs its own flag: a null `subdomain` means "leave it
   * alone", so there is otherwise no way to express "remove it".
   */
  clearSubdomain?: boolean
}

/** SchoolAdminCreateDTO.cs -- a second, third, ... admin for an existing school. */
export interface SchoolAdminPayload {
  email: string
  firstName: string
  lastName: string
  phoneNumber: string | null
  /** Optional; generated as CODE_ADMIN2, CODE_ADMIN3, ... when omitted. */
  username: string | null
  /** Optional; omit for the shared temporary password with a forced change. */
  password: string | null
}

/** SchoolAdminCreateResultDTO.cs. The password itself is never returned. */
export interface SchoolAdminResult {
  userId: number
  username: string
  requiresPasswordChange: boolean
}

/**
 * SchoolSessionDTO.cs -- the result of a SuperAdmin entering or leaving a school.
 *
 * Only the access token is reissued; the refresh token knows nothing of the switch,
 * so the scope lasts until the access token expires and then drops back to platform
 * scope. The Settings screen is the one place that offers it; see schoolsApi.ts.
 */
export interface SchoolSession {
  schoolId: number | null
  schoolCode: string | null
  schoolName: string | null
  accessToken: string
  expiresIn: number
  isActingAsSchool: boolean
}

/* -------------------------------------------------------------------------- */
/* Shared rules                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The C#/T-SQL `fn_SanitizeCode`, reproduced: upper-case, then strip everything
 * outside A-Z0-9.
 *
 * Worth having client-side because the stored code is what every username and
 * admission number in the school is built from, and it is *not* what the user typed:
 * "dps-noida" is stored as DPSNOIDA. Showing the result before submitting is the
 * difference between choosing a code and discovering one.
 */
export function sanitiseSchoolCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** SchoolService checks the sanitised length, not the typed one: 3-12 characters. */
export const SCHOOL_CODE_SANITISED = { min: 3, max: 12 } as const

/**
 * The raw input cap, which looks stricter than the sanitised one but is not the same
 * rule: `sp_CreateSchool` declares `@SchoolCode NVARCHAR(12)`, so SQL Server
 * truncates longer input *before* sanitising it. "zz-test-school" would arrive as
 * "zz-test-scho" and be stored as ZZTESTSCHO -- a code nobody asked for.
 */
export const SCHOOL_CODE_RAW_MAX = 12

/** The username sp_CreateSchool derives for the first admin. Cannot be chosen. */
export function firstAdminUsername(sanitisedCode: string): string {
  return `${sanitisedCode}_ADMIN`
}

/** Month numbers for the academic-year-start picker; the API takes 1-12. */
export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const

export function monthName(month: number): string {
  return MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)
}
