import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import GradingIcon from '@mui/icons-material/Grading'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ScheduleIcon from '@mui/icons-material/Schedule'
import type { ReactNode } from 'react'
import { StatCard } from '@/components/data/StatCard'
import { formatDate } from '@/lib/dates'
import { formatMoney } from '@/features/fees/feeRules'
import { formatMinutes, timeRange } from '@/features/schedule/scheduleRules'
import type { CurrentNextLesson } from '@/features/schedule/types'
import type { ParentSection, StudentSection, TeacherSection } from '../types'
import { Withheld } from './SchoolStatsSection'

const GRID_SX = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
} as const

/** A nullable figure, with null shown as withheld rather than as zero. */
const shown = (value: number | null, format: (v: number) => ReactNode = String): ReactNode =>
  value === null ? <Withheld /> : format(value)

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, px: 2, pt: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

function Lesson({ label, lesson }: { label: string; lesson: CurrentNextLesson | null }) {
  return (
    <StatCard
      label={label}
      icon={ScheduleIcon}
      value={lesson ? lesson.subjectName : 'None'}
      caption={
        lesson
          ? `${lesson.className} · ${lesson.dayName} ${timeRange(lesson.startTime, lesson.endTime)}${lesson.room ? ` · ${lesson.room}` : ''}`
          : 'Nothing scheduled'
      }
    />
  )
}

/** A teacher's day: what they are teaching now and next, today's list, their own classes. */
export function TeacherDashboard({ teacher }: { teacher: TeacherSection }) {
  const stats = teacher.scheduleStats

  return (
    <Stack spacing={2}>
      <Box sx={GRID_SX}>
        <Lesson label="Teaching now" lesson={teacher.currentClass} />
        <Lesson label="Next lesson" lesson={teacher.nextClass} />
        <StatCard
          label="Lessons a week"
          icon={ScheduleIcon}
          value={stats ? stats.totalClasses : <Withheld />}
          caption={stats ? `${formatMinutes(stats.totalMinutesPerWeek)} across ${stats.daysInWeek} days` : undefined}
        />
        <StatCard
          label="Class teacher of"
          icon={GradingIcon}
          value={teacher.classes.length}
          caption={teacher.classes.map((c) => c.className).join(', ') || 'No class of your own'}
        />
      </Box>

      <Panel title="Today's timetable">
        {teacher.todaySchedule.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No lessons today.
          </Typography>
        ) : (
          <List dense>
            {teacher.todaySchedule.map((entry) => (
              <ListItem key={entry.id}>
                <ListItemText
                  primary={`${timeRange(entry.startTime, entry.endTime)} · ${entry.subjectName}`}
                  secondary={`${entry.className}${entry.room ? ` · ${entry.room}` : ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Panel>
    </Stack>
  )
}

/** A student's own record. The counts are since admission, which the captions say. */
export function StudentDashboard({ student }: { student: StudentSection }) {
  return (
    <Stack spacing={2}>
      <Box sx={GRID_SX}>
        <StatCard
          label="Attendance"
          icon={EventAvailableIcon}
          value={
            student.attendancePercentage !== null
              ? `${Math.round(student.attendancePercentage)}%`
              : student.presentDays === null
                ? <Withheld />
                : 'No register yet'
          }
          caption={
            student.totalDays ? `${student.presentDays} of ${student.totalDays} days, since admission` : undefined
          }
        />
        <StatCard
          label="Average mark"
          icon={GradingIcon}
          value={shown(student.averageMarks, (v) => v.toFixed(1))}
          caption={
            student.totalResults !== null
              ? `${student.totalResults} results${student.highestMarks !== null ? `, best ${student.highestMarks}` : ''}`
              : undefined
          }
        />
        <StatCard
          label="Fees pending"
          icon={ReceiptLongIcon}
          iconColor="warning.main"
          value={shown(student.pendingAmount, formatMoney)}
          caption={student.paidAmount !== null ? `${formatMoney(student.paidAmount)} paid` : undefined}
        />
        <StatCard
          label="Class"
          icon={ScheduleIcon}
          value={student.className ?? 'Not placed yet'}
          caption={`${student.subjectCount} subjects${student.rollNumber ? ` · roll ${student.rollNumber}` : ''}`}
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Panel title="Today's timetable">
          {student.todaySchedule.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No lessons today.
            </Typography>
          ) : (
            <List dense>
              {student.todaySchedule.map((entry) => (
                <ListItem key={entry.id}>
                  <ListItemText
                    primary={`${timeRange(entry.startTime, entry.endTime)} · ${entry.subjectName}`}
                    secondary={`${entry.teacherName}${entry.room ? ` · ${entry.room}` : ''}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Panel>

        <Panel title="Recent results">
          {student.recentResults.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No results yet.
            </Typography>
          ) : (
            <List dense>
              {student.recentResults.map((result) => (
                <ListItem
                  key={result.id}
                  secondaryAction={
                    <Chip
                      size="small"
                      color={result.isPass ? 'success' : 'error'}
                      variant="outlined"
                      label={result.grade ?? `${Math.round(result.percentage)}%`}
                    />
                  }
                >
                  <ListItemText
                    primary={`${result.subjectName} · ${result.obtainedMarks}/${result.maxMarks}`}
                    secondary={`${result.examName} · ${formatDate(result.examDate)}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Panel>
      </Box>
    </Stack>
  )
}

/** One card per linked child. Attendance is the last month, not since admission. */
export function ParentDashboard({ parent }: { parent: ParentSection }) {
  if (parent.children.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No children are linked to your account yet. The school office can link them.
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
      {parent.children.map((child) => (
        <Paper key={child.studentId} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {child.firstName} {child.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {child.className} · {child.relationship}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            <StatCard
              label="Attendance, last month"
              value={
                child.attendancePercentage !== null
                  ? `${Math.round(child.attendancePercentage)}%`
                  : child.presentDays === null
                    ? <Withheld />
                    : 'No register yet'
              }
              caption={child.totalDays ? `${child.presentDays} of ${child.totalDays} days` : undefined}
            />
            <StatCard
              label="Fees owed"
              value={shown(child.outstandingAmount, formatMoney)}
              caption={
                child.overdueFeeCount ? `${child.overdueFeeCount} overdue` : child.overdueFeeCount === 0 ? 'Nothing overdue' : undefined
              }
            />
          </Box>
        </Paper>
      ))}
    </Box>
  )
}
