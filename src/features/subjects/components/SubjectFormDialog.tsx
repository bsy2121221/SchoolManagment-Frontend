import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useFormState, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { RHFTextField } from '@/components/form/RHFTextField'
import { applyServerErrors, getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useCreateSubjectMutation, useUpdateSubjectMutation } from '../subjectsApi'
import type { SubjectRow } from '../types'

/**
 * Mirrors SubjectCreateDTO / SubjectUpdateDTO, which carry the same DataAnnotations and
 * the same three `[Required]` fields. The lengths are the server's and the column's.
 */
const schema = z.object({
  subjectName: z
    .string()
    .trim()
    .min(1, 'Subject name is required')
    .max(100, 'Subject name cannot exceed 100 characters'),
  subjectCode: z
    .string()
    .trim()
    .min(1, 'Subject code is required')
    .max(20, 'Subject code cannot exceed 20 characters'),
  grade: z.string().trim().min(1, 'Grade is required').max(10, 'Grade cannot exceed 10 characters'),
})

type SubjectForm = z.input<typeof schema>

const FIELDS = ['subjectName', 'subjectCode', 'grade'] as const

const EMPTY: SubjectForm = { subjectName: '', subjectCode: '', grade: '' }

/**
 * Builds the 'MATH10' shape every seeded subject follows: the leading letters of the
 * name, then the grade's digits. Letters only from the name, so "Social Studies" gives
 * SOCI rather than SOC+space.
 */
function suggestCode(name: string, grade: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()
  const digits = grade.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4)
  return letters ? `${letters}${digits}` : ''
}

interface SubjectFormDialogProps {
  open: boolean
  /** The subject being edited, or null to create one. */
  editing: SubjectRow | null
  onClose: () => void
}

export function SubjectFormDialog({ open, editing, onClose }: SubjectFormDialogProps) {
  const dispatch = useAppDispatch()
  const [formError, setFormError] = useState<string | null>(null)

  const [createSubject, { isLoading: creating }] = useCreateSubjectMutation()
  const [updateSubject, { isLoading: updating }] = useUpdateSubjectMutation()

  const { control, handleSubmit, reset, setError, setValue } = useForm<SubjectForm>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Re-seed on open: RHF keeps its values, so reopening after editing another row would
  // show that row's fields. Resetting on close instead -- which is what the
  // set-state-in-effect rule suggests -- would repaint the form during the exit transition.
  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect
    setFormError(null)
    reset(
      editing
        ? {
            subjectName: editing.subjectName,
            subjectCode: editing.subjectCode ?? '',
            grade: editing.grade,
          }
        : EMPTY,
    )
  }, [open, editing, reset])

  const subjectName = useWatch({ control, name: 'subjectName' })
  const grade = useWatch({ control, name: 'grade' })
  // setValue does not mark a field dirty, so this is true only once the *user* has typed
  // in the code box -- exactly the point at which we must stop suggesting.
  const { dirtyFields } = useFormState({ control })
  const codeTouched = Boolean(dirtyFields.subjectCode)

  /**
   * Suggest a code while creating, until the user takes the field over. An existing
   * subject's code is never rewritten from here: it is what the duplicate check, every
   * reactivation and anything already printed match on.
   */
  useEffect(() => {
    if (editing || codeTouched) return
    setValue('subjectCode', suggestCode(subjectName, grade))
  }, [subjectName, grade, editing, codeTouched, setValue])

  const busy = creating || updating

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const payload = {
      subjectName: values.subjectName.trim(),
      // The procedure upper-cases and trims anyway; doing it here means the value the
      // user is shown afterwards is the value they just submitted.
      subjectCode: values.subjectCode.trim().toUpperCase(),
      grade: values.grade.trim(),
    }

    try {
      if (editing) {
        await updateSubject({ subjectId: editing.id, body: payload }).unwrap()
        dispatch(toastSuccess(`${payload.subjectName} updated.`))
      } else {
        await createSubject(payload).unwrap()
        dispatch(toastSuccess(`${payload.subjectName} added.`))
      }
      onClose()
    } catch (error) {
      // The duplicate-code refusal arrives here. Worth reading: the check is not filtered
      // on IsActive, so it can be a *deactivated* subject holding the code -- and on
      // create the server resolves that by reviving it instead of refusing.
      const unassigned = applyServerErrors<SubjectForm>(error, setError, FIELDS)
      setFormError(unassigned[0] ?? getErrorMessage(error, 'Could not save the subject.'))
    }
  })

  return (
    <FormDialog
      open={open}
      title={editing ? `Edit ${editing.subjectName}` : 'Add a subject'}
      description={
        <Typography variant="body2" color="text.secondary">
          A subject belongs to one grade, and its code identifies it across this school —
          two grades teaching maths need two subjects, with two codes.
        </Typography>
      }
      error={formError}
      submitLabel={editing ? 'Save changes' : 'Create subject'}
      busy={busy}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <RHFTextField
        name="subjectName"
        control={control}
        label="Subject name"
        required
        autoFocus
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />

      <RHFTextField
        name="grade"
        control={control}
        label="Grade"
        required
        slotProps={{ htmlInput: { maxLength: 10 } }}
        hint="For example 10, or Nursery"
      />

      <RHFTextField
        name="subjectCode"
        control={control}
        label="Subject code"
        required
        slotProps={{ htmlInput: { maxLength: 20 } }}
        hint={
          editing
            ? 'Changing this changes how the subject is identified, but nothing already recorded against it is lost'
            : 'Suggested from the name and grade; stored in upper case'
        }
      />

      {!editing && (
        <Alert severity="info">
          If a deactivated subject already holds this code, it comes back under the name
          and grade entered here rather than being duplicated.
        </Alert>
      )}
    </FormDialog>
  )
}
