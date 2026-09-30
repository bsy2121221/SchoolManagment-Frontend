import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan, useCurrentUser, useModulePermissions } from '@/features/auth/permissions'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { useTeacherLookup } from '@/features/teachers/teacherLookup'
import { useGetMyTeacherProfileQuery } from '@/features/teachers/teachersApi'
import { getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { ROLES } from '@/types/enums'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { ClassTimetable } from '../components/ClassTimetable'
import { ScheduleEntryDialog } from '../components/ScheduleEntryDialog'
import type { ScheduleEntryDefaults } from '../components/ScheduleEntryDialog'
import { TeacherTimetable } from '../components/TeacherTimetable'
import { dayLabel, timeRange } from '../scheduleRules'
import { useDeleteScheduleEntryMutation } from '../scheduleApi'
import type { EditableEntry } from '../types'

type View = 'teacher' | 'class'

function positiveId(value: string | null): number | null {
  const id = Number(value)
  return value && Number.isInteger(id) && id > 0 ? id : null
}

/**
 * `/schedule` — the timetable, by teacher or by class.
 *
 * The view and the chosen teacher or class are in the URL (`?view=class&classId=7`), so a
 * link to "10-A's timetable" is a link to it.
 *
 * **Who sees what.** Every read is AdminOrTeacher (see ScheduleController):
 * - An Admin or SuperAdmin picks any teacher or class, and — holding the matching
 *   `Schedule` permission — adds, edits and removes lessons.
 * - A Teacher sees their own week (resolved through `GET /teachers/my-profile`, since the
 *   token carries a user id and the schedule is keyed on `Teachers.Id`) and any class's week.
 *   They cannot write: every write is AdminOnly whatever the permission grid says, so the
 *   buttons are gated on the role as well as the permission.
 * - Students and Parents hold `Schedule:View` in the seeded grid but are refused by every
 *   endpoint, so the route does not admit them (§7.50).
 */
export default function SchedulePage() {
  const dispatch = useAppDispatch()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'class' ? 'class' : 'teacher'
  const pickedTeacherId = positiveId(params.get('teacherId'))
  const classId = positiveId(params.get('classId'))

  const role = useCurrentUser()?.role
  const isAdmin = role === ROLES.Admin || role === ROLES.SuperAdmin
  const isTeacher = role === ROLES.Teacher

  const permissions = useModulePermissions('Schedule')
  const canCreate = isAdmin && permissions.canCreate
  const canEdit = isAdmin && permissions.canEdit
  const canDelete = isAdmin && permissions.canDelete
  const canViewTeachers = useCan('Teachers', 'View')
  const canViewClasses = useCan('Classes', 'View')

  const myProfile = useGetMyTeacherProfileQuery(undefined, { skip: !isTeacher })
  const teachers = useTeacherLookup({ skip: isTeacher || !canViewTeachers })
  const classes = useClassLookup({ skip: view !== 'class' || !canViewClasses })

  const teacherId = isTeacher ? (myProfile.data?.id ?? null) : pickedTeacherId

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EditableEntry | null>(null)
  const [defaults, setDefaults] = useState<ScheduleEntryDefaults | undefined>(undefined)
  const [deleting, setDeleting] = useState<EditableEntry | null>(null)

  const [deleteEntry, { isLoading: deletingBusy }] = useDeleteScheduleEntryMutation()

  const openAdd = (dayOfWeek?: number) => {
    setEditing(null)
    setDefaults({
      teacherId: view === 'teacher' ? (teacherId ?? undefined) : undefined,
      classId: view === 'class' ? (classId ?? undefined) : undefined,
      dayOfWeek,
    })
    setDialogOpen(true)
  }
  const openEdit = (entry: EditableEntry) => {
    setEditing(entry)
    setDefaults(undefined)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteEntry(deleting.id).unwrap()
      dispatch(toastSuccess(`${deleting.subjectName} for ${deleting.className} removed.`))
    } catch (caught) {
      dispatch(
        toastError(
          getErrorStatus(caught) === 404
            ? 'That lesson had already been removed.'
            : getErrorMessage(caught, 'Could not remove the lesson.'),
        ),
      )
    } finally {
      setDeleting(null)
    }
  }

  const setParam = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === null) merged.delete(key)
      else merged.set(key, value)
    }
    setParams(merged, { replace: true })
  }

  const actions = {
    onEdit: canEdit ? openEdit : undefined,
    onDelete: canDelete ? setDeleting : undefined,
  }

  const teacherBody = () => {
    if (isTeacher) {
      if (myProfile.isLoading) return <FullPageLoader label="Finding your timetable…" />
      if (myProfile.error) {
        return getErrorStatus(myProfile.error) === 404 ? (
          <Alert severity="warning">
            Your account is not linked to a teacher record, so there is no timetable to show. Ask
            the school administrator to check your teacher profile.
          </Alert>
        ) : (
          <ErrorState error={myProfile.error} onRetry={() => void myProfile.refetch()} />
        )
      }
    }
    if (!isTeacher && !canViewTeachers) {
      return (
        <Alert severity="info">
          Choosing a teacher needs permission to view teachers. Class timetables are under “By
          class”.
        </Alert>
      )
    }
    if (teacherId === null) {
      return (
        <Paper variant="outlined">
          <EmptyState
            title="Choose a teacher"
            description="Their week, what they are teaching now and next, and how much of it there is."
          />
        </Paper>
      )
    }
    return (
      <TeacherTimetable
        key={teacherId}
        teacherId={teacherId}
        onAdd={canCreate ? openAdd : undefined}
        {...actions}
      />
    )
  }

  const classBody = () => {
    if (!canViewClasses) {
      return <Alert severity="info">Choosing a class needs permission to view classes.</Alert>
    }
    if (classId === null) {
      return (
        <Paper variant="outlined">
          <EmptyState title="Choose a class" description="Every lesson the class has in a week." />
        </Paper>
      )
    }
    return (
      <ClassTimetable
        classId={classId}
        onAdd={canCreate ? () => openAdd() : undefined}
        {...actions}
      />
    )
  }

  const pickedTeacherMissing =
    !isTeacher &&
    pickedTeacherId !== null &&
    !teachers.isLoading &&
    teachers.teachers.length > 0 &&
    !teachers.teachers.some((row) => row.id === pickedTeacherId)
  const pickedClassMissing =
    classId !== null &&
    !classes.isLoading &&
    classes.classes.length > 0 &&
    !classes.classes.some((row) => row.id === classId)

  return (
    <Box>
      <PageHeader
        title="Timetable"
        subtitle={isTeacher ? 'Your week, and any class’s' : 'Who teaches what, where and when'}
        actions={
          canCreate ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openAdd()}>
              Add a lesson
            </Button>
          ) : undefined
        }
      />

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={view}
          onChange={(_event, value: View) => setParam({ view: value === 'teacher' ? null : value })}
        >
          <Tab value="teacher" label={isTeacher ? 'My timetable' : 'By teacher'} />
          <Tab value="class" label="By class" />
        </Tabs>
      </Paper>

      {view === 'teacher' && !isTeacher && canViewTeachers && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="Teacher"
            value={pickedTeacherId ?? ''}
            onChange={(event) => setParam({ teacherId: event.target.value || null })}
            disabled={teachers.isLoading}
            helperText={teachers.isLoading ? 'Loading…' : undefined}
            sx={{ minWidth: 320 }}
          >
            {teachers.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      {view === 'class' && canViewClasses && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="Class"
            value={classId ?? ''}
            onChange={(event) => setParam({ classId: event.target.value || null })}
            disabled={classes.isLoading}
            helperText={
              classes.isLoading
                ? 'Loading…'
                : classes.hasMore
                  ? 'Showing the first 100 active classes'
                  : undefined
            }
            sx={{ minWidth: 320 }}
          >
            {classes.classes.map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {classLabel(row)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      {view === 'teacher' && pickedTeacherMissing && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The teacher in this link is not an active teacher in this school.
        </Alert>
      )}
      {view === 'class' && pickedClassMissing && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The class in this link is not an active class in this school.
        </Alert>
      )}

      {view === 'teacher' ? teacherBody() : classBody()}

      <ScheduleEntryDialog
        open={dialogOpen}
        editing={editing}
        defaults={defaults}
        onClose={() => setDialogOpen(false)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Remove this lesson?"
        message={
          deleting
            ? `${deleting.subjectName} for ${deleting.className}, ${dayLabel(deleting.dayOfWeek)} ${timeRange(deleting.startTime, deleting.endTime)}, comes off the timetable and frees the slot.`
            : ''
        }
        confirmLabel="Remove lesson"
        destructive
        busy={deletingBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Box>
  )
}
