import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useGetClassDetailsQuery } from '../classesApi'
import { ClassFormDialog } from '../components/ClassFormDialog'
import { ClassStatCards } from '../components/ClassStatCards'
import { ClassTimetableView } from '../components/ClassTimetableView'
import type { ClassStudentRow } from '../types'

type TabKey = 'overview' | 'students' | 'timetable'

function fullName(student: ClassStudentRow): string {
  return `${student.firstName} ${student.lastName}`.trim() || student.studentId
}

/** A date-only string from the API, or an em dash when it is absent. */
function dateOrDash(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString()
}

export default function ClassDetailsPage() {
  const params = useParams<{ classId: string }>()
  const classId = Number(params.classId)
  const [tab, setTab] = useState<TabKey>('overview')
  const [editOpen, setEditOpen] = useState(false)

  const { data, isLoading, error, refetch } = useGetClassDetailsQuery(classId, {
    skip: !Number.isInteger(classId) || classId <= 0,
  })

  if (!Number.isInteger(classId) || classId <= 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid class reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the class…" />

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState error={error} title="Could not load this class" onRetry={() => void refetch()} />
      </Box>
    )
  }

  const info = data?.classInfo
  if (!info) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title="No such class"
          description="It may belong to a different school, or never have existed."
          action={
            <Button component={RouterLink} to="/classes" startIcon={<ArrowBackIcon />}>
              Back to classes
            </Button>
          }
        />
      </Box>
    )
  }

  const students = data.students ?? []

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/classes"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mt: 2 }}
      >
        Classes
      </Button>

      <PageHeader
        title={info.className}
        subtitle={`Grade ${info.grade}, section ${info.section} · class teacher ${
          info.classTeacherName ?? 'not assigned'
        }`}
        actions={
          <Can module="Classes" action="Edit">
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

      {/* This endpoint reads with @IncludeInactive = 1, so it is the one place a
          soft-deleted class still resolves. Saying so beats a page that looks normal
          while every write against it fails. */}
      {!info.isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This class is suspended. Its teacher schedules are deactivated and it does not
          appear in the active class list.
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_event, next: TabKey) => setTab(next)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab value="overview" label="Overview" />
        <Tab
          value="students"
          label={
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <span>Students</span>
              <Chip size="small" label={info.totalStudents} />
            </Stack>
          }
        />
        <Tab value="timetable" label="Timetable" />
      </Tabs>

      {tab === 'overview' &&
        (data.stats ? (
          <ClassStatCards stats={data.stats} />
        ) : (
          <Paper variant="outlined">
            <EmptyState
              title="No statistics available"
              description="The server returned the class without its figures."
            />
          </Paper>
        ))}

      {tab === 'students' &&
        (students.length === 0 ? (
          <Paper variant="outlined">
            <EmptyState
              title="No students in this class"
              description="Students are assigned to a class when they are registered, or moved here from the Students module."
            />
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Roll</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Father</TableCell>
                  <TableCell>Admitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id} hover>
                    <TableCell>{student.rollNumber ?? '—'}</TableCell>
                    <TableCell>{fullName(student)}</TableCell>
                    <TableCell>{student.studentId}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{student.email}</Typography>
                      {student.phoneNumber && (
                        <Typography variant="caption" color="text.secondary">
                          {student.phoneNumber}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{student.fatherName ?? '—'}</TableCell>
                    <TableCell>{dateOrDash(student.admissionDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ))}

      {tab === 'timetable' && <ClassTimetableView classId={classId} />}

      <ClassFormDialog open={editOpen} editing={info} onClose={() => setEditOpen(false)} />
    </Box>
  )
}
