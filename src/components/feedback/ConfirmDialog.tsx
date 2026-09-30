import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** String or nodes — role deletion, for instance, warns with a user count. */
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button. Use for anything that destroys or deactivates. */
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Shared confirmation step for destructive actions.
 *
 * Most API deletes are soft (the row is deactivated and history is preserved), but
 * they still cascade — deleting a parent deactivates their student links — so they
 * are all worth a confirmation.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {typeof message === 'string' ? (
          <DialogContentText>{message}</DialogContentText>
        ) : (
          message
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          loading={busy}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
