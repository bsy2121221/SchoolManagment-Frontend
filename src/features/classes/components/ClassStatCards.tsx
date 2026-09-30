import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import { StatCard } from '@/components/data/StatCard'
import type { ClassStats } from '../types'

/**
 * The stats strip on the class details page, straight from `sp_GetClassStats`.
 *
 * One rule runs through it: a figure the database could not compute is shown as such,
 * never as a zero. `averageAttendance` is `null` when no attendance was marked in the
 * last 30 days, and printing "0%" there would describe a class that never turns up
 * rather than a register nobody has opened.
 */
export function ClassStatCards({ stats }: { stats: ClassStats }) {
  const fillPercent =
    stats.maxStudents > 0
      ? Math.min(100, Math.round((stats.totalStudents / stats.maxStudents) * 100))
      : 0

  const markedTotal = stats.presentLast30Days + stats.absentLast30Days

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
      }}
    >
      <StatCard
        label="Enrolled"
        value={`${stats.totalStudents} / ${stats.maxStudents}`}
        caption={`${fillPercent}% of capacity`}
        extra={
          <LinearProgress
            variant="determinate"
            value={fillPercent}
            color={fillPercent >= 100 ? 'warning' : 'primary'}
            sx={{ mt: 1.5, borderRadius: 1 }}
          />
        }
      />

      <StatCard
        label="Boys / girls"
        value={`${stats.maleStudents} / ${stats.femaleStudents}`}
        caption={
          stats.maleStudents + stats.femaleStudents < stats.totalStudents
            ? `${stats.totalStudents - stats.maleStudents - stats.femaleStudents} not recorded`
            : 'All students recorded'
        }
      />

      <StatCard
        label="Attendance, 30 days"
        value={
          stats.averageAttendance === null ? (
            <Typography variant="h6" color="text.disabled" sx={{ fontWeight: 500 }}>
              Not marked
            </Typography>
          ) : (
            `${stats.averageAttendance}%`
          )
        }
        caption={
          stats.averageAttendance === null
            ? 'No register taken in this window'
            : `${stats.presentLast30Days} present of ${markedTotal} marks`
        }
      />

      <StatCard
        label="Examinations"
        value={stats.totalExaminations}
        caption={
          stats.overdueFees > 0
            ? `${stats.overdueFees} of ${stats.totalFees} fees overdue`
            : `${stats.totalFees} fee records, none overdue`
        }
      />
    </Box>
  )
}
