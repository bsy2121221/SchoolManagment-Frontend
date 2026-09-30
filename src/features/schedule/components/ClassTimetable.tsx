import AddIcon from '@mui/icons-material/Add'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { useGetClassScheduleQuery } from '../scheduleApi'
import type { ClassScheduleEntry } from '../types'
import { WeekGrid } from './WeekGrid'
import type { GridLesson, LessonActions } from './WeekGrid'

function toLesson(row: ClassScheduleEntry): GridLesson {
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
    detail: row.teacherName,
    room: row.room,
  }
}

/**
 * One class's week, from `GET /api/Schedule/class/{id}`.
 *
 * The Classes feature has its own read-only timetable tab over `GET /classes/{id}/timetable`,
 * which groups by day on the server and carries no ids; this one is flat and carries every id,
 * which is what editing needs. Both provide the `Schedule` LIST tag, so a change made here
 * shows there.
 */
export function ClassTimetable({
  classId,
  onAdd,
  onEdit,
  onDelete,
}: { classId: number; onAdd?: () => void } & LessonActions) {
  const { data, isLoading, error, refetch } = useGetClassScheduleQuery({ classId })

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
          description="This class has nothing on the timetable yet."
          action={
            onAdd ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
                Add a lesson
              </Button>
            ) : undefined
          }
        />
      </Paper>
    )
  }

  return <WeekGrid lessons={lessons} onEdit={onEdit} onDelete={onDelete} />
}
