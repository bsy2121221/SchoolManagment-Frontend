import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import MoveUpIcon from '@mui/icons-material/MoveUp'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useCan, useCurrentUser } from '@/features/auth/permissions'
import { useClassLookup } from '@/features/classes/classLookup'
import { ROLES } from '@/types/enums'
import { StudentFormDialog } from '../components/StudentFormDialog'
import { StudentPromoteDialog } from '../components/StudentPromoteDialog'
import { StudentSubjectsPanel } from '../components/StudentSubjectsPanel'
import { useGetStudentProfileQuery } from '../studentsApi'
import type { FeeStatus } from '../types'

/** A date-only string from the API, or an em dash when it is absent. */
function dateOrDash(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString()
}

function moneyOf(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** One row of the personal-details table. */
function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <TableRow>
      <TableCell sx={{ width: 180, color: 'text.secondary', border: 0, py: 0.75 }}>
        {label}
      </TableCell>
      <TableCell sx={{ border: 0, py: 0.75 }}>{value || '—'}</TableCell>
    </TableRow>
  )
}

/**
 * `pendingFees` is the sum of per-fee balances, each floored at zero, so it can exceed
 * `totalDue - totalPaid` when one fee has been overpaid. Showing both figures rather than a
 * single "balance" is what makes that legible instead of looking like an arithmetic error.
 */
function FeeStatusPanel({ fees, accountHref }: { fees: FeeStatus; accountHref: string | null }) {
  const overpaid = fees.totalPaid - fees.totalDue

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Fees
        </Typography>
        {accountHref && (
          <Button
            size="small"
            component={RouterLink}
            to={accountHref}
            startIcon={<AccountBalanceWalletIcon />}
          >
            Fee account
          </Button>
        )}
      </Stack>
      <Table size="small">
        <TableBody>
          <DetailRow label="Charged" value={moneyOf(fees.totalDue)} />
          <DetailRow label="Paid" value={moneyOf(fees.totalPaid)} />
          <DetailRow label="Outstanding" value={moneyOf(fees.pendingFees)} />
        </TableBody>
      </Table>
      {fees.pendingFees > 0 && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {moneyOf(fees.pendingFees)} is outstanding across one or more fees.
        </Alert>
      )}
      {fees.pendingFees === 0 && overpaid > 0 && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Nothing outstanding, and {moneyOf(overpaid)} paid above what has been charged.
        </Alert>
      )}
    </Paper>
  )
}

