import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { selectIsSuperAdmin } from '@/features/auth/permissions'
import { getErrorStatus } from '@/lib/serverErrors'
import { useGetCurrentSchoolQuery } from '../schoolsApi'
import { SchoolEditDialog } from '../components/SchoolEditDialog'
import { SchoolProfile } from '../components/SchoolProfile'

/**
 * A school administrator's view of their own school: `GET /api/Schools/current`, which
 * takes no id and reads the one on the caller's token. There is no way to point it at
 * another tenant.
 *
 * The seeded Admin role holds `Schools:View` and `Schools:Edit` but not Create or
 * Delete, which is exactly "see and maintain my own school, and nothing about anyone
 * else's" — so this page offers editing and nothing more. Suspension is absent on
 * purpose: the endpoint is SuperAdmin-only, and an admin suspending their own school
 * would lock out every one of their users including themselves.
 */
export default function MySchoolPage() {
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin)
  const [editOpen, setEditOpen] = useState(false)

  const { data: school, isLoading, error, refetch } = useGetCurrentSchoolQuery()

  if (isLoading) return <FullPageLoader label="Loading your school…" />

  // A SuperAdmin has no own school, so the API answers 404. That is a fact about the
  // account, not a failure, and it reads as one.
  if (getErrorStatus(error) === 404) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title={isSuperAdmin ? 'You are not inside a school' : 'No school on this account'}
          description={
            isSuperAdmin
              ? 'Platform administrators sit outside every tenant, so there is no "my school" to show. Manage tenants from the platform page instead.'
              : 'This account has no school on its token, which usually means it was created outside the onboarding flow. An administrator will need to look at it.'
          }
          action={
            isSuperAdmin ? (
              <Button component={RouterLink} to="/platform" variant="contained">
                Go to the platform page
              </Button>
            ) : undefined
          }
        />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState
          error={error}
          title="Could not load your school"
          onRetry={() => void refetch()}
        />
      </Box>
    )
  }

  if (!school) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState title="No school to show" />
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="My school"
        subtitle={`${school.schoolName} · code ${school.schoolCode}`}
        actions={
          <Can module="Schools" action="Edit">
            <Button
              variant="contained"
              startIcon={<EditOutlinedIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit details
            </Button>
          </Can>
        }
      />

      <Stack spacing={3}>
        {!school.isActive && (
          <Alert severity="warning">
            <AlertTitle>This school is suspended</AlertTitle>
            Only a platform administrator can restore it. Records are intact in the
            meantime.
          </Alert>
        )}

        <SchoolProfile school={school} explainAcademicYear />

        <Alert severity="info">
          <AlertTitle>The school code cannot change</AlertTitle>
          <strong>{school.schoolCode}</strong> is built into every username and admission
          number already issued here, so it is fixed for the life of the school. Everything
          else on this page can be edited.
        </Alert>
      </Stack>

      {editOpen && (
        <SchoolEditDialog open school={school} onClose={() => setEditOpen(false)} />
      )}
    </Box>
  )
}
