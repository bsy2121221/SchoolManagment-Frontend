import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFSelect } from '@/components/form/RHFSelect'
import type { SelectOption } from '@/components/form/RHFSelect'
import { RHFTextField } from '@/components/form/RHFTextField'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { useGetSubjectsByGradeQuery } from '@/features/subjects/subjectsApi'
import { parseApiDate, toApiDate, today } from '@/lib/dates'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useSaveExaminationMutation } from '../examinationsApi'
import { EXAM_TYPES, MARK_LIMITS } from '../examinationRules'
import type { ExaminationRow } from '../types'

/**
 * Mirrors ExaminationCreateDTO's DataAnnotations, plus the one rule no attribute can express:
 * passing marks cannot exceed the maximum. That check is also in the controller, in
 * `sp_CreateOrUpdateExamination` and in `CK_Examinations_Marks` — four places, because it is
 * the one piece of arithmetic that makes an exam meaningless if it is wrong.
 */
const schema = z
  .object({
    examName: z
      .string()
      .trim()
      .min(1, 'Exam name is required')
      .max(100, 'Exam name cannot exceed 100 characters'),
    examType: z.string().trim().min(1, 'Choose an exam type'),
    classId: z.union([z.string(), z.number(), z.null()]).default(null),
    subjectId: z.union([z.string(), z.number(), z.null()]).default(null),
    examDate: z.date({ message: 'Pick the date of the exam' }),
    maxMarks: z
      .number({ message: 'Maximum marks is required' })
      .int('Marks are whole numbers')
      .min(MARK_LIMITS.maxMarks.min, `Maximum marks must be at least ${MARK_LIMITS.maxMarks.min}`)
      .max(MARK_LIMITS.maxMarks.max, `Maximum marks cannot exceed ${MARK_LIMITS.maxMarks.max}`),
    passingMarks: z
      .number({ message: 'Passing marks is required' })
      .int('Marks are whole numbers')
      .min(MARK_LIMITS.passingMarks.min, 'Passing marks cannot be negative')
      .max(
        MARK_LIMITS.passingMarks.max,
        `Passing marks cannot exceed ${MARK_LIMITS.passingMarks.max}`,
      ),
    // '' rather than null for the empty box, because RHFTextField's numeric mode hands back
    // '' when cleared and the payload converts at the edge.
    duration: z.union([z.literal(''), z.number().int().min(MARK_LIMITS.duration.min).max(MARK_LIMITS.duration.max)]),
  })
  .refine((values) => values.passingMarks <= values.maxMarks, {
    path: ['passingMarks'],
    message: 'Passing marks cannot exceed the maximum',
  })

type ExaminationForm = z.input<typeof schema>

const FIELDS = [
  'examName',
  'examType',
  'classId',
  'subjectId',
  'examDate',
  'maxMarks',
  'passingMarks',
  'duration',
] as const

const TYPE_OPTIONS: SelectOption[] = EXAM_TYPES.map((type) => ({ value: type, label: type }))

/** 100 out of 100 with a pass at 40 is what the seed uses, and a reasonable default. */
const EMPTY: ExaminationForm = {
  examName: '',
  examType: EXAM_TYPES[0],
  classId: null,
  subjectId: null,
  examDate: today(),
  maxMarks: 100,
  passingMarks: 40,
  duration: '',
}

interface ExaminationFormDialogProps {
  open: boolean
  /** The examination being edited, or null to create one. */
  editing: ExaminationRow | null
  onClose: () => void
}

/**
 * Create or reschedule an examination, over the single upsert endpoint.
 *
 * The shape of this dialog is dictated by one fact about that endpoint:
 * `sp_CreateOrUpdateExamination` matches on **(examName, examType, classId, subjectId)** and
 * never takes an id. So in edit mode those four fields are shown but not editable, because
 * changing any of them would not rename or move the exam — it would insert a second one and
 * leave the first standing with its marks attached. A form that let the user type a new name
 * into an "edit" dialog and then silently duplicated the exam would be the worst available
 * behaviour, so the fields are locked and the alert says what to do instead.
 *
 * The subject list is chained to the class: `GET /api/Subjects/by-grade/{grade}` is the picker
 * feed, and the grade comes from the chosen class. That also means choosing a different class
 * can invalidate the chosen subject, which is handled explicitly below.
 */
