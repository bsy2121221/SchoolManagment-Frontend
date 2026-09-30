import { format, isValid, parseISO, startOfDay } from 'date-fns'

/**
 * Dates on the wire, in the school's own calendar.
 *
 * Every date the API takes or returns for a `DATE` column is a calendar date with no zone
 * attached: `Attendance.AttendanceDate` is part of a unique key, an examination has a date
 * rather than an instant, and a fee is due on a day. So the only correct conversion is the
 * one that preserves the digits the user chose in the picker.
 *
 * `toISOString().slice(0, 10)` -- the obvious one-liner, and what `PlatformUsageTable` used
 * before this module existed -- does not do that. It converts to UTC first, so local
 * midnight anywhere east of UTC becomes the previous day: a teacher in IST (+05:30)
 * choosing 26 September sends `2026-09-25`. For a usage window that is an off-by-one in a
 * report. For attendance it files the register against the wrong day, and because the date
 * is half the unique key, the next day's register then looks unopened while yesterday's
 * quietly gets overwritten.
 *
 * Hence one helper, used everywhere, that formats from the local fields.
 */
const API_DATE_FORMAT = 'yyyy-MM-dd'

/**
 * A `Date` as `yyyy-MM-dd` in the local calendar, or undefined when there is nothing to
 * send.
 *
 * Undefined rather than `''` for the empty case: RTK Query drops undefined params, while
 * an empty string is sent and fails model binding. `null` and an invalid Date -- which is
 * what a half-typed picker value is -- are both treated as absent, so a query is never
 * built out of `NaN`.
 */
export function toApiDate(date: Date | null | undefined): string | undefined {
  if (!date || !isValid(date)) return undefined
  return format(date, API_DATE_FORMAT)
}

/**
 * Parse a date the API sent.
 *
 * `System.Text.Json` writes a `DateTime` as `2026-09-26T00:00:00` -- no offset -- and
 * `parseISO` reads that as local midnight, which is right. The bare-date form
 * `2026-09-26` is the trap: the ECMAScript spec says a date-only string is UTC, so
 * `new Date('2026-09-26')` is midnight UTC and renders as the 25th for anyone west of it.
 * `parseISO` treats date-only as local, which is why it is used here instead of the
 * `Date` constructor.
 *
 * Returns null for anything unparseable, so a bad value shows as a dash rather than
 * "Invalid Date".
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

/** Local midnight today -- the default for any "as of" picker, and its usual maximum. */
export function today(): Date {
  return startOfDay(new Date())
}

/**
 * A date for reading, e.g. `26 Sep 2026`. Day-month-year rather than a locale format,
 * because `09/26` and `26/09` are indistinguishable on screen and this app is read by
 * people in both conventions.
 */
export function formatDate(value: Date | string | null | undefined): string {
  const date = typeof value === 'string' ? parseApiDate(value) : (value ?? null)
  if (!date || !isValid(date)) return '—'
  return format(date, 'd MMM yyyy')
}

/** As `formatDate`, with the weekday: `Sat, 26 Sep 2026`. For one date on its own. */
export function formatDateWithWeekday(value: Date | string | null | undefined): string {
  const date = typeof value === 'string' ? parseApiDate(value) : (value ?? null)
  if (!date || !isValid(date)) return '—'
  return format(date, 'EEE, d MMM yyyy')
}

/** A date and time, for audit columns: `26 Sep 2026, 09:14`. */
export function formatDateTime(value: Date | string | null | undefined): string {
  const date = typeof value === 'string' ? parseApiDate(value) : (value ?? null)
  if (!date || !isValid(date)) return '—'
  return format(date, 'd MMM yyyy, HH:mm')
}
