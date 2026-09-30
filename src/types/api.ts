/**
 * Mirrors SchoolManagment.Models/Common.
 *
 * ApiResponse is unwrapped centrally in app/baseApi.ts, so feature code sees the
 * `data` payload directly and never writes `response.data.data`. These types exist
 * for the unwrapping layer and for error handling.
 */

/** Common/ApiResponse.cs -> ErrorDetail */
export interface ErrorDetail {
  /** Empty string for non-field errors; the API sends "" for ModelState errors. */
  field: string
  message: string
}

/** Common/ApiResponse.cs -> ApiResponse<T> */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
  errors: ErrorDetail[] | null
}

/**
 * Common/PaginatedResponse.cs
 *
 * `page` is 1-based. MUI DataGrid is 0-based -- the conversion lives in exactly one
 * place, components/data/ServerDataGrid.tsx.
 */
export interface PaginatedResponse<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

/** Query string shape shared by every paginated list endpoint. */
export interface PageQuery {
  page?: number
  pageSize?: number
}

/** Shape of `{ success: false }` surfaced as an RTK Query error. */
export interface ApiFailure {
  message: string
  errors: ErrorDetail[] | null
}
