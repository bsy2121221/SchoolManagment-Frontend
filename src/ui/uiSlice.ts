import { createSlice, nanoid } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  severity: ToastSeverity
}

interface UiState {
  /** FIFO queue; SnackbarHost shows the head. */
  toasts: Toast[]
  sidebarOpen: boolean
}

const initialState: UiState = {
  toasts: [],
  sidebarOpen: true,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toastShown: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload)
      },
      // `prepare` generates the id, so callers dispatch toastShown({ message }) only.
      prepare(payload: { message: string; severity?: ToastSeverity }) {
        return {
          payload: {
            id: nanoid(),
            message: payload.message,
            severity: payload.severity ?? 'info',
          },
        }
      },
    },
    toastDismissed(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
    sidebarToggled(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
    sidebarSet(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload
    },
  },
})

export const { toastShown, toastDismissed, sidebarToggled, sidebarSet } = uiSlice.actions

/** Convenience wrappers so call sites read as intent, not as configuration. */
export const toastSuccess = (message: string) => toastShown({ message, severity: 'success' })
export const toastError = (message: string) => toastShown({ message, severity: 'error' })

export default uiSlice.reducer
