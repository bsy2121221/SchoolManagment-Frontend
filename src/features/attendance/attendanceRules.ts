/**
 * The judgements this module makes about a percentage, in one place so the summary grid, the
 * stat strip and the history dialog all agree.
 *
 * Kept out of the component files because a module exporting both a component and a helper
 * breaks fast refresh -- the same reason `classLookup.ts` and `roleLookup.ts` exist.
 */

/**
 * Below this, attendance is worth someone's attention.
 *
 * A local constant, not a setting. `SettingsController` stores grade boundaries but nothing
 * about attendance, so there is no school-configured figure to read; 75% is the common
 * requirement and is used here only to colour a cell and count a stat, never to refuse
 * anything. If a school needs its own number it belongs in Settings first, not hard-coded
 * differently in three screens.
 */
export const LOW_ATTENDANCE_THRESHOLD = 75

/**
 * The colour a percentage earns.
 *
 * `null` is `default`, deliberately -- grey, not red. Nothing recorded is not a bad
 * attendance figure, it is the absence of one, and painting it as a failure would accuse a
 * student of a gap in the school's own record-keeping.
 */
export function attendanceTone(
  percentage: number | null,
): 'success' | 'warning' | 'error' | 'default' {
  if (percentage === null) return 'default'
  if (percentage < 50) return 'error'
  if (percentage < LOW_ATTENDANCE_THRESHOLD) return 'warning'
  return 'success'
}

/**
 * A percentage for reading, with null spelled out rather than printed as a number.
 *
 * "0%" and "no record" are different findings and the whole point of the nullable column is
 * to keep them apart; formatting null as `0` here would throw that away at the last step.
 */
export function formatPercentage(percentage: number | null): string {
  if (percentage === null) return 'Not recorded'
  return `${percentage}%`
}

/**
 * The school's (or class's) overall figure, from per-student counts.
 *
 * Summed over the counts rather than averaged over the per-student percentages: a student
 * marked on two days would otherwise weigh as much as one marked on forty. Null when
 * nothing at all was recorded, for the same reason as above.
 */
export function overallPercentage(
  rows: readonly { presentDays: number; totalDays: number }[],
): number | null {
  let present = 0
  let total = 0
  for (const row of rows) {
    present += row.presentDays
    total += row.totalDays
  }
  if (total === 0) return null
  return Math.round((present / total) * 1000) / 10
}
