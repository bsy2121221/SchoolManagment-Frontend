import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { toastDismissed } from './uiSlice'

/**
 * Renders the head of the toast queue.
 *
 * A queue rather than a single slot, because bulk operations report per-batch results
 * and can raise two messages in a row ("saved 28 of 30" then "2 rows skipped");
 * showing one and dropping the other would hide the part that matters.
 */
export function SnackbarHost() {
  const dispatch = useAppDispatch()
  const toast = useAppSelector((s) => s.ui.toasts[0])

  return (
    <Snackbar
      // Keying on the id restarts the auto-hide timer for each toast in the queue.
      key={toast?.id}
      open={Boolean(toast)}
      autoHideDuration={toast?.severity === 'error' ? 8000 : 4000}
      onClose={(_event, reason) => {
        if (reason === 'clickaway') return
        if (toast) dispatch(toastDismissed(toast.id))
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {toast ? (
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => dispatch(toastDismissed(toast.id))}
          sx={{ minWidth: 320 }}
        >
          {toast.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  )
}
