import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek'
import ClassIcon from '@mui/icons-material/Class'
import EventNoteIcon from '@mui/icons-material/EventNote'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { StatCard } from '@/components/data/StatCard'
import { formatMinutes, shortTime } from '../scheduleRules'
import { useGetTeacherScheduleStatsQuery } from '../scheduleApi'

/**
 * Four figures for one teacher's week, from `sp_GetTeacherScheduleStats`.
 *
 * Hidden on error rather than showing an error of its own: the week underneath reports the
 * same failure, and two red boxes for one request is noise.
 */
export function TeacherScheduleStatCards({ teacherId }: { teacherId: number }) {
  const { data, isLoading, error } = useGetTeacherScheduleStatsQuery(teacherId)

  const grid = {
    display: 'grid',
    gap: 2,
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
  } as const

  if (isLoading) {
    return (
      <Box sx={grid}>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} variant="rounded" height={96} />
        ))}
      </Box>
    )
  }
  if (error || !data || data.totalClasses === 0) return null

  return (
    <Box sx={grid}>
      <StatCard
        label="Lessons a week"
        value={data.totalClasses}
        caption={`Across ${data.daysInWeek} day${data.daysInWeek === 1 ? '' : 's'}`}
        icon={EventNoteIcon}
      />
      <StatCard
        label="Teaching time"
        value={formatMinutes(data.totalMinutesPerWeek)}
        caption="Scheduled per week"
        icon={AccessTimeIcon}
      />
      <StatCard
        label="Classes"
        value={data.totalClassesAssigned}
        caption={`${data.totalSubjects} subject${data.totalSubjects === 1 ? '' : 's'}`}
        icon={ClassIcon}
      />
      <StatCard
        label="Day span"
        value={`${shortTime(data.earliestClass)}–${shortTime(data.latestClass)}`}
        caption="First lesson starts, last one ends"
        icon={CalendarViewWeekIcon}
      />
    </Box>
  )
}
