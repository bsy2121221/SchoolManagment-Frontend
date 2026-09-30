import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title?: string
  description?: string
  /** A primary action, e.g. the same "Add" button as the toolbar. */
  action?: ReactNode
}

/** "Nothing here yet" — distinct from a load failure, which uses ErrorState. */
export function EmptyState({
  title = 'Nothing to show',
  description,
  action,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        py: 6,
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        textAlign: 'center',
      }}
    >
      <InboxOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  )
}
