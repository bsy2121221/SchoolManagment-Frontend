import EventBusyIcon from '@mui/icons-material/EventBusy'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { subDays } from 'date-fns'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan } from '@/features/auth/permissions'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { toApiDate, today } from '@/lib/dates'
import { AttendanceSummaryTable } from '../components/AttendanceSummaryTable'
import { DailyAttendanceTable } from '../components/DailyAttendanceTable'
import { useGetAttendanceSummaryQuery } from '../attendanceApi'
import { LOW_ATTENDANCE_THRESHOLD, formatPercentage, overallPercentage } from '../attendanceRules'

/** The window the screen opens on. A month is long enough to be meaningful, short enough to load. */
const DEFAULT_WINDOW_DAYS = 30

type ReportTab = 'students' | 'days'

/**
 * `/attendance/reports` -- the two aggregate reads, over a shared window.
 *
 * Both tabs answer "how is attendance going", from opposite ends: per student (who is
 * missing school) and per date (which registers were taken at all). They are on one screen
 * because the second is how you find out whether the first can be trusted -- a class with
 * five recorded days in a month has percentages that mean very little.
 *
 * The window is always sent explicitly rather than left to the procedures' "last month"
 * default, so the dates on screen are the dates in the query. A default that lives only on
 * the server is a report whose window nobody can see.
 */
export default function AttendanceReportsPage() {
  const canViewClasses = useCan('Classes', 'View')

  const [tab, setTab] = useState<ReportTab>('students')
  const [classId, setClassId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState<Date | null>(subDays(today(), DEFAULT_WINDOW_DAYS - 1))
  const [endDate, setEndDate] = useState<Date | null>(today())

  const { classes, isLoading: loadingClasses } = useClassLookup({ skip: !canViewClasses })

  const invalidRange = Boolean(startDate && endDate && startDate > endDate)
  const window = {
    classId: classId === '' ? undefined : classId,
    startDate: toApiDate(startDate),
    endDate: toApiDate(endDate),
  }

  /**
   * The stat strip reads the same query the summary tab does, with the same arguments, so
   * RTK Query serves both from one request and one cache entry rather than asking twice.
   */
  const { data: summary } = useGetAttendanceSummaryQuery(window, { skip: invalidRange })

  const rows = summary ?? []
  const overall = overallPercentage(rows)
  const recorded = rows.filter((row) => row.attendancePercentage !== null)
  const below = recorded.filter(
    (row) => (row.attendancePercentage ?? 0) < LOW_ATTENDANCE_THRESHOLD,
  ).length
  const unrecorded = rows.length - recorded.length

  return (
    <Box>
      <PageHeader
        title="Attendance reports"
        subtitle="Percentages per student and registers per day, over one window. Percentages are over the days actually recorded, not over the days the school was open."
        actions={
          <Button component={RouterLink} to="/attendance" variant="outlined" startIcon={<FactCheckIcon />}>
            Take a register
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
            sx={{ minWidth: 220 }}
            helperText={canViewClasses ? 'All classes unless narrowed' : 'Needs Classes access'}
          >
            <MenuItem value="">
              <em>All classes</em>
            </MenuItem>
            {classes.map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {classLabel(row)}
              </MenuItem>
            ))}
          </TextField>

          <DatePicker
            label="From"
            value={startDate}
            onChange={setStartDate}
            maxDate={today()}
            slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
          />
          <DatePicker
            label="To"
            value={endDate}
            onChange={setEndDate}
            maxDate={today()}
            slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
          />
        </Stack>
      </Paper>

      {invalidRange ? (
        <Paper variant="outlined">
          <EmptyState
            title="That window runs backwards"
            description="The start date is after the end date. The procedures would read it as an empty range and report nothing, so nothing is asked for — swap the two."
          />
        </Paper>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              mb: 3,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            }}
          >
            <StatCard
              label="Overall"
              // Words, not a number, when nothing was recorded. "0%" here would describe a
              // school nobody attends rather than one whose registers were not taken.
              value={formatPercentage(overall)}
              caption="Present as a share of all records in the window"
              icon={HowToRegIcon}
              iconColor="success.main"
            />
            <StatCard
              label={`Below ${LOW_ATTENDANCE_THRESHOLD}%`}
              value={below}
              caption={`Of the ${recorded.length} students with any record`}
              icon={WarningAmberIcon}
              iconColor={below > 0 ? 'warning.main' : 'text.disabled'}
            />
            <StatCard
              label="No record"
              value={unrecorded}
              caption="Active students nobody marked in this window — a gap in the register, not an absence"
              icon={EventBusyIcon}
              iconColor={unrecorded > 0 ? 'warning.main' : 'text.disabled'}
            />
            <StatCard
              label="Students"
              value={rows.length}
              caption="Active students in scope"
              icon={FactCheckIcon}
            />
          </Box>

          {unrecorded > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {unrecorded} of {rows.length} students have no attendance record at all in this
              window. Their percentage is blank rather than zero, and the day-by-day tab shows
              which dates were registered.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Tabs value={tab} onChange={(_event, value: ReportTab) => setTab(value)}>
              <Tab value="students" label="By student" />
              <Tab value="days" label="By day" />
            </Tabs>
          </Paper>

          {tab === 'students' ? (
            <AttendanceSummaryTable {...window} />
          ) : (
            <DailyAttendanceTable {...window} />
          )}
        </>
      )}
    </Box>
  )
}
