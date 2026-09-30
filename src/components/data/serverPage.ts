import { PAGE } from '@/types/enums'

/**
 * The page a list screen is asking for, in the API's numbering: **1-based**.
 *
 * Separate from ServerDataGrid.tsx so that file exports only its component -- a module
 * mixing components and values breaks Vite's fast refresh, and this constant is imported
 * by every list screen.
 */
export interface ServerPage {
  page: number
  pageSize: number
}

export const FIRST_PAGE: ServerPage = { page: 1, pageSize: PAGE.defaultSize }
