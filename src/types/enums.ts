/**
 * Mirrors SchoolManagment.Models/Common/Constants.cs.
 *
 * This file is the single point of contact with those constants: if a module is
 * renamed server-side, updating MODULES here turns every stale usage into a compile
 * error instead of a silently denied permission.
 *
 * `as const` objects rather than TS `enum` -- tsconfig sets `erasableSyntaxOnly`,
 * which forbids enums, and const objects survive JSON round-trips better anyway.
 */

/* -------------------------------------------------------------------------- */
/* Roles                                                                       */
/* -------------------------------------------------------------------------- */

export const ROLES = {
  SuperAdmin: 'SuperAdmin',
  Admin: 'Admin',
  Teacher: 'Teacher',
  Student: 'Student',
  Parent: 'Parent',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

/**
 * Constants.RoleIds. These numbers are a database contract, not an implementation
 * detail -- Roles.Id is not an identity column and CK_Users_SchoolScope names
 * SuperAdmin as literal 1. Custom roles start at 100, so these never collide.
 */
export const ROLE_IDS = {
  SuperAdmin: 1,
  Admin: 2,
  Teacher: 3,
  Student: 4,
  Parent: 5,
} as const

export const FIRST_CUSTOM_ROLE_ID = 100

/* -------------------------------------------------------------------------- */
/* Permission grid                                                             */
/* -------------------------------------------------------------------------- */

/** Constants.Modules.All -- the permission grid's columns, in server order. */
export const MODULES = [
  'Schools',
  'Users',
  'Roles',
  'Students',
  'Teachers',
  'Parents',
  'Classes',
  'Subjects',
  'Attendance',
  'Examinations',
  'Results',
  'Fees',
  'Schedule',
  'Settings',
  'Reports',
] as const

export type ModuleName = (typeof MODULES)[number]

/** Constants.PermissionActions -- the four flags on a RolePermissions row. */
export const PERMISSION_ACTIONS = ['View', 'Create', 'Edit', 'Delete'] as const

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

/* -------------------------------------------------------------------------- */
/* Domain vocabularies                                                         */
/* -------------------------------------------------------------------------- */

/** CK_Addresses_AddressType allows exactly these. */
export const ADDRESS_TYPES = ['Permanent', 'Current', 'Correspondence'] as const
export type AddressType = (typeof ADDRESS_TYPES)[number]

export const GENDERS = ['Male', 'Female', 'Other'] as const
export type Gender = (typeof GENDERS)[number]

export const PAYMENT_METHODS = ['Cash', 'Card', 'UPI', 'BankTransfer', 'Cheque'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATUSES = ['Completed', 'Pending', 'Failed', 'Refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Note the inconsistent casing/hyphenation -- it is exactly what Constants.ExamType has. */
export const EXAM_TYPES = ['UnitTest', 'Mid-Term', 'Final', 'Pre-Board', 'Board'] as const
export type ExamType = (typeof EXAM_TYPES)[number]

/** Schedule uses 1=Monday .. 7=Sunday. */
export const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

/** Constants.Settings. The API clamps pageSize to MAX_PAGE_SIZE server-side. */
export const PAGE = {
  defaultSize: 20,
  maxSize: 100,
  sizeOptions: [10, 20, 50, 100],
} as const

/**
 * The password every teacher, student and parent is created with. Their first login
 * therefore always lands on the forced password-change screen.
 */
export const TEMP_PASSWORD = 'Temp@123'

/**
 * Mirrors the regex on ChangePasswordRequestDTO.NewPassword. Login accepts a 6-char
 * password, but a *change* demands 8+ with upper, lower, digit and one of @$!%*?&.
 */
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
