import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ApiFailure, ErrorDetail } from '@/types/api'

/**
 * What an RTK Query hook hands back in its `error` slot.
 *
 * The functions below take `unknown` rather than this type, because the other source
 * of errors is `await mutation().unwrap()` inside a try/catch, and `catch` binds
 * `unknown`. Narrowing here rather than casting at ~40 call sites.
 */
export type QueryError = FetchBaseQueryError | SerializedError | undefined

function isFetchError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error !== null && 'status' in error
}

function isSerializedError(error: unknown): error is SerializedError {
  return typeof error === 'object' && error !== null && 'message' in error
}

function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === 'object' && value !== null && 'message' in value
}

/**
 * A message worth showing a user.
 *
 * Covers the four shapes the API can fail in: our own unwrapped `{ success: false }`
 * envelope, an envelope attached to a 4xx, an ASP.NET ProblemDetails from the
 * framework (model binding failures never reach our controllers), and a transport
 * error where there is no response at all.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback

  if (isFetchError(error)) {
    if (error.status === 'FETCH_ERROR') {
      return 'Cannot reach the server. Check that the API is running.'
    }
    if (error.status === 'PARSING_ERROR') return 'The server sent an unreadable response.'
    if (error.status === 'TIMEOUT_ERROR') return 'The server took too long to respond.'

    const data: unknown = 'data' in error ? error.data : undefined
    if (isApiFailure(data) && data.message) return data.message
    if (typeof data === 'object' && data !== null && 'title' in data) {
      return String((data as { title: unknown }).title)
    }
    if (typeof data === 'string' && data) return data

    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to do that.'
    if (error.status === 404) return 'Not found.'
    if (typeof error.status === 'number' && error.status >= 500) {
      return 'The server encountered an error. Please try again.'
    }
    return fallback
  }

  if (isSerializedError(error)) return error.message ?? fallback
  return fallback
}

/**
 * The HTTP status a failure carried, or undefined when there was no response at all
 * (transport error, parse failure, a thunk that threw).
 *
 * Needed where a particular status *is* a state rather than a fault: `GET
 * /api/Schools/{id}` answers 404 — not 403 — for a school admin reading another
 * tenant, and `GET /api/Schools/current` answers 404 for a SuperAdmin, who has no own
 * school. Both want a sentence, not a red alert.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (!isFetchError(error)) return undefined
  return typeof error.status === 'number' ? error.status : undefined
}

/** The per-field `errors` list, if the failure carried one. */
export function getFieldErrors(error: unknown): ErrorDetail[] {
  if (!isFetchError(error)) return []
  const data: unknown = 'data' in error ? error.data : undefined
  if (isApiFailure(data) && Array.isArray(data.errors)) return data.errors
  return []
}

/**
 * Route server validation onto the inputs that caused it.
 *
 * The API's ErrorDetail.field is PascalCase when set at all -- controllers send `""`
 * for ModelState errors, which is most of them. Named fields are lower-cased to match
 * our form field names; anything unnamed or unrecognised is returned so the caller can
 * show it at form level instead of dropping it silently.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
): string[] {
  const unassigned: string[] = []

  for (const detail of getFieldErrors(error)) {
    const candidate = detail.field
      ? ((detail.field.charAt(0).toLowerCase() + detail.field.slice(1)) as Path<T>)
      : null

    if (candidate && knownFields.includes(candidate)) {
      setError(candidate, { type: 'server', message: detail.message })
    } else {
      unassigned.push(detail.message)
    }
  }

  return unassigned
}
