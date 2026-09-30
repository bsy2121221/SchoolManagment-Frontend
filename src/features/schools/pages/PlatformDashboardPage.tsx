import AddIcon from '@mui/icons-material/Add'
import ApartmentIcon from '@mui/icons-material/Apartment'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useModulePermissions } from '@/features/auth/permissions'
import { useGetPlatformStatsQuery, useGetSchoolsQuery } from '../schoolsApi'
import { PlatformStatCards, PlatformStatCardsSkeleton } from '../components/PlatformStatCards'
import { PlatformUsageTable } from '../components/PlatformUsageTable'
import { SchoolOnboardingWizard } from '../components/SchoolOnboardingWizard'

/** How many tenants the summary panel lists before deferring to the full list. */
const PREVIEW_COUNT = 5

/**
 * The platform administrator's landing page — where a SuperAdmin arrives after signing
 * in, instead of the per-school dashboard.
 *
 * It answers one question, "what is on this deployment", and offers one action,
 * onboarding a tenant. Everything a school's own records need — students, teachers,
 * classes, attendance — belongs to that school's admin and is deliberately absent
 * here: a SuperAdmin holds no `Admin` role, so those controllers refuse them anyway.
 * The division is the API's, not this screen's invention.
 */
export default function PlatformDashboardPage() {
  const navigate = useNavigate()
  const { canCreate } = useModulePermissions('Schools')
  const [wizardOpen, setWizardOpen] = useState(false)

  const stats = useGetPlatformStatsQuery()
  // A short alphabetical slice, purely as a way into the full list. The procedure
  // orders by SchoolName, so this cannot be "recently added" and is not labelled so.
  const preview = useGetSchoolsQuery({ page: 1, pageSize: PREVIEW_COUNT })

  const onboardButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWizardOpen(true)}>
      Onboard a school
    </Button>
  )

  const noTenantsYet = stats.data?.totalSchools === 0

  return (
    <Box>
      <PageHeader
        title="Platform"
        subtitle="Every school on this deployment, and the totals across them."
        actions={
          <Can module="Schools" action="Create">
            {onboardButton}
          </Can>
        }
      />

      <Stack spacing={3}>
        {stats.error ? (
          <ErrorState
            error={stats.error}
            title="Could not load the platform totals"
            onRetry={() => void stats.refetch()}
          />
        ) : stats.data ? (
          <PlatformStatCards stats={stats.data} />
        ) : (
          <PlatformStatCardsSkeleton />
        )}

        {noTenantsYet && (
          <Alert severity="info" action={canCreate ? onboardButton : undefined}>
            <AlertTitle>No schools yet</AlertTitle>
            Onboarding creates the school, its first administrator account, its
            admission and receipt number sequences, the default fee types and a starter
            subject list — in one transaction. You then hand the generated username and
            temporary password to that administrator, and they take over their own
            students, teachers and classes from there.
          </Alert>
        )}

        <Paper variant="outlined">
          <Stack
            direction="row"
            spacing={2}
            sx={{ p: 2, alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="h6">Schools</Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.data
                  ? `${stats.data.totalSchools} tenant${stats.data.totalSchools === 1 ? '' : 's'}, alphabetically`
                  : 'Alphabetically'}
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/schools"
              endIcon={<ArrowForwardIcon />}
              size="small"
            >
              View all
            </Button>
          </Stack>

          <Divider />

          {preview.error ? (
            <Box sx={{ p: 2 }}>
              <ErrorState
                error={preview.error}
                title="Could not load the school list"
                onRetry={() => void preview.refetch()}
              />
            </Box>
          ) : preview.isLoading ? (
            <Box sx={{ p: 2 }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} height={48} />
              ))}
            </Box>
          ) : (
            <List disablePadding>
              {(preview.data?.items ?? []).map((school) => (
                <ListItemButton
                  key={school.id}
                  onClick={() => void navigate(`/schools/${school.id}`)}
                >
                  <ListItemIcon>
                    <ApartmentIcon color={school.isActive ? 'primary' : 'disabled'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <span>{school.schoolName}</span>
                        {!school.isActive && (
                          <Chip size="small" label="Suspended" color="warning" variant="outlined" />
                        )}
                      </Stack>
                    }
                    secondary={`${school.schoolCode} · ${school.totalStudents} students · ${school.totalTeachers} teachers · ${school.totalClasses} classes`}
                  />
                </ListItemButton>
              ))}
              {(preview.data?.totalCount ?? 0) > PREVIEW_COUNT && (
                <ListItemButton component={RouterLink} to="/schools">
                  <ListItemText
                    primary={`and ${(preview.data?.totalCount ?? 0) - PREVIEW_COUNT} more`}
                    slotProps={{ primary: { color: 'primary', variant: 'body2' } }}
                  />
                </ListItemButton>
              )}
            </List>
          )}
        </Paper>

        <PlatformUsageTable />
      </Stack>

      <SchoolOnboardingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onOpenSchool={(schoolId) => void navigate(`/schools/${schoolId}`)}
      />
    </Box>
  )
}
