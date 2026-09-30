import AddIcon from '@mui/icons-material/Add'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { DAYS_OF_WEEK } from '@/types/enums'
import { dayLabel, timeToMinutes, todayDayOfWeek } from '../scheduleRules'
import { useGetTeacherScheduleByDayQuery, useGetTeacherScheduleQuery } from '../scheduleApi'
import type { TeacherScheduleEntry } from '../types'
import { CurrentNextPanel } from './CurrentNextPanel'
import { TeacherScheduleStatCards } from './TeacherScheduleStatCards'
import { LessonCard, WeekGrid } from './WeekGrid'
import type { GridLesson, LessonActions } from './WeekGrid'

function toLesson(row: TeacherScheduleEntry): GridLesson {
  return {
    entry: {
      id: row.id,
      teacherId: row.teacherId,
      subjectId: row.subjectId,
      classId: row.classId,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      room: row.room,
      subjectName: row.subjectName,
      className: row.className,
    },
    title: row.subjectName,
    detail: row.className,
    room: row.room,
  }
}

interface TeacherTimetableProps extends LessonActions {
  teacherId: number
  /** Opens the add dialog, optionally on a given day. Absent for a read-only viewer. */
  onAdd?: (dayOfWeek?: number) => void
}

function DayView({ teacherId, onAdd, onEdit, onDelete }: TeacherTimetableProps) {
  const [day, setDay] = useState(todayDayOfWeek)
  const { data, isLoading, isFetching, error, refetch } = useGetTeacherScheduleByDayQuery({
    teacherId,
    dayOfWeek: day,
  })

  const lessons = [...(data ?? [])]
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    .map(toLesson)

  return (
    <Paper variant="outlined">
      <Tabs
        value={day}
        onChange={(_event, value: number) => setDay(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {DAYS_OF_WEEK.map((item) => (
          <Tab
            key={item.value}
            value={item.value}
            label={item.value === todayDayOfWeek() ? `${item.short} · today` : item.short}
          />
        ))}
      </Tabs>

      {isLoading || (isFetching && !data) ? (
        <FullPageLoader label={`Loading ${dayLabel(day)}…`} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the day" />
      ) : lessons.length === 0 ? (
        <EmptyState
          title={`Nothing on ${dayLabel(day)}`}
          description="No lessons are scheduled for this teacher on this day."
          action={
            onAdd ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => onAdd(day)}>
                Add a lesson
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stack spacing={1.5} sx={{ p: 2 }}>
          {lessons.map((lesson) => (
            <LessonCard key={lesson.entry.id} lesson={lesson} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </Stack>
      )}
    </Paper>
  )
}

/**
 * One teacher's timetable: headline figures, what they are teaching now and next, and the
 * week — as columns, or one day at a time.
 *
 * The day view reads `GET teacher/{id}/day/{day}` rather than filtering the week, so it is
 * what the endpoint says rather than a second opinion computed here; both share the teacher's
 * cache tag, so an edit refreshes whichever is showing.
 *
 * An unknown teacher id and a teacher with no lessons are the same empty list from the API;
 * the page around this only offers teachers that exist.
 */
export function TeacherTimetable({ teacherId, onAdd, onEdit, onDelete }: TeacherTimetableProps) {
  const [mode, setMode] = useState<'week' | 'day'>('week')
  const { data, isLoading, error, refetch } = useGetTeacherScheduleQuery(teacherId)

  if (isLoading) return <FullPageLoader label="Loading the timetable…" />
  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the timetable" />
  }

  const lessons = (data ?? []).map(toLesson)

  if (lessons.length === 0) {
    return (
      <Paper variant="outlined">
        <EmptyState
          title="No lessons scheduled"
          description="This teacher has nothing on the timetable yet."
          action={
            onAdd ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => onAdd()}>
                Add a lesson
              </Button>
            ) : undefined
          }
        />
      </Paper>
    )
  }

  return (
    <Stack spacing={2}>
      <TeacherScheduleStatCards teacherId={teacherId} />
      <CurrentNextPanel teacherId={teacherId} />

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {mode === 'week' ? 'The week' : 'By day'}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_event, value: 'week' | 'day' | null) => {
            if (value) setMode(value)
          }}
          aria-label="Timetable layout"
        >
          <ToggleButton value="week">Week</ToggleButton>
          <ToggleButton value="day">Day</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {mode === 'week' ? (
        <WeekGrid lessons={lessons} onEdit={onEdit} onDelete={onDelete} />
      ) : (
        <DayView teacherId={teacherId} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
      )}
    </Stack>
  )
}
