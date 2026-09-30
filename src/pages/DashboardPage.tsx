import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useAppSelector } from '@/app/hooks'
import { PageHeader } from '@/components/layout/PageHeader'
import { displayName, selectCurrentUser } from '@/features/auth/permissions'
import { MODULES } from '@/types/enums'
import type { ModuleName } from '@/types/enums'

/**
 * Placeholder landing page.
 *
 * Real role-specific dashboards are Phase 14, and they need aggregate endpoints the
 * API does not expose yet — 14_Procs_Dashboard.sql exists but no DashboardController
 * does. Until then this shows the session and the resolved permission grid, which is
 * genuinely useful while the remaining modules are built.
 */
export default function DashboardPage() {
  const user = useAppSelector(selectCurrentUser)
  const permissions = useAppSelector((s) => s.auth.permissions)

  const granted = MODULES.filter((m) => permissions[m]?.canView)

  return (
    <Box>
      <PageHeader
        title={`Welcome, ${displayName(user)}`}
        subtitle={user?.schoolName ?? 'Platform administration'}
      />

      <Stack spacing={3}>
        <Alert severity="info">
          Signed in as <strong>{user?.role}</strong>. Dashboards with live figures arrive
          in the final phase, once the API exposes aggregate endpoints.
        </Alert>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Your access
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {granted.length} of {MODULES.length} modules are visible to your role. A
              module absent from the grid is denied.
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {granted.map((module) => (
                <PermissionChip key={module} module={module} flags={permissions[module]} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}

function PermissionChip({
  module,
  flags,
}: {
  module: ModuleName
  flags: { canCreate: boolean; canEdit: boolean; canDelete: boolean } | undefined
}) {
  // Same compact encoding the JWT uses for its "perm" claims: Module:VCED.
  const letters = [
    'V',
    flags?.canCreate ? 'C' : '',
    flags?.canEdit ? 'E' : '',
    flags?.canDelete ? 'D' : '',
  ].join('')

  return <Chip size="small" variant="outlined" label={`${module} · ${letters}`} />
}
