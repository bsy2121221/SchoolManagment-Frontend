import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'
import { Link as RouterLink } from 'react-router-dom'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { displayName, useCan, useCurrentUser, useIsSuperAdmin } from '@/features/auth/permissions'
import { formatDateTime } from '@/lib/dates'
import { useGetDashboardQuery } from '../dashboardApi'
import { ParentDashboard, StudentDashboard, TeacherDashboard } from '../components/PersonalSections'
import { PlatformSection } from '../components/PlatformSection'
import { RecentActivityCard } from '../components/RecentActivityCard'
import { SchoolStatsSection } from '../components/SchoolStatsSection'

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="h6" sx={{ mb: 1.5 }}>
      {children}
    </Typography>
  )
}

/**
 * `/`: the landing page for every role, from the one `GET /api/Dashboard` call.
 *
 * The server decides which sections apply, and the page draws whichever come back rather
 * than branching on the role itself:
 *
 * - `platform` for a SuperAdmin with no school in scope,
 * - `school` for anyone with Reports:View (Admin, Teacher, and a SuperAdmin switched into
 *   a school),
 * - `teacher`, `student`, `parent` for the signed-in person's own record,
 * - `recentActivity` always.
 *
 * `omitted` lists what the permission grid trimmed. Those figures are shown as "Not
 * available" and listed under the page, so a withheld total never reads as a zero.
 *
 * `generatedAt` is printed because several figures are "today" counts: a tab left open
 * overnight is reporting yesterday, and the refresh button is the fix.
 */
export default function DashboardPage() {
  const user = useCurrentUser()
  const isSuperAdmin = useIsSuperAdmin()
  const canViewSettings = useCan('Settings', 'View')
  const { data, isLoading, isFetching, error, refetch } = useGetDashboardQuery()

  const header = (
    <PageHeader
      title={`Welcome, ${displayName(user)}`}
      subtitle={
        data
          ? `${user?.schoolName ?? (data.platform ? 'Platform administration' : user?.role ?? '')} · as of ${formatDateTime(data.generatedAt)}`
          : (user?.schoolName ?? 'Platform administration')
      }
      actions={
        <Stack direction="row" spacing={1}>
          {canViewSettings && (user?.schoolId ?? null) !== null && (
            <Button variant="outlined" component={RouterLink} to="/settings" startIcon={<SettingsIcon />}>
              Settings
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </Stack>
      }
    />
  )

  if (isLoading) {
    return (
      <>
        {header}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          }}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={112} />
          ))}
        </Box>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState error={error} title="Could not load the dashboard" onRetry={refetch} />
      </>
    )
  }

  const hasPersonal = Boolean(data.teacher || data.student || data.parent)
  const nothing = !data.school && !data.platform && !hasPersonal

  return (
    <>
      {header}

      <Stack spacing={4}>
        {isSuperAdmin && data.schoolId !== null && (
          <Alert severity="warning">
            You are acting as <strong>{user?.schoolName ?? data.schoolCode}</strong>. These are that
            school&apos;s figures. Leave the school from Settings to return to the platform view.
          </Alert>
        )}

        {data.platform && (
          <section>
            <SectionTitle>Platform</SectionTitle>
            <PlatformSection platform={data.platform} />
          </section>
        )}

        {data.school && (
          <section>
            <SectionTitle>School at a glance</SectionTitle>
            <SchoolStatsSection stats={data.school} omitted={data.omitted} />
          </section>
        )}

        {data.teacher && (
          <section>
            <SectionTitle>Your teaching</SectionTitle>
            <TeacherDashboard teacher={data.teacher} />
          </section>
        )}

        {data.student && (
          <section>
            <SectionTitle>Your record</SectionTitle>
            <StudentDashboard student={data.student} />
          </section>
        )}

        {data.parent && (
          <section>
            <SectionTitle>Your children</SectionTitle>
            <ParentDashboard parent={data.parent} />
          </section>
        )}

        {nothing && (
          <Alert severity="info">
            There are no figures for your role. Use the menu to open the screens available to you.
          </Alert>
        )}

        <RecentActivityCard activity={data.recentActivity} />

        {data.omitted.length > 0 && (
          <Alert severity="info">
            Some figures are not shown because your role does not include them:
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
              {data.omitted.map((item) => (
                <li key={item.field}>
                  <code>{item.field}</code>: {item.reason}
                </li>
              ))}
            </Box>
          </Alert>
        )}
      </Stack>
    </>
  )
}
