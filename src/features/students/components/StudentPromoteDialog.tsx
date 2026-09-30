import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import type { SelectOption } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { classLabel, isClassFull, useClassLookup } from '@/features/classes/classLookup'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { usePromoteStudentMutation } from '../studentsApi'
import type { StudentRow } from '../types'

/**
 * Mirrors StudentPromoteDTO. The year range is the procedure's own check, which exists so
 * that a mistyped 202 or 20266 is refused with a sentence rather than stored.
 */
const schema = z.object({
  newClassId: z.union([z.string(), z.number(), z.null()]).default(null),
  academicYear: z.coerce
    .number({ error: 'Academic year is required' })
    .int('Academic year must be a whole number')
    .min(2000, 'Academic year must be between 2000 and 2100')
    .max(2100, 'Academic year must be between 2000 and 2100'),
})

type PromoteForm = z.input<typeof schema>

const FIELDS = ['newClassId', 'academicYear'] as const

interface StudentPromoteDialogProps {
  open: boolean
  student: StudentRow | null
  onClose: () => void
}

/**
 * Moving a student to another class.
 *
 * It is a separate dialog from the edit form, and says more than "pick a class", because
 * the server does three things here and two of them are not obvious:
 *
 *  1. The roll number is reallocated from the *target* class's counter -- roll numbers are
 *     unique per class, so the student cannot keep theirs.
 *  2. Subject enrolments belonging to a different grade are dropped, and the new grade's
 *     subjects are **not** assigned in their place. Someone has to do that afterwards.
 *  3. The academic year is written to the audit trail only; there is no promotion-history
 *     table, so it is not queryable from any screen.
 */
export function StudentPromoteDialog({ open, student, onClose }: StudentPromoteDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [promoteStudent, { isLoading: promoting }] = usePromoteStudentMutation()
  const { classes, isLoading: loadingClasses, hasMore } = useClassLookup({ skip: !open })

  const { control, handleSubmit, reset, setError } = useForm<PromoteForm>({
    resolver: zodResolver(schema),
    defaultValues: { newClassId: null, academicYear: new Date().getFullYear() },
  })

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset({ newClassId: null, academicYear: new Date().getFullYear() })
  }, [open, reset])

  // The class the student is already in is left out rather than disabled: the server
  // refuses it ("Student is already in 10-A"), and it is not a choice anyone means to make.
  const targets = classes.filter((row) => row.id !== student?.classId)

  const classOptions: SelectOption[] = targets.map((row) => ({
    value: row.id,
    label: isClassFull(row)
      ? `${classLabel(row)} — full, ${row.totalStudents}/${row.maxStudents}`
      : `${classLabel(row)} — ${row.totalStudents}/${row.maxStudents}`,
    disabled: isClassFull(row),
  }))

  const selectedId = useWatch({ control, name: 'newClassId' })
  const selected = targets.find((row) => row.id === Number(selectedId))
  const current = classes.find((row) => row.id === student?.classId)

  const onSubmit = handleSubmit(async (values) => {
    if (!student) return
    setFormError(null)

    if (values.newClassId === null || values.newClassId === '') {
      setError('newClassId', { type: 'manual', message: 'Choose the class to promote into' })
      return
    }

    try {
      await promoteStudent({
        studentId: student.id,
        body: {
          newClassId: Number(values.newClassId),
          academicYear: Number(values.academicYear),
        },
      }).unwrap()

      dispatch(
        toastSuccess(
          `${student.firstName} ${student.lastName} promoted to ${
            selected?.className ?? 'the new class'
          }. A new roll number has been allocated.`,
        ),
      )
      onClose()
    } catch (error) {
      // "Class is full", "Student is already in 10-A" and "Class not found in this school"
      // all arrive here.
      const unassigned = applyServerErrors<PromoteForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not promote the student.'))
    }
  })

  // Whether the move crosses grades decides how much of the student's subject list survives.
  // Unknown when the current class is not in the fetched page, so the warning is worded for
  // the worse case rather than promising nothing will be dropped.
  const keepsGrade = Boolean(selected && current && selected.grade === current.grade)

  return (
    <FormDialog
      open={open}
      title={student ? `Promote ${student.firstName} ${student.lastName}` : 'Promote student'}
      description={
        <Typography variant="body2" color="text.secondary">
          Currently in {student?.className ?? 'no class'}
          {student?.rollNumber ? `, roll ${student.rollNumber}` : ''}.
        </Typography>
      }
      error={formError}
      submitLabel="Promote"
      busy={promoting}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFSelect
        name="newClassId"
        control={control}
        label="Promote into"
        options={classOptions}
        required
        loadingOptions={loadingClasses}
        hint={
          classOptions.length === 0 && !loadingClasses
            ? 'No other active class to move into'
            : hasMore
              ? 'Showing the first 100 active classes'
              : 'Classes at capacity cannot be selected'
        }
      />

      <RHFTextField
        name="academicYear"
        control={control}
        label="Academic year"
        type="number"
        numeric
        required
        slotProps={{ htmlInput: { min: 2000, max: 2100 } }}
        hint="Recorded in the audit trail, so the move can be explained later"
      />

      <Alert severity="warning">
        <AlertTitle>Two things change besides the class</AlertTitle>
        The student is given a <strong>new roll number</strong> from{' '}
        {selected?.className ?? 'the target class'}, because roll numbers are unique within a
        class — anything printed with the old one is out of date.
        {keepsGrade ? (
          <>
            {' '}
            Their subject enrolments are for grade {selected?.grade} too, so those stay as they
            are.
          </>
        ) : (
          <>
            {' '}
            Subject enrolments for any other grade are <strong>dropped</strong>, and
            {selected ? ` grade ${selected.grade} ` : ' the new grade’s '}
            subjects are not assigned in their place. Assign them from the student&apos;s
            profile afterwards.
          </>
        )}
      </Alert>

      <Typography variant="caption" color="text.secondary">
        Attendance, results and fees already recorded stay with the student and are not moved
        or recalculated.
      </Typography>
    </FormDialog>
  )
}
