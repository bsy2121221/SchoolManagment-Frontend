/**
 * Mirrors SchoolManagment.Models/DTOs/Settings.
 *
 * A setting is addressed by `(category, settingKey)`, never by `id`: `sp_ResetSettings`
 * deletes and re-seeds the rows, so an id cached before a reset points at nothing after it.
 * The school is absent from every request, as everywhere else. It comes from the token.
 */

/** CK_Settings_DataType. */
export const SETTING_DATA_TYPES = ['string', 'number', 'boolean', 'json'] as const
export type SettingDataType = (typeof SETTING_DATA_TYPES)[number]

/** DTOs/Settings/SettingDTO.cs */
export interface SettingRow {
  id: number
  schoolId: number
  category: string
  settingKey: string
  /** Always text, whatever `dataType` says. The column is NVARCHAR(MAX). */
  settingValue: string
  /** Typed as string because rows written before the check constraint may hold anything. */
  dataType: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  /** Null when written by someone outside the school, i.e. a switched platform administrator. */
  createdBy: number | null
  updatedBy: number | null
}

/** DTOs/Settings/GradeThresholdDTO.cs, in the order `fn_CalculateGrade` tests the bands. */
export interface GradeThreshold {
  grade: string
  minPercentage: number
  /** Null for F, which is what is left below E and has no setting. */
  settingKey: string | null
  /** The setting is missing or not a number, and the function's built-in default applies. */
  isDefault: boolean
}

/** DTOs/Settings/SettingSaveDTO.cs: the body of POST and one element of a bulk save. */
export interface SettingSavePayload {
  category: string
  settingKey: string
  /** May be empty, never null. */
  settingValue: string
  dataType?: SettingDataType
  description?: string | null
}

/** DTOs/Settings/SettingValueUpdateDTO.cs. Omitted fields keep what is stored. */
export interface SettingValueUpdatePayload {
  settingValue: string
  dataType?: SettingDataType
  description?: string
}

/** DTOs/Settings/SettingsBulkSaveResultDTO.cs */
export interface SettingsBulkSaveResult {
  settingsSaved: number
  /** The procedure's own count, and the authoritative one. */
  settingsSkipped: number
  /** The service's explanation of the count. Trust the count if the two ever disagree. */
  skipped: SkippedSetting[]
}

export interface SkippedSetting {
  category: string
  settingKey: string
  reason: string
}
