import type { ModuleName } from '@/types/enums'

/**
 * How far the server honours each module's row of the grid.
 *
 *  - `grid` -- every endpoint is `[RequiresPermission]` and nothing more, so the four flags
 *    are the whole rule.
 *  - `partial` -- the flags are checked, but a role policy is checked as well, so some grants
 *    open nothing for some roles.
 *  - `role` -- the controller has no `[RequiresPermission]` at all. The flags still decide what
 *    the app *shows* (menus and buttons read the grid), but the API ignores them.
 *
 * Read from the controllers' attributes in Phase 14; FRONTEND_PLAN.md §7.60 has the audit.
 * A custom role holds no role name the policies know, so for it `partial` and `role` mean the
 * grant opens nothing on the server.
 */
export type Enforcement = 'grid' | 'partial' | 'role'

export interface ModuleNote {
  label: string
  enforcement: Enforcement
  /** What the grid does not decide. Absent for `grid`. */
  note?: string
}

export const MODULE_NOTES: Record<ModuleName, ModuleNote> = {
  Schools: {
    label: 'Schools',
    enforcement: 'partial',
    note: 'Listing, creating and suspending schools, and switching into one, are SuperAdmin-only whatever the grid says. View and Edit reach the caller’s own school.',
  },
  Users: { label: 'Users', enforcement: 'grid' },
  Roles: {
    label: 'Roles & permissions',
    enforcement: 'partial',
    note: 'View opens the role list (the Users screen’s role picker needs it). Every change to a role is SuperAdmin-only.',
  },
  Students: {
    label: 'Students',
    enforcement: 'role',
    note: 'The API ignores this row: student records are Admin-only to change and Admin or Teacher to read.',
  },
  Teachers: {
    label: 'Teachers',
    enforcement: 'role',
    note: 'The API ignores this row: teacher records are Admin-only to change and Admin or Teacher to read.',
  },
  Parents: {
    label: 'Parents',
    enforcement: 'role',
    note: 'The API ignores this row: parent records are Admin-only to change, Admin or Teacher to read, and a parent’s own page is Parent-only.',
  },
  Classes: {
    label: 'Classes',
    enforcement: 'role',
    note: 'The API ignores this row: classes are Admin-only to change and Admin or Teacher to read.',
  },
  Subjects: {
    label: 'Subjects',
    enforcement: 'role',
    note: 'The API ignores this row: subjects are Admin-only to change and Admin or Teacher to read.',
  },
  Attendance: {
    label: 'Attendance',
    enforcement: 'partial',
    note: 'Every endpoint also requires Admin or Teacher, so granting it to Students, Parents or a custom role opens nothing.',
  },
  Examinations: {
    label: 'Examinations',
    enforcement: 'partial',
    note: 'Every endpoint also requires Admin or Teacher; deleting an examination requires Admin.',
  },
  Results: {
    label: 'Results',
    enforcement: 'partial',
    note: 'Entering and reading results also requires Admin or Teacher.',
  },
  Fees: {
    label: 'Fees',
    enforcement: 'partial',
    note: 'Only reading fee types follows the grid for every school user. Everything else — billing, payments, refunds, the ledger — also requires Admin.',
  },
  Schedule: {
    label: 'Timetable',
    enforcement: 'partial',
    note: 'Reading also requires Admin or Teacher; adding, moving and removing lessons requires Admin.',
  },
  Settings: { label: 'Settings', enforcement: 'grid' },
  Reports: {
    label: 'Reports',
    enforcement: 'partial',
    note: 'Gates the school statistics. Each user’s own activity feed needs no permission.',
  },
}
