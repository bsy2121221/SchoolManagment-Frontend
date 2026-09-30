import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { useCan } from '@/features/auth/permissions'
import { useTeacherLookup } from '@/features/teachers/teacherLookup'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useCreateClassMutation, useUpdateClassMutation } from '../classesApi'
import type { ClassRow } from '../types'

/**
 * Mirrors ClassCreateDTO / ClassUpdateDTO, which carry the same DataAnnotations.
 *
 * The lengths are the server's: exceeding them would be rejected after a round trip, and
 * the max-length attributes on the inputs mean the user cannot get there in the first
 * place. `maxStudents` is `[Range(1, 200)]`.
 */
const schema = z.object({
  className: z
    .string()
    .trim()
    .min(1, 'Class name is required')
    .max(50, 'Class name cannot exceed 50 characters'),
  grade: z.string().trim().min(1, 'Grade is required').max(10, 'Grade cannot exceed 10 characters'),
  section: z
    .string()
    .trim()
    .min(1, 'Section is required')
    .max(5, 'Section cannot exceed 5 characters'),
  // The select hands back a string id or null; coerced before it is sent.
  classTeacherId: z.union([z.string(), z.number(), z.null()]).default(null),
  maxStudents: z.coerce
    .number({ error: 'Capacity is required' })
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(200, 'Capacity cannot exceed 200'),
})

type ClassForm = z.input<typeof schema>

const FIELDS = ['className', 'grade', 'section', 'classTeacherId', 'maxStudents'] as const

const EMPTY: ClassForm = {
  className: '',
  grade: '',
  section: '',
  classTeacherId: null,
  maxStudents: 50,
}

interface ClassFormDialogProps {
  open: boolean
  /** The class being edited, or null to create one. */
  editing: ClassRow | null
  onClose: () => void
  /** Called after a successful create, with the new id -- lets the caller navigate. */
  onCreated?: (classId: number) => void
}

export function ClassFormDialog({ open, editing, onClose, onCreated }: ClassFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [createClass, { isLoading: creating }] = useCreateClassMutation()
  const [updateClass, { isLoading: updating }] = useUpdateClassMutation()

  // A class teacher is optional, and assigning one needs Teachers:View -- the endpoint
  // is Admin/Teacher-only. Skipping the query rather than letting it 403 keeps a
  // permission we expect to be missing out of the console.
  const canViewTeachers = useCan('Teachers', 'View')
  const { options: teacherOptions, isLoading: loadingTeachers } = useTeacherLookup({
    skip: !open || !canViewTeachers,
  })

  const { control, handleSubmit, reset, setError, watch, setValue } = useForm<ClassForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Reopening for a different row has to re-seed the fields; RHF keeps its values
  // otherwise, and the dialog would open on the previously edited class.
  useEffect(() => {
    if (!open) return
    setFormError(null)
    reset(
      editing
        ? {
            className: editing.className,
            grade: editing.grade,
            section: editing.section,
            classTeacherId: editing.classTeacherId,
            maxStudents: editing.maxStudents,
          }
        : EMPTY,
    )
  }, [open, editing, reset])

  /**
   * Suggest "10-A" from grade and section, the convention every seeded class follows.
   * Only while creating, and only while the name still matches the suggestion -- a name
   * the user has typed is theirs, not ours to overwrite.
   */
  const grade = watch('grade')
  const section = watch('section')
  const className = watch('className')
  useEffect(() => {
    if (editing) return
    const suggestion = grade && section ? `${grade}-${section}` : grade || ''
    const previous = grade && section ? `${grade}-${section}` : ''
    if (className === '' || className === previous || `${grade}-` === className) {
      if (suggestion !== className) setValue('className', suggestion)
    }
    // Intentionally keyed on grade/section only: including className would re-run on
    // every keystroke in the name field and fight the user for it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, section, editing])

  const busy = creating || updating

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const payload = {
      className: values.className.trim(),
      grade: values.grade.trim(),
      section: values.section.trim(),
      // '' and null both mean "no class teacher"; the API wants null for an unset int?.
      classTeacherId:
        values.classTeacherId === null || values.classTeacherId === ''
          ? null
          : Number(values.classTeacherId),
      maxStudents: Number(values.maxStudents),
    }

    try {
      if (editing) {
        await updateClass({ classId: editing.id, body: payload }).unwrap()
        dispatch(toastSuccess(`${payload.className} updated.`))
      } else {
        const { classId } = await createClass(payload).unwrap()
        dispatch(toastSuccess(`${payload.className} created.`))
        onCreated?.(classId)
      }
      onClose()
    } catch (error) {
      // The duplicate grade-and-section refusal arrives here. It is worth reading: the
      // check is not filtered on IsActive, so a *deleted* class can be holding 10-A and
      // nothing in the list would explain the rejection.
      const unassigned = applyServerErrors<ClassForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save the class.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.className}` : 'Add a class'}
      description={
        <Typography variant="body2" color="text.secondary">
          A class is identified by its grade and section — only one class may hold each
          pairing.
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Create class'}
      busy={busy}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="grade"
        control={control}
        label="Grade"
        required
        autoFocus
        slotProps={{ htmlInput: { maxLength: 10 } }}
        hint="For example 10, or Nursery"
      />

      <RHFTextField
        name="section"
        control={control}
        label="Section"
        required
        slotProps={{ htmlInput: { maxLength: 5 } }}
        hint="A single letter is conventional"
      />

      <RHFTextField
        name="className"
        control={control}
        label="Class name"
        required
        slotProps={{ htmlInput: { maxLength: 50 } }}
        hint="Suggested from grade and section; edit it if you like"
      />

      <RHFTextField
        name="maxStudents"
        control={control}
        label="Capacity"
        type="number"
        numeric
        required
        slotProps={{ htmlInput: { min: 1, max: 200 } }}
        hint="Between 1 and 200 students"
      />

      {canViewTeachers ? (
        <RHFSelect
          name="classTeacherId"
          control={control}
          label="Class teacher"
          options={teacherOptions}
          allowEmpty
          emptyLabel="Not assigned"
          loadingOptions={loadingTeachers}
          hint={
            teacherOptions.length === 0 && !loadingTeachers
              ? 'No teachers have been added yet'
              : 'Optional'
          }
        />
      ) : (
        <Typography variant="caption" color="text.secondary">
          Assigning a class teacher needs permission to view teachers.
        </Typography>
      )}
    </FormDialog>
  )
}
