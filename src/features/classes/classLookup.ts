import type { SelectOption } from '@/components/form/RHFSelect'
import { PAGE } from '@/types/enums'
import { useGetClassesQuery } from './classesApi'
import type { ClassRow } from './types'

/**
 * Active classes for a picker, one page of up to `PAGE.maxSize`.
 *
 * `GET /api/Classes` is the only way to list classes and it is paginated, so a dropdown
 * has to ask for a page. 100 is the server's clamp and comfortably more classes than a
 * school has; `hasMore` says whether that assumption broke, so a caller can tell the user
 * instead of silently offering a truncated list.
 *
 * Lives here rather than in `features/students` because Students, Attendance, Examinations
 * and Fees all need the same list.
 */
export interface ClassLookup {
  classes: ClassRow[]
  options: SelectOption[]
  isLoading: boolean
  /** True when the school has more active classes than one page holds. */
  hasMore: boolean
}

/** "10-A (grade 10)" -- the grade matters here, since promotion is chosen by it. */
export function classLabel(row: ClassRow): string {
  return `${row.className} (grade ${row.grade})`
}

/**
 * `skip` mirrors RTK Query's own option: pickers inside a dialog should not fetch until
 * the dialog is open, and callers without `Classes:View` should not fetch at all -- the
 * endpoint is Admin/Teacher-only and would 403.
 */
export function useClassLookup(options?: { skip?: boolean }): ClassLookup {
  const { data, isLoading } = useGetClassesQuery(
    { isActive: true, page: 1, pageSize: PAGE.maxSize },
    { skip: options?.skip ?? false },
  )

  const classes = data?.items ?? []

  return {
    classes,
    options: classes.map((row) => ({ value: row.id, label: classLabel(row) })),
    isLoading,
    hasMore: (data?.totalCount ?? 0) > classes.length,
  }
}

/**
 * Capacity check for the pickers: a full class is shown but not selectable, because
 * `sp_RegisterStudent` and `sp_PromoteStudent` both refuse it. Offering it and letting the
 * server say no is a worse way to learn that 10-A has 50 of 50.
 */
export function isClassFull(row: ClassRow): boolean {
  return row.totalStudents >= row.maxStudents
}
