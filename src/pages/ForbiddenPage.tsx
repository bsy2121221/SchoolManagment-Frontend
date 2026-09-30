import BlockIcon from '@mui/icons-material/Block'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

/** Where RequirePermission and RequireRole send a user who lacks access. */
export default function ForbiddenPage() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <BlockIcon color="error" sx={{ fontSize: 48 }} />
        <Typography variant="h5">You do not have access to this</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
          Your role does not grant permission for this area. If you believe it should,
          ask an administrator to review your role's permissions.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Back to dashboard
        </Button>
      </Stack>
    </Box>
  )
}
