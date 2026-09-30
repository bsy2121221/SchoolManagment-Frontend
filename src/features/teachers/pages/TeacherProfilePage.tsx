import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import GradingOutlinedIcon from '@mui/icons-material/GradingOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
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
import { useCan } from '@/features/auth/permissions'
import { TeacherAssignmentMatrix } from '../components/TeacherAssignmentMatrix'
import { TeacherFormDialog } from '../components/TeacherFormDialog'
import { TeacherSubjectsPanel } from '../components/TeacherSubjectsPanel'
import { useGetTeacherClassesQuery, useGetTeacherProfileQuery } from '../teachersApi'
import type { TeacherClass } from '../types'

/** A date-only string from the API, or an em dash when it is absent. */
function dateOrDash(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString()
}

/** One row of the details table. */
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
 * The classes this teacher is **class teacher** of -- `Classes.ClassTeacherId`, not the
 * classes they teach a subject in. Keeping the two apart matters: the first is pastoral
 * responsibility and is what `studentsUnderCare` counts, the second is what allows marking.
 */
function ClassTeacherPanel({ classes }: { classes: TeacherClass[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Class teacher of
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Pastoral responsibility for the whole class. Assigned from the class itself, not from
        here.
      </Typography>

      {classes.length === 0 ? (
        <EmptyState
          title="Not a class teacher"
          description="Nobody has been made the class teacher of a class with this teacher. Set it on the class."
        />
      ) : (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {classes.map((row) => (
            <Chip
              key={row.id}
              component={RouterLink}
              to={`/classes/${row.id}`}
              clickable
              variant="outlined"
              label={`${row.className} · ${row.studentCount}/${row.maxStudents}`}
            />
          ))}
        </Stack>
      )}
    </Paper>
  )
}

export default function TeacherProfilePage() {
  // The route is keyed on Users.Id, not Teachers.Id: `sp_GetTeacherProfile` takes @UserId,
  // and this screen is the thing that can only be fetched by it.
  const params = useParams<{ userId: string }>()
  const userId = Number(params.userId)
  const [editOpen, setEditOpen] = useState(false)

  const validId = Number.isInteger(userId) && userId > 0

  const { data, isLoading, error, refetch } = useGetTeacherProfileQuery(userId, { skip: !validId })

  const canEditTeachers = useCan('Teachers', 'Edit')

  // Keyed on Teachers.Id, which only the profile response knows -- hence the skip.
  const { data: classes } = useGetTeacherClassesQuery(data?.id ?? 0, { skip: !data })

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid teacher reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the teacher…" />

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState
          error={error}
          title="Could not load this teacher"
          onRetry={() => void refetch()}
        />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title="No such teacher"
          // Unlike the student profile, this one filters on IsActive, so a deactivated
          // teacher lands here rather than showing a read-only record.
          description="They may have been deleted, belong to a different school, or never have existed. Deactivated teachers cannot be opened at all."
          action={
            <Button component={RouterLink} to="/teachers" startIcon={<ArrowBackIcon />}>
              Back to teachers
            </Button>
          }
        />
      </Box>
    )
  }

  const stats = data.stats
  const fullName = `${data.firstName} ${data.lastName}`.trim() || data.username

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/teachers"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mt: 2 }}
      >
        Teachers
      </Button>

      <PageHeader
        title={fullName}
        subtitle={`${data.employeeId} · signs in as ${data.username}${
          data.subject ? ` · ${data.subject}` : ''
        }`}
        actions={
          <Can module="Teachers" action="Edit">
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          </Can>
        }
      />

      {data.requirePasswordChange && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This teacher has not changed the password their account was created with, so they have
          not signed in yet.
        </Alert>
      )}

      {stats ? (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            mb: 3,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(5, 1fr)',
            },
          }}
        >
          <StatCard
            label="Subjects"
            value={stats.subjectsAssigned}
            icon={MenuBookOutlinedIcon}
            caption={
              stats.subjectsAssigned === 0
                ? 'None — they cannot be given a subject in a class'
                : 'Qualified to teach these'
            }
          />

          <StatCard
            label="Classes"
            value={stats.classesAssigned}
            icon={ClassOutlinedIcon}
            iconColor="info.main"
            caption={
              stats.classesAssigned === 0
                ? 'Not the class teacher of any class'
                : 'As class teacher, not as subject teacher'
            }
          />

          <StatCard
            label="Students"
            value={stats.studentsUnderCare}
            icon={GroupsOutlinedIcon}
            iconColor="secondary.main"
            // Worth stating: the figure is the roll of the classes they are class teacher
            // of, which is usually far fewer than the students they teach.
            caption="On the roll of the classes above — not everyone they teach"
          />

          <StatCard
            label="Registers"
            value={stats.attendanceMarkedLastMonth}
            icon={EventAvailableOutlinedIcon}
            iconColor="success.main"
            caption="Attendance marks entered in the last month, by them"
          />

          <StatCard
            label="Marks"
            value={stats.resultsEnteredLastMonth}
            icon={GradingOutlinedIcon}
            iconColor="warning.main"
            caption="Results entered in the last month, by them"
          />
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <EmptyState
            title="No statistics available"
            description="The server returned the teacher without their figures."
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
              <DetailRow label="Employee number" value={data.employeeId} />
              <DetailRow label="Joined" value={dateOrDash(data.joinDate)} />
              <DetailRow label="Primary subject" value={data.subject} />
              <DetailRow label="Qualification" value={data.qualification} />
              <DetailRow
                label="Experience"
                // 0 years is a real answer; null is nobody having recorded it.
                value={data.experience === null ? null : `${data.experience} years`}
              />
              {/* Salary is on the response whoever asks -- the endpoint is Admin or Teacher
                  -- so hiding the row is presentation, not protection. See §7 of the plan. */}
              {canEditTeachers && (
                <DetailRow
                  label="Salary"
                  value={
                    data.salary === null
                      ? null
                      : data.salary.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                  }
                />
              )}
              <DetailRow label="Email" value={data.email} />
              <DetailRow label="Phone" value={data.phoneNumber} />
              <DetailRow label="Address" value={data.address} />
              <DetailRow label="School" value={data.schoolName} />
            </TableBody>
          </Table>
        </Paper>

        <Stack spacing={2}>
          <TeacherSubjectsPanel
            teacherId={data.id}
            userId={data.userId}
            canEdit={canEditTeachers}
          />
          <ClassTeacherPanel classes={classes ?? []} />
        </Stack>
      </Box>

      <Box sx={{ mt: 2 }}>
        <TeacherAssignmentMatrix
          teacherId={data.id}
          userId={data.userId}
          canEdit={canEditTeachers}
        />
      </Box>

      <TeacherFormDialog
        open={editOpen}
        editing={data}
        showSalary={canEditTeachers}
        onClose={() => setEditOpen(false)}
      />
    </Box>
  )
}
