import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { MODULES } from '@/types/enums'
import type { ModuleName } from '@/types/enums'
import type {
  AuthState,
  LoginResponse,
  PermissionMap,
  RolePermission,
  SessionUser,
} from './types'

/**
 * This slice must not import app/store or app/baseApi: baseApi dispatches these
 * actions, so a reverse import would close a cycle.
 */

const STORAGE_KEY = 'sm.auth'

const EMPTY: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  permissions: {},
  bootstrapped: false,
}

/** Only the module names the server actually grids are accepted as keys. */
const KNOWN_MODULES = new Set<string>(MODULES)

/**
 * Flatten the permission list into a map keyed by module.
 *
 * Two server rules are enforced here so no caller has to remember them:
 *  - a module with `isActive: false` is treated as absent, i.e. denied;
 *  - a module name we do not recognise is dropped rather than stored, so a
 *    server-side rename surfaces as "no access" rather than a phantom grant.
 */
function toPermissionMap(rows: readonly Partial<RolePermission>[]): PermissionMap {
  const map: PermissionMap = {}
  for (const row of rows) {
    const name = row.moduleName
    if (!name || !KNOWN_MODULES.has(name)) continue
    if (row.isActive === false) continue
    map[name as ModuleName] = {
      canView: row.canView ?? false,
      canCreate: row.canCreate ?? false,
      canEdit: row.canEdit ?? false,
      canDelete: row.canDelete ?? false,
    }
  }
  return map
}

function toSessionUser(res: LoginResponse): SessionUser {
  return {
    userId: res.userId,
    username: res.username,
    email: res.email,
    firstName: res.firstName,
    lastName: res.lastName,
    role: res.role,
    roleId: res.roleId,
    schoolId: res.schoolId,
    schoolCode: res.schoolCode,
    schoolName: res.schoolName,
    requirePasswordChange: res.requirePasswordChange,
  }
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The API returns tokens in the response body and offers no httpOnly-cookie path,
 * so they have to live somewhere reachable by script. That is an accepted XSS
 * tradeoff of the API's design, not a preference -- see FRONTEND_PLAN.md §6.
 */
type PersistedAuth = Pick<AuthState, 'user' | 'accessToken' | 'refreshToken' | 'permissions'>

export function loadPersistedAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY, bootstrapped: true }
    const parsed = JSON.parse(raw) as Partial<PersistedAuth>
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) {
      return { ...EMPTY, bootstrapped: true }
    }
    return {
      user: parsed.user,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      permissions: parsed.permissions ?? {},
      bootstrapped: true,
    }
  } catch {
    // Corrupt or unreadable (private mode, quota): start logged out rather than crash.
    return { ...EMPTY, bootstrapped: true }
  }
}

export function persistAuth(state: AuthState): void {
  try {
    if (!state.accessToken || !state.user) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    const payload: PersistedAuth = {
      user: state.user,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      permissions: state.permissions,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage full or blocked: the session still works for this tab.
  }
}

/* -------------------------------------------------------------------------- */
/* Slice                                                                       */
/* -------------------------------------------------------------------------- */

const authSlice = createSlice({
  name: 'auth',
  initialState: loadPersistedAuth(),
  reducers: {
    /** A successful /auth/login. */
    sessionEstablished(state, action: PayloadAction<LoginResponse>) {
      state.user = toSessionUser(action.payload)
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.permissions = toPermissionMap(action.payload.permissions)
    },

    /**
     * A successful /auth/refresh-token. Same payload as login, so the grid is
     * renewed alongside the tokens -- a role edited server-side takes effect at the
     * next refresh without a re-login.
     */
    sessionRefreshed(state, action: PayloadAction<LoginResponse>) {
      state.user = toSessionUser(action.payload)
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.permissions = toPermissionMap(action.payload.permissions)
    },

    /** Live grid from GET /roles/my-permissions, which needs no permission itself. */
    permissionsUpdated(state, action: PayloadAction<RolePermission[]>) {
      state.permissions = toPermissionMap(action.payload)
    },

    /**
     * Clears the forced-change gate after /auth/change-password succeeds. That
     * endpoint returns no new token, and the token carries no such flag, so the
     * client is the only place this can be cleared.
     */
    passwordChangeSatisfied(state) {
      if (state.user) state.user.requirePasswordChange = false
    },

    /** Logout, or an unrecoverable 401. Callers should also reset the RTK Query cache. */
    loggedOut(state) {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.permissions = {}
      state.bootstrapped = true
    },
  },
})

export const {
  sessionEstablished,
  sessionRefreshed,
  permissionsUpdated,
  passwordChangeSatisfied,
  loggedOut,
} = authSlice.actions

export default authSlice.reducer
