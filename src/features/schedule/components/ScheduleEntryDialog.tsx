import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import type { SelectOption } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { useCan } from '@/features/auth/permissions'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { useGetSubjectsByGradeQuery } from '@/features/subjects/subjectsApi'
import { useTeacherLookup } from '@/features/teachers/teacherLookup'
import { useGetTeacherSubjectsQuery } from '@/features/teachers/teachersApi'
import { applyServerErrors, getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { DAYS_OF_WEEK } from '@/types/enums'
import { toastSuccess } from '@/ui/uiSlice'
import {
  useCreateScheduleEntryMutation,
  useGetClassScheduleQuery,
  useGetTeacherScheduleQuery,
  useUpdateScheduleEntryMutation,
} from '../scheduleApi'
import { dateToTime, dayLabel, overlaps, SCHEDULE_LIMITS, timeRange, timeToDate } from '../scheduleRules'
import type { EditableEntry, ScheduleEntryPayload } from '../types'

const idField = z.union([z.string(), z.number(), z.null()])

const timeField = (message: string) =>
  z
    .date()
    .nullable()
    .refine((value) => value !== null && !Number.isNaN(value.getTime()), { message })

/** Mirrors ScheduleEntryCreateDTO, plus the end-after-start rule the controller checks. */
const schema = z
  .object({
    teacherId: idField,
    classId: idField,
    subjectId: idField,
    dayOfWeek: z.union([z.string(), z.number()]),
    startTime: timeField('Pick a start time'),
    endTime: timeField('Pick an end time'),
    room: z
      .string()
      .trim()
      .max(SCHEDULE_LIMITS.room, `Room cannot exceed ${SCHEDULE_LIMITS.room} characters`),
  })
  .refine(
    (values) =>
      !values.startTime ||
      !values.endTime ||
      dateToTime(values.endTime) > dateToTime(values.startTime),
    { path: ['endTime'], message: 'End time must be after start time' },
  )

type ScheduleForm = z.input<typeof schema>

const FIELDS = [
  'teacherId',
  'classId',
  'subjectId',
  'dayOfWeek',
  'startTime',
  'endTime',
  'room',
] as const

const DAY_OPTIONS: SelectOption[] = DAYS_OF_WEEK.map((day) => ({ value: day.value, label: day.label }))

/** What a new lesson starts from; either timetable fills in the teacher or class it shows. */
export interface ScheduleEntryDefaults {
  teacherId?: number
  classId?: number
  dayOfWeek?: number
}

interface ScheduleEntryDialogProps {
  open: boolean
  /** The lesson being edited, or null to add one. */
  editing: EditableEntry | null
  defaults?: ScheduleEntryDefaults
  onClose: () => void
}

function toId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Add or move one lesson.
 *
 * Every field is editable, including teacher and class: unlike an examination, a lesson has
 * an id, and `PUT /api/Schedule/{id}` rewrites the row in place.
 *
 * **Clashes are shown before saving.** The server refuses a lesson that overlaps another for
 * the same teacher, the same class or the same room, and names the one in the way. The first
 * two can be predicted here from the chosen teacher's week and the chosen class's week, which
 * are the same reads the timetables use, so the dialog lists them as soon as the day and
 * times are filled in. The room cannot: there is no read of "every lesson in room X", so a
 * room clash is learned from the server's 409. Save stays enabled regardless — the server is
 * the authority, and a preview built from cached lists can be a moment stale.
 *
 * **Subjects follow the class.** The procedure refuses a subject from another grade, so the
 * subject list is the chosen class's grade, as on the examination form.
 *
 * **Qualification is a warning, not a rule.** Nothing on the server checks the teacher is
 * assigned the subject in `TeacherSubjects`, and a cover lesson is a real thing, so the dialog
 * says when they are not and lets it through.
 */
export function ScheduleEntryDialog({ open, editing, defaults, onClose }: ScheduleEntryDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)
  const canViewTeachers = useCan('Teachers', 'View')

  const [createEntry, { isLoading: creating }] = useCreateScheduleEntryMutation()
  const [updateEntry, { isLoading: updating }] = useUpdateScheduleEntryMutation()

  const { control, handleSubmit, reset, setError, setValue } = useForm<ScheduleForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      teacherId: null,
      classId: null,
      subjectId: null,
      dayOfWeek: 1,
      startTime: null,
      endTime: null,
      room: '',
    },
  })

  // Re-seed on open rather than on close, so the exit transition does not repaint the form.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(
      editing
        ? {
            teacherId: editing.teacherId,
            classId: editing.classId,
            subjectId: editing.subjectId,
            dayOfWeek: editing.dayOfWeek,
            startTime: timeToDate(editing.startTime),
            endTime: timeToDate(editing.endTime),
            room: editing.room ?? '',
          }
        : {
            teacherId: defaults?.teacherId ?? null,
            classId: defaults?.classId ?? null,
            subjectId: null,
            dayOfWeek: defaults?.dayOfWeek ?? 1,
            startTime: null,
            endTime: null,
            room: '',
          },
    )
  }, [open, editing, defaults?.teacherId, defaults?.classId, defaults?.dayOfWeek, reset])

  const { options: teacherOptions, isLoading: loadingTeachers } = useTeacherLookup({
    skip: !open || !canViewTeachers,
  })
  const { classes, isLoading: loadingClasses, hasMore } = useClassLookup({ skip: !open })

  const [teacherValue, classValue, subjectValue, dayValue, startValue, endValue] = useWatch({
    control,
    name: ['teacherId', 'classId', 'subjectId', 'dayOfWeek', 'startTime', 'endTime'],
  })
  const teacherId = toId(teacherValue)
  const classId = toId(classValue)
  const subjectId = toId(subjectValue)
  const dayOfWeek = Number(dayValue)

  const selectedClass = classes.find((row) => row.id === classId) ?? null

  const subjects = useGetSubjectsByGradeQuery(selectedClass?.grade ?? '', {
    skip: !open || !selectedClass,
  })

  /**
   * Clear the subject once the list for the chosen class has loaded and does not contain it.
   *
   * Keyed on the loaded list rather than on "the class changed", so opening an existing lesson
   * keeps its subject (it is in its own grade's list) while moving it to a class of another
   * grade clears it — the procedure would refuse the pair anyway.
   */
  useEffect(() => {
    if (!open || subjectId === null || !subjects.data || subjects.isFetching) return
    if (!subjects.data.some((row) => row.id === subjectId)) setValue('subjectId', null)
  }, [open, subjectId, subjects.data, subjects.isFetching, setValue])

  const subjectOptions: SelectOption[] = (subjects.data ?? []).map((row) => ({
    value: row.id,
    label: row.subjectCode ? `${row.subjectName} (${row.subjectCode})` : row.subjectName,
  }))

  // The clash preview reads the same caches as the timetables behind the dialog.
  const teacherWeek = useGetTeacherScheduleQuery(teacherId ?? 0, { skip: !open || teacherId === null })
  const classWeek = useGetClassScheduleQuery({ classId: classId ?? 0 }, { skip: !open || classId === null })
  const qualified = useGetTeacherSubjectsQuery(teacherId ?? 0, {
    skip: !open || teacherId === null || !canViewTeachers,
  })

  const slot = useMemo(() => {
    if (!startValue || !endValue) return null
    if (Number.isNaN(startValue.getTime()) || Number.isNaN(endValue.getTime())) return null
    const startTime = dateToTime(startValue)
    const endTime = dateToTime(endValue)
    return endTime > startTime ? { startTime, endTime } : null
  }, [startValue, endValue])

  const clashes = useMemo(() => {
    if (!slot) return []
    const found: string[] = []
    const others = <T extends { id: number; dayOfWeek: number; startTime: string; endTime: string }>(
      rows: T[] | undefined,
    ) =>
      (rows ?? []).filter(
        (row) => row.id !== editing?.id && row.dayOfWeek === dayOfWeek && overlaps(row, slot),
      )

    for (const row of others(teacherWeek.data)) {
      found.push(
        `This teacher already teaches ${row.subjectName} to ${row.className}, ${timeRange(row.startTime, row.endTime)}`,
      )
    }
    for (const row of others(classWeek.data)) {
      // The same lesson can show up in both lists; say it once.
      if (row.teacherId === teacherId) continue
      found.push(
        `${row.className} already has ${row.subjectName} with ${row.teacherName}, ${timeRange(row.startTime, row.endTime)}`,
      )
    }
    return found
  }, [slot, dayOfWeek, teacherWeek.data, classWeek.data, editing?.id, teacherId])

  const unqualified =
    subjectId !== null &&
    qualified.data !== undefined &&
    !qualified.data.some((row) => row.id === subjectId)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const payloadTeacher = toId(values.teacherId)
    const payloadClass = toId(values.classId)
    const payloadSubject = toId(values.subjectId)
    if (payloadTeacher === null) {
      setError('teacherId', { type: 'manual', message: 'Choose who teaches it' })
      return
    }
    if (payloadClass === null) {
      setError('classId', { type: 'manual', message: 'Choose the class' })
      return
    }
    if (payloadSubject === null) {
      setError('subjectId', { type: 'manual', message: 'Choose the subject' })
      return
    }
    if (!values.startTime || !values.endTime) return

    const payload: ScheduleEntryPayload = {
      teacherId: payloadTeacher,
      classId: payloadClass,
      subjectId: payloadSubject,
      dayOfWeek: Number(values.dayOfWeek),
      startTime: dateToTime(values.startTime),
      endTime: dateToTime(values.endTime),
      room: values.room.trim() === '' ? null : values.room.trim(),
    }

    try {
      if (editing) {
        await updateEntry({ id: editing.id, body: payload }).unwrap()
      } else {
        await createEntry(payload).unwrap()
      }
      dispatch(
        toastSuccess(
          `${editing ? 'Lesson updated' : 'Lesson added'}: ${dayLabel(payload.dayOfWeek)} ${timeRange(payload.startTime, payload.endTime)}.`,
        ),
      )
      onClose()
    } catch (caught) {
      // 409: the server's message names the lesson in the way ("This teacher already teaches
      // Maths to 10-A on Monday 09:00-09:50"), which is exactly what the user needs to read.
      // 404: the lesson was removed while the dialog was open.
      if (getErrorStatus(caught) === 404) {
        setFormError('This lesson has been removed from the timetable since you opened it.')
        return
      }
      const unassigned = applyServerErrors<ScheduleForm>(caught, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(caught, 'Could not save the lesson.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.subjectName}, ${editing.className}` : 'Add a lesson'}
      description={
        <Typography variant="body2" color="text.secondary">
          A lesson is one weekly slot: a teacher, a class and a subject at the same time every
          week. A teacher, a class and a room can each be in only one lesson at a time.
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Add lesson'}
      busy={creating || updating}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      {canViewTeachers ? (
        <RHFSelect
          name="teacherId"
          control={control}
          label="Teacher"
          required
          options={teacherOptions}
          loadingOptions={loadingTeachers}
        />
      ) : (
        <Alert severity="warning">
          Choosing a teacher needs permission to view teachers, which this account does not have.
        </Alert>
      )}

      <RHFSelect
        name="classId"
        control={control}
        label="Class"
        required
        options={classes.map((row) => ({ value: row.id, label: classLabel(row) }))}
        loadingOptions={loadingClasses}
        hint={hasMore ? 'Showing the first 100 active classes; this school has more' : undefined}
      />

      <RHFSelect
        name="subjectId"
        control={control}
        label="Subject"
        required
        options={subjectOptions}
        loadingOptions={subjects.isLoading}
        disabled={!selectedClass}
        hint={
          selectedClass
            ? `Subjects taught in grade ${selectedClass.grade}`
            : 'Choose a class first — subjects are listed per grade'
        }
      />

      {unqualified && (
        <Alert severity="info">
          This subject is not among the ones assigned to this teacher. That is allowed — a cover
          lesson, say — but check it is intended.
        </Alert>
      )}

      <RHFSelect name="dayOfWeek" control={control} label="Day" required options={DAY_OPTIONS} />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Controller
          name="startTime"
          control={control}
          render={({ field, fieldState }) => (
            <TimePicker
              label="Starts"
              ampm={false}
              value={field.value ?? null}
              onChange={field.onChange}
              slotProps={{
                textField: {
                  required: true,
                  fullWidth: true,
                  error: Boolean(fieldState.error),
                  helperText: fieldState.error?.message,
                },
              }}
            />
          )}
        />
        <Controller
          name="endTime"
          control={control}
          render={({ field, fieldState }) => (
            <TimePicker
              label="Ends"
              ampm={false}
              value={field.value ?? null}
              onChange={field.onChange}
              slotProps={{
                textField: {
                  required: true,
                  fullWidth: true,
                  error: Boolean(fieldState.error),
                  helperText: fieldState.error?.message,
                },
              }}
            />
          )}
        />
      </Stack>

      <RHFTextField
        name="room"
        control={control}
        label="Room"
        fullWidth
        slotProps={{ htmlInput: { maxLength: SCHEDULE_LIMITS.room } }}
        hint="Optional. Room clashes are checked when you save."
      />

      {clashes.length > 0 && (
        <Alert severity="warning">
          <AlertTitle>This slot is taken on {dayLabel(dayOfWeek)}</AlertTitle>
          {clashes.map((line) => (
            <div key={line}>{line}</div>
          ))}
          Saving will be refused until the times, the day, the teacher or the class change.
        </Alert>
      )}
    </FormDialog>
  )
}
