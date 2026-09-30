import { configureStore } from '@reduxjs/toolkit'
import authReducer, { persistAuth } from '@/features/auth/authSlice'
import uiReducer from '@/ui/uiSlice'
import { baseApi } from './baseApi'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  devTools: import.meta.env.DEV,
})

/**
 * Persist the session only.
 *
 * redux-persist would add a dependency and a rehydration lifecycle to reason about
 * for what is, here, a subscription and a shallow equality check. The RTK Query
 * cache is deliberately not persisted: stale server data surviving a reload is worse
 * than refetching it.
 */
let lastPersisted = store.getState().auth
store.subscribe(() => {
  const { auth } = store.getState()
  if (auth !== lastPersisted) {
    lastPersisted = auth
    persistAuth(auth)
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
