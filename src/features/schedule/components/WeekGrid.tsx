import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { DAYS_OF_WEEK } from '@/types/enums'
import { timeRange, timeToMinutes, todayDayOfWeek, visibleDays } from '../scheduleRules'
import type { EditableEntry } from '../types'

/**
 * One lesson as either timetable draws it. `detail` is what the view is *not* keyed on:
 * the class in a teacher's week, the teacher in a class's week.
 */
export interface GridLesson {
  entry: EditableEntry
  title: string
  detail: string
  room: string | null
}

export interface LessonActions {
  onEdit?: (entry: EditableEntry) => void
  onDelete?: (entry: EditableEntry) => void
}

function byStart(a: GridLesson, b: GridLesson): number {
  return timeToMinutes(a.entry.startTime) - timeToMinutes(b.entry.startTime)
}

export function LessonCard({
  lesson,
  onEdit,
  onDelete,
  showDay = false,
}: { lesson: GridLesson; showDay?: boolean } & LessonActions) {
  const { entry } = lesson
  const day = DAYS_OF_WEEK.find((item) => item.value === entry.dayOfWeek)

  return (
    <Box
      sx={{
        pl: 1.5,
        pr: 0.5,
        py: 0.5,
        borderLeft: '3px solid',
        borderColor: 'primary.light',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {lesson.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {showDay && day ? `${day.short} ` : ''}
          {timeRange(entry.startTime, entry.endTime)} · {lesson.detail}
        </Typography>
        {lesson.room && <Chip size="small" label={lesson.room} sx={{ mt: 0.5 }} />}
      </Box>
      {(onEdit || onDelete) && (
        <Stack direction="row" sx={{ flexShrink: 0, displayPrint: 'none' }}>
          {onEdit && (
            <Tooltip title="Edit this lesson">
              <IconButton
                size="small"
                aria-label={`Edit ${lesson.title} at ${timeRange(entry.startTime, entry.endTime)}`}
                onClick={() => onEdit(entry)}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Remove this lesson">
              <IconButton
                size="small"
                aria-label={`Remove ${lesson.title} at ${timeRange(entry.startTime, entry.endTime)}`}
                onClick={() => onDelete(entry)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
    </Box>
  )
}

/**
 * A week of lessons, one column per day, each column in start-time order.
 *
 * Columns rather than a time-slot grid on purpose: the API has no notion of periods, so
 * lessons start whenever they were entered (09:00, 09:50, 10:05), and a slot grid would have
 * to invent a resolution and then draw most lessons straddling two rows. A column per day
 * reads the same way a printed timetable does and never misplaces anything.
 *
 * Saturday and Sunday appear only when something is taught on them; today's column is
 * outlined.
 */
export function WeekGrid({ lessons, onEdit, onDelete }: { lessons: GridLesson[] } & LessonActions) {
  const days = visibleDays(lessons.map((lesson) => lesson.entry.dayOfWeek))
  const today = todayDayOfWeek()

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: `repeat(${Math.min(days.length, 4)}, 1fr)`,
          lg: `repeat(${days.length}, minmax(0, 1fr))`,
        },
      }}
    >
      {days.map((dayOfWeek) => {
        const day = DAYS_OF_WEEK.find((item) => item.value === dayOfWeek)
        const dayLessons = lessons.filter((lesson) => lesson.entry.dayOfWeek === dayOfWeek).sort(byStart)
        const isToday = dayOfWeek === today

        return (
          <Paper
            key={dayOfWeek}
            variant="outlined"
            sx={{ p: 1.5, borderColor: isToday ? 'primary.main' : undefined }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {day?.label ?? `Day ${dayOfWeek}`}
              </Typography>
              {isToday && <Chip size="small" color="primary" variant="outlined" label="Today" />}
            </Stack>

            {dayLessons.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Nothing scheduled
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {dayLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.entry.id}
                    lesson={lesson}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </Stack>
            )}
          </Paper>
        )
      })}
    </Box>
  )
}
