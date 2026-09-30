import ApartmentIcon from '@mui/icons-material/Apartment'
import GroupsIcon from '@mui/icons-material/Groups'
import SchoolIcon from '@mui/icons-material/School'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { StatCard } from '@/components/data/StatCard'
import type { PlatformStats } from '../types'

const GRID_SX = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
} as const

/**
 * The four figures a platform administrator opens the app to see, from
 * `GET /api/Schools/platform-stats`.
 *
 * One honesty note carried in the captions: the user counts are **by role**, so
 * anybody in a custom role (ids from 100 up) is in none of them. `totalAdmins +
 * totalTeachers + totalStudents + totalParents` can therefore be smaller than the
 * real head count, and the caption says so rather than implying a total.
 */
export function PlatformStatCards({ stats }: { stats: PlatformStats }) {
  const suspended = stats.inactiveSchools

  return (
    <Box sx={GRID_SX}>
      <StatCard
        label="Schools"
        value={stats.totalSchools}
        icon={ApartmentIcon}
        caption={
          suspended > 0 ? (
            <>
              {stats.activeSchools} active,{' '}
              <Typography component="span" variant="caption" color="warning.main">
                {suspended} suspended
              </Typography>
            </>
          ) : (
            `All ${stats.activeSchools} active`
          )
        }
      />

      <StatCard
        label="Onboarded, 30 days"
        value={stats.schoolsAddedLast30Days}
        icon={ApartmentIcon}
        iconColor="success.main"
        caption={
          stats.schoolsAddedLast30Days === 0
            ? 'No new tenants this month'
            : `of ${stats.totalSchools} in total`
        }
      />

      <StatCard
        label="Students"
        value={stats.totalStudents.toLocaleString()}
        icon={SchoolIcon}
        caption={`across ${stats.totalClasses.toLocaleString()} classes`}
      />

      <StatCard
        label="Staff & parents"
        value={(stats.totalTeachers + stats.totalAdmins).toLocaleString()}
        icon={GroupsIcon}
        caption={`${stats.totalTeachers.toLocaleString()} teachers, ${stats.totalAdmins.toLocaleString()} admins, ${stats.totalParents.toLocaleString()} parents`}
      />
    </Box>
  )
}

/** Same grid, four skeletons — so the page does not reflow when the figures land. */
export function PlatformStatCardsSkeleton() {
  return (
    <Box sx={GRID_SX}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rounded" height={116} />
      ))}
    </Box>
  )
}
