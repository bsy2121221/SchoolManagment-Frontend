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
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { MyProfileFormDialog } from '../components/MyProfileFormDialog'
import {
  useGetMyTeacherProfileQuery,
  useGetTeacherClassesQuery,
  useGetTeacherSubjectAssignmentsQuery,
} from '../teachersApi'

function dateOrDash(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString()
}

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
 * A teacher's view of their own record.
 *
 * This screen exists because of a gap in the seeded permission grid rather than in spite of
 * it: the Teacher role has **no `Teachers` permission row at all**, so a teacher cannot
 * open `/teachers` or anyone's profile. `GET`/`PUT /teachers/my-profile` are gated on the
 * role instead of the grid, which makes this the one teacher screen they can reach — and
 * why the route is guarded by role, with no `module`.
 *
 * Everything that decides what they may actually do is read-only here. Their subjects and
 * their subject-in-class assignments are set by an administrator; showing them anyway is
 * what turns "I cannot enter marks for 10-B" into something the teacher can explain.
 */
export default function MyProfilePage() {
  const [editOpen, setEditOpen] = useState(false)

  const { data, isLoading, error, refetch } = useGetMyTeacherProfileQuery()

  // Both are keyed on Teachers.Id, which only the profile response carries. They are
  // AdminOrTeacher by policy rather than by the permission grid, so a teacher may read
  // them -- including, as it happens, for a colleague.
  const { data: classes } = useGetTeacherClassesQuery(data?.id ?? 0, { skip: !data })
  const { data: assignments } = useGetTeacherSubjectAssignmentsQuery(data?.id ?? 0, { skip: !data })

  if (isLoading) return <FullPageLoader label="Loading your profile…" />

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState
          error={error}
          title="Could not load your profile"
          onRetry={() => void refetch()}
        />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title="No teacher record"
          description="Your sign-in is a teacher's, but no teacher record is attached to it. An administrator has to put that right."
        />
      </Box>
    )
  }

  const stats = data.stats
  const fullName = `${data.firstName} ${data.lastName}`.trim() || data.username
  const rows = assignments ?? []
  // Comma-joined by the procedure, not an array. Null when nothing is assigned.
  const subjectNames = data.assignedSubjects?.split(',').map((name) => name.trim()) ?? []

  return (
    <Box>
      <PageHeader
        title={fullName}
        subtitle={`${data.employeeId} · you sign in as ${data.username}${
          data.schoolName ? ` · ${data.schoolName}` : ''
        }`}
        actions={
          <Button
            variant="outlined"
            startIcon={<EditOutlinedIcon />}
            onClick={() => setEditOpen(true)}
          >
            Edit my details
          </Button>
        }
      />

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
            label="My subjects"
            value={stats.subjectsAssigned}
            icon={MenuBookOutlinedIcon}
            caption={
              stats.subjectsAssigned === 0
                ? 'None yet — ask an administrator to assign one'
                : 'Assigned to you'
            }
          />

          <StatCard
            label="My classes"
            value={stats.classesAssigned}
            icon={ClassOutlinedIcon}
            iconColor="info.main"
            caption={
              stats.classesAssigned === 0
                ? 'You are not the class teacher of any class'
                : 'Where you are the class teacher'
            }
          />

          <StatCard
            label="My students"
            value={stats.studentsUnderCare}
            icon={GroupsOutlinedIcon}
            iconColor="secondary.main"
            caption="On the roll of the classes you are class teacher of"
          />

          <StatCard
            label="Registers"
            value={stats.attendanceMarkedLastMonth}
            icon={EventAvailableOutlinedIcon}
            iconColor="success.main"
            caption="Attendance marks you entered in the last month"
          />

          <StatCard
            label="Marks"
            value={stats.resultsEnteredLastMonth}
            icon={GradingOutlinedIcon}
            iconColor="warning.main"
            caption="Results you entered in the last month"
          />
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <EmptyState
            title="No statistics available"
            description="The server returned your profile without its figures."
          />
        </Paper>
      )}

      {data.requirePasswordChange && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are still using the password your account was created with. Change it from the
          account menu.
        </Alert>
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
            My details
          </Typography>
          <Table size="small">
            <TableBody>
              <DetailRow label="Employee number" value={data.employeeId} />
              <DetailRow label="Joined" value={dateOrDash(data.joinDate)} />
              <DetailRow label="Primary subject" value={data.subject} />
              <DetailRow label="Qualification" value={data.qualification} />
              <DetailRow
                label="Experience"
                value={data.experience === null ? null : `${data.experience} years`}
              />
              <DetailRow label="Email" value={data.email} />
              <DetailRow label="Phone" value={data.phoneNumber} />
              <DetailRow label="Address" value={data.address} />
            </TableBody>
          </Table>
          {/* Salary is on this response -- TeacherProfileDTO carries it -- but
              sp_UpdateTeacherProfile takes no @Salary, so it is deliberately not shown
              here: offering a figure that cannot be corrected invites the request. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Your employee number and join date are fixed. Pay is held by the school office and
            is not editable here.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            My subjects
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            Assigned by an administrator.
          </Typography>

          {subjectNames.length === 0 ? (
            <EmptyState
              title="No subjects assigned"
              description="Until a subject is assigned to you and given to you in a class, you cannot enter marks."
            />
          ) : (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {subjectNames.map((name) => (
                <Chip key={name} label={name} variant="outlined" />
              ))}
            </Stack>
          )}

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
            Class teacher of
          </Typography>
          {(classes ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              You are not the class teacher of any class.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {(classes ?? []).map((row) => (
                <Chip
                  key={row.id}
                  variant="outlined"
                  label={`${row.className} · ${row.studentCount}/${row.maxStudents}`}
                />
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          What I teach
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
          These pairings are what let you take the register and enter marks. Holding a subject is
          not enough on its own — if a class is missing here, ask an administrator to add it.
        </Typography>

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing assigned yet"
            description="You have not been given a subject in a class, so mark entry and attendance will be empty for you."
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Subject</TableCell>
                <TableCell>Class</TableCell>
                <TableCell align="right">On roll</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    {row.subjectName}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {row.subjectCode}
                    </Typography>
                  </TableCell>
                  <TableCell>{`${row.className} (grade ${row.classGrade})`}</TableCell>
                  <TableCell align="right">{row.studentCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <MyProfileFormDialog open={editOpen} profile={data} onClose={() => setEditOpen(false)} />
    </Box>
  )
}
