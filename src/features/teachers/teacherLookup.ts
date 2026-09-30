import type { SelectOption } from '@/components/form/RHFSelect'
import { useGetTeachersQuery } from './teachersApi'
import type { TeacherRow } from './types'

/**
 * Active teachers for a picker -- the "class teacher" dropdown, and anything later that
 * has to name one.
 *
 * Replaces the Phase 2 `teacherLookupApi.ts`, which declared its own `GET /teachers`
 * endpoint because Teachers did not exist yet. Two endpoint definitions for one URL meant
 * two cache entries and two fetches; this reads the one in `teachersApi` instead.
 *
 * No `hasMore` here, unlike `useClassLookup`: this endpoint is not paginated, so the
 * answer is always the whole set.
 */
export interface TeacherLookup {
  teachers: TeacherRow[]
  options: SelectOption[]
  isLoading: boolean
}

/** "Anita Rao (EMP2026004)" -- the employee id disambiguates two teachers of one name. */
export function teacherLabel(
  teacher: Pick<TeacherRow, 'firstName' | 'lastName' | 'employeeId'>,
): string {
  const name = `${teacher.firstName} ${teacher.lastName}`.trim()
  return name ? `${name} (${teacher.employeeId})` : teacher.employeeId
}

/**
 * `skip` mirrors RTK Query's own option: pickers inside a dialog should not fetch until
 * the dialog is open, and a caller without `Teachers:View` should not fetch at all -- the
 * endpoint is Admin/Teacher-only and would 403 for a student or parent.
 */
export function useTeacherLookup(options?: { skip?: boolean }): TeacherLookup {
  const { data, isLoading } = useGetTeachersQuery(undefined, { skip: options?.skip ?? false })

  const teachers = data ?? []

  return {
    teachers,
    options: teachers.map((row) => ({ value: row.id, label: teacherLabel(row) })),
    isLoading,
  }
}