export default function StudentProfilePage() {
  const params = useParams<{ studentId: string }>()
  const studentId = Number(params.studentId)
  const [editOpen, setEditOpen] = useState(false)
  const [promoteOpen, setPromoteOpen] = useState(false)

  const validId = Number.isInteger(studentId) && studentId > 0

  const { data, isLoading, error, refetch } = useGetStudentProfileQuery(studentId, {
    skip: !validId,
  })

  const canEditStudents = useCan('Students', 'Edit')
  // The subject picker narrows by the student's grade, which only the class knows.
  const canViewClasses = useCan('Classes', 'View')
  const { classes } = useClassLookup({ skip: !canViewClasses })
  // The same pair of checks as the /fees route: Fees:View alone would admit roles whose every
  // fee request is refused. See routes/index.tsx.
  const role = useCurrentUser()?.role
  const canOpenFees =
    useCan('Fees', 'View') && (role === ROLES.Admin || role === ROLES.SuperAdmin)
  const feeAccountHref = canOpenFees ? `/fees/students/${studentId}` : null

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid student reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the student…" />

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState
          error={error}
          title="Could not load this student"
          onRetry={() => void refetch()}
        />
      </Box>
    )
  }

  const student = data?.studentInfo
  if (!student) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title="No such student"
          description="They may belong to a different school, or never have existed."
          action={
            <Button component={RouterLink} to="/students" startIcon={<ArrowBackIcon />}>
              Back to students
            </Button>
          }
        />
      </Box>
    )
  }

  const stats = data.academicStats
  const grade = classes.find((row) => row.id === student.classId)?.grade
  const fullName = `${student.firstName} ${student.lastName}`.trim() || student.username

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/students"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mt: 2 }}
      >
        Students
      </Button>

      <PageHeader
        title={fullName}
        subtitle={`${student.studentId} · ${student.className ?? 'no class'}${
          student.rollNumber ? `, roll ${student.rollNumber}` : ''
        } · signs in as ${student.username}`}
        actions={
          <Stack direction="row" spacing={1}>
            <Can module="Students" action="Edit">
              <Button
                variant="outlined"
                startIcon={<MoveUpIcon />}
                disabled={!student.isActive}
                onClick={() => setPromoteOpen(true)}
              >
                Promote
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                disabled={!student.isActive}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            </Can>
          </Stack>
        }
      />

      {/* The profile reads without an IsActive filter, so this is the one screen where a
          deactivated student still resolves -- a school still has to answer questions about
          someone who has left. Every write against them is refused. */}
      {!student.isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This student is deactivated: their login is revoked and they are off the class roll.
          Their record is kept, and it cannot be edited or reactivated from here.
        </Alert>
      )}

      {stats ? (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            mb: 3,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          }}
        >
          <StatCard
            label="Subjects"
            value={stats.totalSubjects}
            caption={
              stats.totalSubjects === 0 ? 'None enrolled yet' : 'Active enrolments'
            }
          />

          <StatCard
            label="Average"
            // A percentage, not a raw mark: the server divides obtained marks by the
            // examinations' maximum, because 45/50 and 45/100 cannot be averaged together.
            value={
              stats.averageMarks === null ? (
                <Typography variant="h6" color="text.disabled" sx={{ fontWeight: 500 }}>
                  No results
                </Typography>
              ) : (
                `${stats.averageMarks}%`
              )
            }
            caption={
              stats.averageMarks === null
                ? 'Nothing has been marked for this student'
                : 'Across every published result'
            }
          />

          <StatCard
            label="Grade"
            value={
              stats.grade ?? (
                <Typography variant="h6" color="text.disabled" sx={{ fontWeight: 500 }}>
                  —
                </Typography>
              )
            }
            caption={
              stats.rank === null
                ? student.classId === null
                  ? 'Not ranked — no class to rank within'
                  : 'Not ranked until results exist'
                : `Rank ${stats.rank} in ${student.className}`
            }
          />

          <StatCard
            label="Attendance"
            value={`${stats.attendancePercentage}%`}
            caption={
              stats.attendancePercentage === 0
                ? 'Either no register has been taken, or they were never present — the figure is 0 for both'
                : 'Present marks as a share of all marks'
            }
          />
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <EmptyState
            title="No statistics available"
            description="The server returned the student without their figures."
          />
        </Paper>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' },
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            Details
          </Typography>
          <Table size="small">
            <TableBody>
              <DetailRow label="Admission number" value={student.studentId} />
              <DetailRow label="Admitted" value={dateOrDash(student.admissionDate)} />
              <DetailRow label="Class" value={student.className} />
              <DetailRow label="Roll number" value={student.rollNumber} />
              <DetailRow label="Date of birth" value={dateOrDash(student.dateOfBirth)} />
              <DetailRow label="Gender" value={student.gender} />
              <DetailRow label="Blood group" value={student.bloodGroup} />
              <DetailRow label="Father" value={student.fatherName} />
              <DetailRow label="Mother" value={student.motherName} />
              <DetailRow label="Email" value={student.email} />
              <DetailRow label="Phone" value={student.phoneNumber} />
              <DetailRow label="Address" value={student.address} />
            </TableBody>
          </Table>
        </Paper>

        <Stack spacing={2}>
          <StudentSubjectsPanel
            studentId={student.id}
            grade={grade}
            canEdit={canEditStudents && student.isActive}
          />

          {data.feeStatus ? (
            <FeeStatusPanel fees={data.feeStatus} accountHref={feeAccountHref} />
          ) : (
            <Paper variant="outlined">
              <EmptyState
                title="No fee information"
                description="Nothing has been charged to this student."
                action={
                  feeAccountHref ? (
                    <Button component={RouterLink} to={feeAccountHref}>
                      Open fee account
                    </Button>
                  ) : undefined
                }
              />
            </Paper>
          )}
        </Stack>
      </Box>

      <StudentFormDialog open={editOpen} editing={student} onClose={() => setEditOpen(false)} />

      <StudentPromoteDialog
        open={promoteOpen}
        student={student}
        onClose={() => setPromoteOpen(false)}
      />
    </Box>
  )
}
