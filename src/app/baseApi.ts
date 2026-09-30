import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  QueryReturnValue,
} from '@reduxjs/toolkit/query'
import { Mutex } from 'async-mutex'
import { loggedOut, sessionRefreshed } from '@/features/auth/authSlice'
import type { LoginResponse } from '@/features/auth/types'
import type { ApiFailure, ApiResponse } from '@/types/api'
import { TAG_TYPES } from './tags'

/**
 * The single gateway to SchoolManagment.API.
 *
 * Two things happen here so that no feature ever repeats them:
 *
 *  1. The ApiResponse<T> envelope is stripped, so `useGetStudentsQuery().data` is the
 *     payload rather than `{ success, message, data }`.
 *  2. A 401 triggers one shared token refresh and the original request is replayed.
 *
 * It deliberately does NOT import app/store -- store.ts imports this module, so the
 * state it needs is described structurally instead.
 */

/** Minimal structural view of the store, to avoid a store <-> baseApi import cycle. */
interface StateWithAuth {
  auth: { accessToken: string | null; refreshToken: string | null }
}

/** Routes that must never trigger a refresh attempt, or a 401 would loop. */
const REFRESH_EXEMPT = ['/auth/login', '/auth/refresh-token']

function urlOf(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : args.url
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as StateWithAuth).auth.accessToken
    if (token) headers.set('authorization', `Bearer ${token}`)
    return headers
  },
})

/** What both rawBaseQuery and our wrapper hand back. */
type Result = QueryReturnValue<unknown, FetchBaseQueryError, FetchBaseQueryMeta>

/** Does this look like an ApiResponse<T> rather than a bare payload or a blob? */
function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  )
}

/**
 * Unwrap ApiResponse<T> into T.
 *
 * `success: false` arriving with HTTP 200 is converted into an RTK Query error, so
 * components have one failure path instead of also testing `data.success`. The
 * envelope is kept as the error payload so field-level `errors` survive for forms.
 */
function unwrapEnvelope(result: Result): Result {
  if (result.error || !isEnvelope(result.data)) return result

  const envelope = result.data
  if (envelope.success) {
    return { data: envelope.data, meta: result.meta }
  }

  const failure: ApiFailure = { message: envelope.message, errors: envelope.errors }
  return {
    error: { status: 'CUSTOM_ERROR', data: failure, error: envelope.message },
    meta: result.meta,
  }
}

/**
 * Serialises refresh attempts.
 *
 * Without this, a dashboard firing six queries on a stale token would fire six
 * refreshes. Because the API rotates refresh tokens, the first response would
 * invalidate the token the other five are still using, and the user would be logged
 * out mid-session. So: the first 401 takes the lock and refreshes; the rest wait and
 * then replay against the new token.
 */
const refreshMutex = new Mutex()

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  {},
  FetchBaseQueryMeta
> = async (args, api, extraOptions) => {
  // Queue behind an in-flight refresh so we don't spend a request on a known-dead token.
  await refreshMutex.waitForUnlock()

  let result = unwrapEnvelope(await rawBaseQuery(args, api, extraOptions))

  const isUnauthorised = result.error?.status === 401
  if (!isUnauthorised || REFRESH_EXEMPT.includes(urlOf(args))) {
    return result
  }

  if (refreshMutex.isLocked()) {
    // Someone else is refreshing: wait for them, then retry once.
    await refreshMutex.waitForUnlock()
    return unwrapEnvelope(await rawBaseQuery(args, api, extraOptions))
  }

  const release = await refreshMutex.acquire()
  try {
    const refreshToken = (api.getState() as StateWithAuth).auth.refreshToken
    if (!refreshToken) {
      api.dispatch(loggedOut())
      return result
    }

    const refreshed = unwrapEnvelope(
      await rawBaseQuery(
        { url: '/auth/refresh-token', method: 'POST', body: { refreshToken } },
        api,
        extraOptions,
      ),
    )

    if (refreshed.data) {
      // Carries new tokens AND a fresh permission grid.
      api.dispatch(sessionRefreshed(refreshed.data as LoginResponse))
      result = unwrapEnvelope(await rawBaseQuery(args, api, extraOptions))
    } else {
      api.dispatch(loggedOut())
    }
  } finally {
    release()
  }

  return result
}

/**
 * Each feature adds its endpoints with `baseApi.injectEndpoints`. One API slice
 * rather than one per module, so cache tags are shared across feature boundaries.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: TAG_TYPES,
  // Lists are paginated and permission-scoped; refetching on remount keeps a
  // returning tab honest without hammering the API mid-session.
  refetchOnMountOrArgChange: 30,
  refetchOnReconnect: true,
  endpoints: () => ({}),
})
