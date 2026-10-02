import { baseApi } from '@/app/baseApi'
import type { Dashboard } from './types'

/**
 * DashboardController.
 *
 * Only `GET /api/Dashboard` is used. It has no permission guard of its own: the server picks
 * the sections from the caller's role and grid, so every signed-in user can call it and gets
 * what they are entitled to. `/dashboard/stats` (Reports:View, 400 without a school) and
 * `/dashboard/activities` return subsets of the same response and are not needed separately.
 *
 * Not tagged by any write: the figures are counts across half the schema, and invalidating
 * them from every mutation in the app would refetch the landing page on each keystroke of
 * a mark sheet. `refetchOnMountOrArgChange` re-reads it on return, the page has a refresh
 * button, and the tag is dropped when the school scope changes.
 */
export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<Dashboard, void>({
      query: () => '/dashboard',
      providesTags: ['Dashboard'],
    }),
  }),
})

export const { useGetDashboardQuery } = dashboardApi
