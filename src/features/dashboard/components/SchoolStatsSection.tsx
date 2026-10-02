import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ClassIcon from '@mui/icons-material/Class'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import GroupsIcon from '@mui/icons-material/Groups'
import PaymentsIcon from '@mui/icons-material/Payments'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SchoolIcon from '@mui/icons-material/School'
import type { ReactNode } from 'react'
import { StatCard } from '@/components/data/StatCard'
import { formatMoney } from '@/features/fees/feeRules'
import type { OmittedSection, SchoolStats } from '../types'

const GRID_SX = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
} as const

/**
 * The words for a figure the server withheld, with its reason on hover.
 *
 * Never a zero and never a dash that could be read as one. The reason comes from
 * `omitted`, matched on the field name the server uses (`school.feesOutstandingAmount`).
 */
export function Withheld({ reason }: { reason?: string }) {
  return (
    <Tooltip title={reason ?? 'Your role does not include this figure.'}>
      <Typography component="span" variant="body1" color="text.secondary" sx={{ fontWeight: 400 }}>
        Not available
      </Typography>
    </Tooltip>
  )
}

/** Looks up why `school.<field>` was dropped, for the tooltip. */
function reasonFor(omitted: readonly OmittedSection[], field: keyof SchoolStats): string | undefined {
  const name = `school.${field}`.toLowerCase()
  return omitted.find((item) => item.field.toLowerCase() === name)?.reason
}

interface SchoolStatsSectionProps {
  stats: SchoolStats
  omitted: readonly OmittedSection[]
}

/**
 * The school administrator's headline figures, from sp_GetDashboardStats.
 *
 * Eight tiles in two rows: who is in the school, then how today and the fee ledger look.
 * The two money figures are not drawn against each other: one is this month's takings,
 * the other everything still owed whenever it was billed, so a ratio of them means nothing.
 * Each figure goes through `show`, which turns null into "Not available" rather than 0,
 * because null here means the caller's grid withheld it (a teacher has no Fees row).
 *
 * Today's attendance is a share of the marks *taken* today, so it says how many were
 * marked as well. A school where two classes of twenty have registered reads 100% at
 * 9am, and the caption is what stops that being mistaken for a full house.
 */
export function SchoolStatsSection({ stats, omitted }: SchoolStatsSectionProps) {
  const show = (field: keyof SchoolStats, format: (value: number) => ReactNode = String) => {
    const value = stats[field]
    return value === null ? <Withheld reason={reasonFor(omitted, field)} /> : format(value)
  }

  const marked =
    stats.todayPresent !== null && stats.todayAbsent !== null
      ? stats.todayPresent + stats.todayAbsent
      : null
  const percent = stats.todayAttendancePercentage

  return (
    <Box sx={GRID_SX}>
      <StatCard label="Students" value={show('totalStudents')} icon={SchoolIcon} caption="Enrolled and active" />
      <StatCard label="Teachers" value={show('totalTeachers')} icon={GroupsIcon} caption="Active staff accounts" />
      <StatCard
        label="Parents"
        value={show('totalParents')}
        icon={FamilyRestroomIcon}
        caption="With an active login"
      />
      <StatCard
        label="Classes"
        value={show('totalClasses')}
        icon={ClassIcon}
        caption={stats.totalSubjects === null ? undefined : `${stats.totalSubjects} subjects taught`}
      />

      <StatCard
        label="Attendance today"
        icon={EventAvailableIcon}
        iconColor="success.main"
        value={
          stats.todayPresent === null ? (
            <Withheld reason={reasonFor(omitted, 'todayPresent')} />
          ) : percent === null ? (
            <Typography component="span" variant="body1" color="text.secondary">
              Not marked yet
            </Typography>
          ) : (
            `${Math.round(percent)}%`
          )
        }
        caption={
          marked !== null && marked > 0
            ? `${stats.todayPresent} present, ${stats.todayAbsent} absent, of ${marked} marked`
            : stats.todayPresent === null
              ? undefined
              : 'No register has been taken today'
        }
        extra={
          percent !== null ? (
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, percent))}
              color={percent < 75 ? 'warning' : 'success'}
              sx={{ mt: 1.5, borderRadius: 1 }}
              aria-label="Share of today's marks that are present"
            />
          ) : undefined
        }
      />

      <StatCard
        label="Collected this month"
        icon={PaymentsIcon}
        iconColor="success.main"
        value={show('feesCollectedThisMonth', formatMoney)}
        caption="Completed payments only"
      />

      <StatCard
        label="Outstanding"
        icon={ReceiptLongIcon}
        iconColor="warning.main"
        value={show('feesOutstandingAmount', formatMoney)}
        caption="Owed across all active fees, due or not"
      />

      <StatCard
        label="Overdue fees"
        icon={ReceiptLongIcon}
        iconColor={stats.overdueFees ? 'error.main' : 'text.secondary'}
        value={show('overdueFees')}
        caption={stats.overdueFees === 0 ? 'Nothing past its due date' : 'Past due and not fully paid'}
      />
    </Box>
  )
}
