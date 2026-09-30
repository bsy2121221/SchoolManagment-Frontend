import RefreshIcon from '@mui/icons-material/Refresh'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import { getErrorMessage } from '@/lib/serverErrors'
import type { QueryError } from '@/lib/serverErrors'

interface ErrorStateProps {
  error: QueryError
  title?: string
  /** Wire to an RTK Query `refetch` to let the user retry without a reload. */
  onRetry?: () => void
}

/**
 * Failure state for a query. Every list and detail screen renders this rather than
 * silently showing an empty table, which is indistinguishable from "no records".
 */
export function ErrorState({ error, title = 'Could not load this', onRetry }: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {getErrorMessage(error)}
    </Alert>
  )
}
