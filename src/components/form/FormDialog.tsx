import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import type { Breakpoint } from '@mui/material/styles'
import type { FormEventHandler, ReactNode } from 'react'

interface FormDialogProps {
  open: boolean
  title: string
  /** Sits above the fields. Use for what the form does, not for how to fill it in. */
  description?: ReactNode
  /**
   * A failure that belongs to the form as a whole rather than to one field: the
   * duplicate grade-and-section refusal, a lost connection, a 403.
   */
  error?: string | null
  submitLabel?: string
  cancelLabel?: string
  busy?: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  onClose: () => void
  maxWidth?: Breakpoint
  children: ReactNode
}

/**
 * The shell every create/edit dialog in the app uses: a `<form>` so Enter submits, a
 * form-level error slot, and a submit button that cannot be double-clicked.
 *
 * Closing is blocked while a request is in flight. The alternative -- dismissing mid
 * flight -- leaves the user with no idea whether the class was created, and the next
 * thing they do is usually try again.
 */
export function FormDialog({
  open,
  title,
  description,
  error,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  busy = false,
  onSubmit,
  onClose,
  maxWidth = 'sm',
  children,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth
      // Remount the body on each open so RHF's defaultValues are re-read; otherwise the
      // dialog would reopen holding the previous row's values.
      keepMounted={false}
    >
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {description}
            {error && <Alert severity="error">{error}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant="contained" loading={busy}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