export function ExaminationFormDialog({ open, editing, onClose }: ExaminationFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [saveExamination, { isLoading: saving }] = useSaveExaminationMutation()

  const { control, handleSubmit, reset, setError, setValue } = useForm<ExaminationForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Re-seed on open rather than on close: resetting on close repaints the form during the
  // exit transition. Same pattern as SubjectFormDialog.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(
      editing
        ? {
            examName: editing.examName,
            examType: editing.examType,
            classId: editing.classId,
            subjectId: editing.subjectId,
            examDate: parseApiDate(editing.examDate) ?? today(),
            maxMarks: editing.maxMarks,
            passingMarks: editing.passingMarks,
            duration: editing.duration ?? '',
          }
        : EMPTY,
    )
  }, [open, editing, reset])

  // The pickers only fetch while the dialog is open, and only when creating: in edit mode the
  // class and subject are locked, so their names come off the row being edited.
  const lookupsNeeded = open && editing === null
  const { classes, isLoading: loadingClasses, hasMore } = useClassLookup({ skip: !lookupsNeeded })

  const classId = useWatch({ control, name: 'classId' })
  const selectedClass = classes.find((row) => String(row.id) === String(classId)) ?? null

  const { data: subjects, isLoading: loadingSubjects } = useGetSubjectsByGradeQuery(
    selectedClass?.grade ?? '',
    { skip: !lookupsNeeded || !selectedClass },
  )

  /**
   * Clear the subject when the class moves to a different grade.
   *
   * Not cosmetic. The subject list is per grade, so a subject chosen for grade 10 is usually
   * absent from grade 9's list — leaving the id in place would submit a subject the new class
   * does not study, and the procedure's refusal ("Subject not found in this school") would be
   * both true and unhelpful, since the subject does exist.
   */
  useEffect(() => {
    if (!lookupsNeeded) return
    setValue('subjectId', null)
  }, [selectedClass?.grade, lookupsNeeded, setValue])

  const subjectOptions: SelectOption[] = (subjects ?? []).map((row) => ({
    value: row.id,
    label: row.subjectCode ? `${row.subjectName} (${row.subjectCode})` : row.subjectName,
  }))

  const maxMarks = useWatch({ control, name: 'maxMarks' })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    // Both ids come back from RHFSelect as strings. Checked here rather than in the schema
    // because "required" reads better on the field than as a union failure.
    if (values.classId === null || values.classId === '') {
      setError('classId', { type: 'manual', message: 'Choose the class sitting this exam' })
      return
    }
    if (values.subjectId === null || values.subjectId === '') {
      setError('subjectId', { type: 'manual', message: 'Choose the subject being examined' })
      return
    }

    const payload = {
      examName: values.examName.trim(),
      examType: values.examType.trim(),
      classId: Number(values.classId),
      subjectId: Number(values.subjectId),
      // `toApiDate` formats from the local calendar fields. `toISOString()` here would file
      // the exam on the previous day for anyone east of UTC; see lib/dates.ts.
      examDate: toApiDate(values.examDate) ?? '',
      maxMarks: values.maxMarks,
      passingMarks: values.passingMarks,
      duration: values.duration === '' ? null : values.duration,
    }

    try {
      await saveExamination(payload).unwrap()
      dispatch(
        toastSuccess(editing ? `${payload.examName} updated.` : `${payload.examName} scheduled.`),
      )
      onClose()
    } catch (caught) {
      // The refusal worth surfacing verbatim is "Some entered marks exceed the new maximum":
      // it names a conflict between this form and marks already entered, and the only way out
      // is to raise the maximum back or correct those marks.
      const unassigned = applyServerErrors<ExaminationForm>(caught, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(caught, 'Could not save the examination.'))
    }
  })

  const marksAtRisk = editing !== null && editing.resultsEntered > 0

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.examName}` : 'Schedule an examination'}
      description={
        <Typography variant="body2" color="text.secondary">
          An examination covers one subject in one class. A term with six subjects across four
          classes is twenty-four examinations — which is why the name usually carries both.
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Schedule exam'}
      busy={saving}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      {editing ? (
        <>
          <Alert severity="info">
            <AlertTitle>Name, type, class and subject are fixed</AlertTitle>
            Those four identify the examination, so they cannot be changed here — saving under a
            different name would create a second examination and leave this one, and its marks,
            where they are. To correct any of them, schedule the replacement and delete this one.
          </Alert>

          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
              columnGap: 2,
              px: 0.5,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Name
            </Typography>
            <Typography variant="body2">{editing.examName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Type
            </Typography>
            <Typography variant="body2">{editing.examType}</Typography>
            <Typography variant="body2" color="text.secondary">
              Class
            </Typography>
            <Typography variant="body2">
              {editing.className} (grade {editing.grade})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Subject
            </Typography>
            <Typography variant="body2">
              {editing.subjectName}
              {editing.subjectCode ? ` (${editing.subjectCode})` : ''}
            </Typography>
          </Box>
        </>
      ) : (
        <>
          <RHFTextField
            name="examName"
            control={control}
            label="Exam name"
            required
            autoFocus
            slotProps={{ htmlInput: { maxLength: 100 } }}
            hint="Include the subject and class — the name is how it is told apart in lists and on report cards"
          />

          <RHFSelect
            name="examType"
            control={control}
            label="Exam type"
            required
            options={TYPE_OPTIONS}
            hint="Part of what identifies the exam, so the list is fixed: “Mid Term” and “Mid-term” would be two different examinations"
          />

          <RHFSelect
            name="classId"
            control={control}
            label="Class"
            required
            options={classes.map((row) => ({ value: row.id, label: classLabel(row) }))}
            loadingOptions={loadingClasses}
            hint={
              hasMore
                ? 'Showing the first 100 active classes; this school has more'
                : 'The class sitting the exam'
            }
          />

          <RHFSelect
            name="subjectId"
            control={control}
            label="Subject"
            required
            options={subjectOptions}
            loadingOptions={loadingSubjects}
            disabled={!selectedClass}
            hint={
              selectedClass
                ? `Subjects taught in grade ${selectedClass.grade}`
                : 'Choose a class first — subjects are listed per grade'
            }
          />
        </>
      )}

      <Controller
        name="examDate"
        control={control}
        render={({ field, fieldState }) => (
          <DatePicker
            label="Exam date"
            value={field.value ?? null}
            onChange={field.onChange}
            slotProps={{
              textField: {
                required: true,
                error: Boolean(fieldState.error),
                // Future dates are allowed on purpose: an exam is scheduled before it is sat.
                // Past ones too, since marks are often entered for an exam recorded late.
                helperText: fieldState.error?.message ?? 'Past or future — exams are scheduled ahead',
              },
            }}
          />
        )}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <RHFTextField
          name="maxMarks"
          control={control}
          label="Maximum marks"
          numeric
          required
          fullWidth
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <RHFTextField
          name="passingMarks"
          control={control}
          label="Passing marks"
          numeric
          required
          fullWidth
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          hint={typeof maxMarks === 'number' ? `Out of ${maxMarks}` : undefined}
        />
      </Stack>

      <RHFTextField
        name="duration"
        control={control}
        label="Duration (minutes)"
        numeric
        fullWidth
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        hint="Optional. Up to 600 minutes."
      />

      {marksAtRisk && (
        <Alert severity="warning">
          {editing.resultsEntered} mark{editing.resultsEntered === 1 ? ' has' : 's have'} already
          been entered. Lowering the maximum below any of them is refused, because it would leave
          a score on the report card that no longer makes sense.
        </Alert>
      )}
    </FormDialog>
  )
}
