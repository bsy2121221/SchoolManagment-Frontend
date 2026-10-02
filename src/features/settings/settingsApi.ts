import { baseApi } from '@/app/baseApi'
import { LIST_ID } from '@/app/tags'
import type {
  GradeThreshold,
  SettingRow,
  SettingSavePayload,
  SettingsBulkSaveResult,
  SettingValueUpdatePayload,
} from './types'

/** Path segment for one setting. Both halves are free text, so both are encoded. */
function settingPath(category: string, settingKey: string): string {
  return `/settings/${encodeURIComponent(category)}/${encodeURIComponent(settingKey)}`
}

/**
 * SettingsController: all eight endpoints.
 *
 * Every read and write is confined to the school on the caller's token. A platform
 * administrator with no school in scope gets an **empty list** from the reads rather than an
 * error, and a 400 from the writes. The page therefore checks `user.schoolId` before it reads
 * anything, so that "no school" is not shown as "this school has no settings".
 *
 * One tag for the whole module. Sixty-four rows are read in one request, a reset rewrites
 * them all, and the grading scale is derived from six of them, so per-row tags would save
 * nothing.
 */
export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** GET /api/Settings: flat, unpaged, every active row. Settings:View. */
    getSettings: build.query<SettingRow[], void>({
      query: () => '/settings',
      providesTags: [{ type: 'Setting', id: LIST_ID }],
    }),

    /**
     * GET /api/Settings/grades: the scale as `fn_CalculateGrade` applies it. Guarded on
     * Results:View rather than Settings:View, so it is readable by anyone who can see a grade.
     */
    getGradeThresholds: build.query<GradeThreshold[], void>({
      query: () => '/settings/grades',
      providesTags: [{ type: 'Setting', id: 'GRADES' }],
    }),

    /** POST /api/Settings: 409 when an active row already holds the pair. Settings:Create. */
    createSetting: build.mutation<SettingRow, SettingSavePayload>({
      query: (body) => ({ url: '/settings', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Setting', id: LIST_ID },
        { type: 'Setting', id: 'GRADES' },
      ],
    }),

    /** PUT /api/Settings/{category}/{key}: one value. Settings:Edit. */
    updateSetting: build.mutation<
      SettingRow,
      { category: string; settingKey: string; body: SettingValueUpdatePayload }
    >({
      query: ({ category, settingKey, body }) => ({
        url: settingPath(category, settingKey),
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        { type: 'Setting', id: LIST_ID },
        { type: 'Setting', id: 'GRADES' },
      ],
    }),

    /**
     * PUT /api/Settings/bulk: one transaction, but a row the procedure cannot store is
     * **skipped, not failed**. A 200 does not mean every row was written. The caller must
     * read `settingsSkipped` and show `skipped`. Settings:Edit.
     */
    saveSettings: build.mutation<SettingsBulkSaveResult, SettingSavePayload[]>({
      query: (settings) => ({ url: '/settings/bulk', method: 'PUT', body: { settings } }),
      invalidatesTags: [
        { type: 'Setting', id: LIST_ID },
        { type: 'Setting', id: 'GRADES' },
      ],
    }),

    /**
     * DELETE /api/Settings/{category}/{key}: a soft delete. Refused for the six grade
     * thresholds, which `fn_CalculateGrade` reads whether active or not. Settings:Delete.
     */
    deleteSetting: build.mutation<void, { category: string; settingKey: string }>({
      query: ({ category, settingKey }) => ({
        url: settingPath(category, settingKey),
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Setting', id: LIST_ID }],
    }),

    /**
     * POST /api/Settings/reset: **hard-deletes** the rows in scope and re-seeds them, so
     * customised values cannot be recovered. A null category resets every category.
     * Settings:Delete.
     */
    resetSettings: build.mutation<void, { category: string | null }>({
      query: ({ category }) => ({ url: '/settings/reset', method: 'POST', body: { category } }),
      invalidatesTags: [
        { type: 'Setting', id: LIST_ID },
        { type: 'Setting', id: 'GRADES' },
      ],
    }),
  }),
})

export const {
  useGetSettingsQuery,
  useGetGradeThresholdsQuery,
  useCreateSettingMutation,
  useUpdateSettingMutation,
  useSaveSettingsMutation,
  useDeleteSettingMutation,
  useResetSettingsMutation,
} = settingsApi
