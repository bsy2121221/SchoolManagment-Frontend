import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { DAYS_OF_WEEK } from '@/types/enums'
import { useGetClassTimetableQuery } from '../classesApi'

/** "09:00:00" -> "09:00". The API sends a TimeSpan through `.ToString()`. */
function shortTime(value: string): string {
  const [hours, minutes] = value.split(':')
  return hours && minutes ? `${hours}:${minutes}` : value
}

/**
 * The class' weekly periods.
 *
 * A 404 here means "nothing is scheduled", not "no such class" -- the procedure returns
 * no rows in both cases and the controller cannot tell them apart. Since the page around
 * this has already loaded the class successfully, an empty state is the honest reading;
 * anything else would tell the user their class does not exist while its name is on the
 * screen above.
 */
export function ClassTimetableView({ classId }: { classId: number }) {
  const { data, isLoading, error } = useGetClassTimetableQuery({ classId })

  if (isLoading) return <FullPageLoader label="Loading the timetable…" />

  const notFound =
    error !== undefined && typeof error === 'object' && 'status' in error && error.status === 404

  if (error && !notFound) {
    return <ErrorState error={error} title="Could not load the timetable" />
  }

  const days = data?.timetable ?? []

  if (days.length === 0) {
    return (
      <Paper variant="outlined">
        <EmptyState
          title="No periods scheduled"
          description="Periods added in the timetable module will appear here. Suspending a class also clears its schedule."
        />
      </Paper>
    )
  }

  // The API groups by whatever days have periods, in no guaranteed order.
  const ordered = [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      }}
    >
      {ordered.map((day) => (
        <Paper key={day.dayOfWeek} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
            {day.dayName ||
              DAYS_OF_WEEK.find((entry) => entry.value === day.dayOfWeek)?.label ||
              `Day ${day.dayOfWeek}`}
          </Typography>

          <Stack spacing={1.5}>
            {day.periods.map((period, index) => (
              <Box
                key={`${period.startTime}-${index}`}
                sx={{ pl: 1.5, borderLeft: '3px solid', borderColor: 'primary.light' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {period.subjectName}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {shortTime(period.startTime)}–{shortTime(period.endTime)} · {period.teacherName}
                </Typography>
                {period.room && <Chip size="small" label={period.room} sx={{ mt: 0.5 }} />}
              </Box>
            ))}
          </Stack>
        </Paper>
      ))}
    </Box>
  )
}
