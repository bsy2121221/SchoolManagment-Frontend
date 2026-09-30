import ConstructionIcon from '@mui/icons-material/Construction'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { PageHeader } from '@/components/layout/PageHeader'

/**
 * Stands in for a module that is routed and permission-gated but not yet built.
 *
 * Keeping these routes live means the shell, the sidebar filtering and the guards can
 * all be exercised now, and each later phase replaces one placeholder with the real
 * screens rather than adding wiring.
 */
export function ModulePlaceholder({ title, phase }: { title: string; phase: string }) {
  return (
    <Box>
      <PageHeader title={title} />
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5} sx={{ py: 5, textAlign: 'center', alignItems: 'center' }}>
            <ConstructionIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Not built yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              You can reach this page, so your role permits it. The screens arrive in{' '}
              {phase}.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
