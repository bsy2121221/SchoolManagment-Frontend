/**
 * Cache tags for the one shared baseApi.
 *
 * They live in a single list because features must be able to invalidate each
 * other: recording a fee payment has to refresh the student's outstanding-fee list,
 * and marking attendance has to refresh that student's summary.
 */
export const TAG_TYPES = [
  'Auth',
  'Permission',
  'Role',
  'School',
  /**
   * Platform-wide aggregates (`/schools/platform-stats`, `/schools/usage-report`).
   * Separate from `School` because onboarding a tenant changes the totals, while
   * editing one school's address does not -- and the stats are the SuperAdmin's
   * landing page, so refetching them on every edit would be noise.
   */
  'Platform',
  'User',
  'Student',
  'Teacher',
  'Parent',
  'Class',
  'Subject',
  'Attendance',
  'Examination',
  'Result',
  'Fee',
  'Schedule',
  /** One school's Settings rows, and the grading scale assembled from them. */
  'Setting',
  /**
   * `GET /api/Dashboard`. Counts from every module, so no single write is worth
   * invalidating it; it is dropped on a change of school scope and otherwise left to
   * `refetchOnMountOrArgChange`.
   */
  'Dashboard',
] as const

export type TagType = (typeof TAG_TYPES)[number]

/** Sentinel id for "the whole collection", used by list endpoints. */
export const LIST_ID = 'LIST' as const
