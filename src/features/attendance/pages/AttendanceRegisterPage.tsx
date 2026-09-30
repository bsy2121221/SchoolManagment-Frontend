import InsightsIcon from '@mui/icons-material/Insights'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan } from '@/features/auth/permissions'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { formatDateWithWeekday, toApiDate, today } from '@/lib/dates'
import { AttendanceRegister } from '../components/AttendanceRegister'

/**
 * `/attendance` -- pick a class and a date, mark the register, save it once.
 *
 * The two pickers are the whole of this page; the work is in `AttendanceRegister`. They are
 * here rather than inside it because they decide the register's identity, and the register
 * is remounted whenever either changes -- see the `key` below.
 */
export default function AttendanceRegisterPage() {
  const canMark = useCan('Attendance', 'Create')
  const canViewClasses = useCan('Classes', 'View')

  const [classId, setClassId] = useState<number | ''>('')
  const [date, setDate] = useState<Date | null>(today())

  const {
    classes,
    isLoading: loadingClasses,
    hasMore: moreClasses,
  } = useClassLookup({ skip: !canViewClasses })

  const apiDate = toApiDate(date)
  const selected = classes.find((row) => row.id === classId)

  return (
    <Box>
      <PageHeader
        title="Attendance register"
        subtitle="One class, one date. Mark the whole roll and save it in a single submission — the register is taken per day, and a student can hold only one record for a given date."
        actions={
          <Button
            component={RouterLink}
            to="/attendance/reports"
            variant="outlined"
            startIcon={<InsightsIcon />}
          >
            Reports
          </Button>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="Class"
            size="small"
            value={classId}
            onChange={(event) => {
              const raw = event.target.value
              setClassId(raw === '' ? '' : Number(raw))
            }}
            disabled={!canViewClasses || loadingClasses}
            sx={{ minWidth: 240 }}
            helperText={
              canViewClasses
                ? loadingClasses
                  ? 'Loading…'
                  : 'Active classes'
                : 'Needs permission to view classes'
            }
          >
            <MenuItem value="">
              <em>Choose a class</em>
            </MenuItem>
            {classes.map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {classLabel(row)}
              </MenuItem>
            ))}
          </TextField>

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            // The API and the procedure both accept a future date; this does not. Marking
            // Friday's register on Tuesday is a typing mistake every time, and because the
            // date is half the unique key it is a mistake that quietly occupies the real
            // Friday register.
            maxDate={today()}
            slotProps={{
              textField: {
                size: 'small',
                sx: { width: 200 },
                helperText: 'Today or earlier',
              },
            }}
          />
        </Stack>

        {moreClasses && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This school has more active classes than one page of the list holds, so some are
            missing from the picker.
          </Alert>
        )}
      </Paper>

      {classId === '' || !apiDate ? (
        <Paper variant="outlined">
          <EmptyState
            title="Choose a class and a date"
            description="The register is the class roll for one day: every student on it, marked present or absent. Nothing is loaded until a class is chosen."
          />
        </Paper>
      ) : (
        <>
          <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
            {selected ? classLabel(selected) : 'Class'} — {formatDateWithWeekday(date)}
          </Typography>

          {/*
            The key is load-bearing, not a React formality. The drafts inside are local and
            unsynced on purpose, so switching class or date must throw them away; remounting
            does that with no effect to get wrong. See the component's own note.
          */}
          <AttendanceRegister
            key={`${classId}-${apiDate}`}
            classId={classId}
            apiDate={apiDate}
            canMark={canMark}
          />
        </>
      )}
    </Box>
  )
}
