import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { Suspense } from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { store } from '@/app/store'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { router } from '@/routes'
import { SnackbarHost } from '@/ui/SnackbarHost'
import { theme } from '@/ui/theme'

/**
 * Providers, outermost first: store, theme, date locale, router.
 *
 * The outer Suspense covers the lazy login and change-password screens, which render
 * outside AppShell and so are not covered by its boundary.
 */
export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Suspense fallback={<FullPageLoader />}>
            <RouterProvider router={router} />
          </Suspense>
          <SnackbarHost />
        </LocalizationProvider>
      </ThemeProvider>
    </Provider>
  )
}
