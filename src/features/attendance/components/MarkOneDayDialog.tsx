import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { FormDialog } from '@/components/form/FormDialog'
import { formatDate, toApiDate, today } from '@/lib/dates'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastSuccess } from '@/ui/uiSlice'
import { useMarkAttendanceMutation } from '../attendanceApi'

const REMARKS_MAX = 255

interface MarkOneDayDialogProps {
  /** `Students.Id`. */
  studentId: number
  studentName: string
  /** The student's class. The one thing `POST /api/Attendance` cannot infer. */
  classId: number
  className: string
  onClose: () => void
}

/**
 * Mark or correct one student on one date, through `POST /api/Attendance`.
 *
 * The register handles a normal day; this handles the exceptions -- a student who turned up
 * after the register was taken, a correction to last Tuesday, a single absence noted from a
 * report. `sp_MarkAttendance` is a MERGE, so this writes a new record or overwrites the
 * existing one without the caller needing to know which.
 *
 * Its one refusal is a student not actively enrolled in the class given, and the class here
 * comes from the summary row rather than from a picker, so the two cannot disagree unless
 * the roll changed underneath. The message is shown as sent, because the remedy is to fix
 * the enrolment rather than to try again.
 *
 * Local state rather than react-hook-form, unlike the create/edit dialogs elsewhere: there
 * are two inputs, both constrained by the controls themselves -- a date picker that cannot
 * choose the future and a toggle that is always one of two values -- so a resolver here
 * would be schema for its own sake.
 */
export function MarkOneDayDialog({
  studentId,
  studentName,
  classId,
  className,
  onClose,
}: MarkOneDayDialogProps) {
  const dispatch = useAppDispatch()
  const [markAttendance, { isLoading: saving }] = useMarkAttendanceMutation()

  const [date, setDate] = useState<Date | null>(today())
  const [isPresent, setIsPresent] = useState(true)
  const [remarks, setRemarks] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const apiDate = toApiDate(date)

  const handleSubmit = async () => {
    if (!apiDate) {
      setFormError('Choose the date this record is for.')
      return
    }
    setFormError(null)

    try {
      await markAttendance({
        studentId,
        classId,
        attendanceDate: apiDate,
        isPresent,
        // Null rather than '' so the column stays NULL when there is nothing to say.
        remarks: remarks.trim() || null,
      }).unwrap()

      dispatch(
        toastSuccess(
          `${studentName} marked ${isPresent ? 'present' : 'absent'} on ${formatDate(date)}.`,
        ),
      )
      onClose()
    } catch (caught) {
      setFormError(getErrorMessage(caught, 'Could not save this record.'))
    }
  }

  return (
    <FormDialog
      open
      title={`Mark ${studentName}`}
      description={
        <Typography variant="body2" color="text.secondary">
          Recorded against {className}. Saving replaces any existing record for this student on
          this date — one student can hold only one record per day.
        </Typography>
      }
      error={formError}
      submitLabel="Save record"
      busy={saving}
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
      onClose={onClose}
    >
      <DatePicker
        label="Date"
        value={date}
        onChange={setDate}
        // As on the register: the server would accept a future date, and a future register is
        // a mistake every time.
        maxDate={today()}
        slotProps={{ textField: { fullWidth: true, helperText: 'Today or earlier' } }}
      />

      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Attendance
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={isPresent ? 'present' : 'absent'}
          // No third option, and none is possible: Attendance.IsPresent is NOT NULL, so
          // there is no way to store "undecided" and no endpoint that removes a record.
          onChange={(_event, value: string | null) => {
            if (value !== null) setIsPresent(value === 'present')
          }}
        >
          <ToggleButton value="present" color="success">
            Present
          </ToggleButton>
          <ToggleButton value="absent" color="error">
            Absent
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <TextField
        label="Remarks"
        fullWidth
        multiline
        minRows={2}
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        slotProps={{ htmlInput: { maxLength: REMARKS_MAX } }}
        helperText={`Optional — why this record is what it is. ${remarks.length}/${REMARKS_MAX}`}
      />
    </FormDialog>
  )
}
