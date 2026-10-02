import type { SettingDataType, SettingRow } from './types'

/**
 * Constants.SettingCategories, in the order the page shows them, with a reading label.
 *
 * The six are a convention, not a constraint: the API accepts any category name, so a
 * school can hold rows under a name not listed here. `groupByCategory` keeps those and
 * puts them after the six, so a setting is never hidden for having an unusual category.
 */
export const SEEDED_CATEGORIES = [
  { key: 'SystemInformation', label: 'School information' },
  { key: 'AcademicSettings', label: 'Academic' },
  { key: 'UserManagement', label: 'Users & passwords' },
  { key: 'SecuritySettings', label: 'Security' },
  { key: 'NotificationSettings', label: 'Notifications' },
  { key: 'SystemConfiguration', label: 'System' },
] as const

export const ACADEMIC_CATEGORY = 'AcademicSettings'

export function categoryLabel(category: string): string {
  return SEEDED_CATEGORIES.find((c) => c.key === category)?.label ?? category
}

export interface SettingGroup {
  category: string
  label: string
  rows: SettingRow[]
}

/** Seeded categories first in their fixed order, then any others alphabetically. */
export function groupByCategory(rows: readonly SettingRow[]): SettingGroup[] {
  const byCategory = new Map<string, SettingRow[]>()
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? []
    list.push(row)
    byCategory.set(row.category, list)
  }

  const seededKeys: string[] = SEEDED_CATEGORIES.map((c) => c.key)
  const extra = [...byCategory.keys()]
    .filter((key) => !seededKeys.includes(key))
    .sort((a, b) => a.localeCompare(b))

  return [...seededKeys, ...extra]
    .filter((key) => byCategory.has(key))
    .map((key) => ({
      category: key,
      label: categoryLabel(key),
      rows: (byCategory.get(key) ?? []).toSorted((a, b) => a.settingKey.localeCompare(b.settingKey)),
    }))
}

/**
 * The six settings anything in the system actually reads. `fn_CalculateGrade` applies them
 * to every mark written, in this order.
 *
 * Every other seeded setting is **stored and returned, and read by nothing**. No procedure
 * or service consults `maintenanceMode`, `sessionTimeout`, `minPasswordLength` or the rest:
 * token lifetimes and the password rule come from `Constants.cs` and the DTO validators.
 * The page says so rather than letting an administrator believe that switching
 * `twoFactorEnabled` on has done anything.
 */
export const GRADE_THRESHOLD_KEYS = [
  'gradeThresholdAPlus',
  'gradeThresholdA',
  'gradeThresholdB',
  'gradeThresholdC',
  'gradeThresholdD',
  'gradeThresholdE',
] as const

export function isGradeThreshold(row: Pick<SettingRow, 'category' | 'settingKey'>): boolean {
  return (
    row.category.toLowerCase() === ACADEMIC_CATEGORY.toLowerCase() &&
    GRADE_THRESHOLD_KEYS.some((key) => key.toLowerCase() === row.settingKey.toLowerCase())
  )
}

/** The stored type, lower-cased as the server compares it; anything unknown reads as string. */
export function dataTypeOf(row: Pick<SettingRow, 'dataType'>): SettingDataType {
  const type = row.dataType.trim().toLowerCase()
  return type === 'number' || type === 'boolean' || type === 'json' ? type : 'string'
}

/** What `TRY_CONVERT(DECIMAL(38,10), ...)` accepts: a sign and a point, no exponent or commas. */
const NUMBER_PATTERN = /^\s*[+-]?(\d+\.?\d*|\.\d+)\s*$/

/**
 * The client half of `fn_IsValidSettingValue` / `SettingService.IsValidValue`, so a bad
 * value is caught under its own input instead of coming back as one of the bulk save's
 * skipped rows. The server has the last word either way.
 *
 * Returns the error to show, or null when the value is acceptable.
 */
export function validateValue(type: SettingDataType, value: string): string | null {
  switch (type) {
    case 'string':
      return null
    case 'number':
      return NUMBER_PATTERN.test(value) ? null : 'Must be a number, e.g. 40 or 12.5'
    case 'boolean':
      return ['true', 'false', '1', '0'].includes(value.replace(/ +$/, '').toLowerCase())
        ? null
        : 'Must be true or false'
    case 'json': {
      // ISJSON on the server accepts objects and arrays only.
      const trimmed = value.trimStart()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return 'Must be a JSON object or array'
      }
      try {
        JSON.parse(value)
        return null
      } catch {
        return 'Not valid JSON'
      }
    }
  }
}

/** A stored boolean as the switch shows it. `1` and `0` are legal stored values too. */
export function isTruthy(value: string): boolean {
  const normalised = value.trim().toLowerCase()
  return normalised === 'true' || normalised === '1'
}

/** `gradeThresholdAPlus` → `Grade threshold A plus`, for keys with no description. */
export function humaniseKey(key: string): string {
  const spaced = key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** A stable key for a row, matching the server's case-insensitive identity of the pair. */
export function rowKey(row: Pick<SettingRow, 'category' | 'settingKey'>): string {
  return `${row.category.toLowerCase()}\u0000${row.settingKey.toLowerCase()}`
}
