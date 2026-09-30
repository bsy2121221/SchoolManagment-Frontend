import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { getErrorMessage } from '@/lib/serverErrors'
import { dayLabel, timeRange, todayDayOfWeek } from '../scheduleRules'
import { useGetTeacherCurrentNextQuery } from '../scheduleApi'
import type { CurrentNextLesson } from '../types'

/** Once a minute: the answer changes with the clock, not with any write this app makes. */
const POLL_MS = 60_000

function LessonSlot({
  heading,
  lesson,
  emptyText,
}: {
  heading: string
  lesson: CurrentNextLesson | null
  emptyText: string
}) {
  const laterDay = lesson !== null && lesson.dayOfWeek !== todayDayOfWeek()

  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
      <Typography variant="overline" color="text.secondary">
        {heading}
      </Typography>
      {lesson ? (
        <>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {lesson.subjectName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {laterDay ? `${dayLabel(lesson.dayOfWeek)} ` : ''}
            {timeRange(lesson.startTime, lesson.endTime)} · {lesson.className}
          </Typography>
          {lesson.room && <Chip size="small" label={lesson.room} sx={{ mt: 1 }} />}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {emptyText}
        </Typography>
      )}
    </Paper>
  )
}

/**
 * "Now" and "next" for one teacher.
 *
 * Both are computed by the database from *its* clock and time zone, not the browser's
 * (`GETDATE()` in the procedure), so a school whose server runs in another zone would see
 * the wrong lesson here. The panel says so only in the doc — there is no zone setting
 * anywhere in the API to reconcile it against.
 *
 * "Next" wraps into next week, so it is empty only for a teacher with no lessons at all.
 */
export function CurrentNextPanel({ teacherId }: { teacherId: number }) {
  const { data, isLoading, error } = useGetTeacherCurrentNextQuery(teacherId, {
    pollingInterval: POLL_MS,
    skipPollingIfUnfocused: true,
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Skeleton variant="rounded" height={104} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={104} sx={{ flex: 1 }} />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="warning">
        Could not load the current lesson: {getErrorMessage(error)}
      </Alert>
    )
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
      <LessonSlot heading="Now" lesson={data?.currentClass ?? null} emptyText="No lesson right now." />
      <LessonSlot
        heading="Next"
        lesson={data?.nextClass ?? null}
        emptyText="Nothing else on the timetable."
      />
    </Box>
  )
}
