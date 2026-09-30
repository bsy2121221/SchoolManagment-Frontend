import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import MoveUpIcon from '@mui/icons-material/MoveUp'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ServerDataGrid } from '@/components/data/ServerDataGrid'
import { FIRST_PAGE } from '@/components/data/serverPage'
import type { ServerPage } from '@/components/data/serverPage'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useCan, useModulePermissions } from '@/features/auth/permissions'
import { useClassLookup } from '@/features/classes/classLookup'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { StudentFormDialog } from '../components/StudentFormDialog'
import { StudentPromoteDialog } from '../components/StudentPromoteDialog'
import { useDeleteStudentMutation, useGetStudentsQuery } from '../studentsApi'
import type { StudentRow } from '../types'

/** The `isActive` filter. Held as a string because it drives a `<TextField select>`. */
type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_PARAM: Record<StatusFilter, boolean | undefined> = {
  all: undefined,
  active: true,
  inactive: false,
}

/** Long enough not to fire a request per keystroke, short enough to feel like typing. */
const SEARCH_DEBOUNCE_MS = 400

export default function StudentListPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModulePermissions('Students')
  // The class filter reads the Classes list, which is Admin/Teacher-only.
  const canViewClasses = useCan('Classes', 'View')

  const [pageState, setPageState] = useState<ServerPage>(FIRST_PAGE)
  const [classId, setClassId] = useState<'all' | number>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [editing, setEditing] = useState<StudentRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [promoting, setPromoting] = useState<StudentRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StudentRow | null>(null)

  const { options: classOptions, isLoading: loadingClasses } = useClassLookup({
    skip: !canViewClasses,
  })

  // Debounced: the search is a server round trip across five columns, so it waits for the
  // typing to stop. The page resets with it, since a new search renumbers the pages.
  useEffect(() => {
    const timer = setTimeout(() => {
      // oxlint-disable-next-line react/set-state-in-effect
      setSearchTerm(searchInput.trim())
      // oxlint-disable-next-line react/set-state-in-effect
      setPageState((current) => ({ ...current, page: 1 }))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data, isLoading, isFetching, error, refetch } = useGetStudentsQuery({
    classId: classId === 'all' ? undefined : classId,
    isActive: STATUS_PARAM[status],
    searchTerm: searchTerm || undefined,
    page: pageState.page,
    pageSize: pageState.pageSize,
  })

  const [deleteStudent, { isLoading: deleting }] = useDeleteStudentMutation()

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteStudent(pendingDelete.id).unwrap()
      dispatch(toastSuccess(`${pendingDelete.firstName} ${pendingDelete.lastName} deactivated.`))
      setPendingDelete(null)
    } catch (caught) {
      // Attendance, result or fee history blocks the delete outright, and the message says
      // so along with what to do instead. Showing it is the whole point.
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the student.')))
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<StudentRow>[]>(
    () => [
      {
        field: 'rollNumber',
        headerName: 'Roll',
        width: 90,
        renderCell: ({ row }) => row.rollNumber ?? '—',
      },
      {
        field: 'firstName',
        headerName: 'Name',
        flex: 1,
        minWidth: 200,
        renderCell: ({ row }) => (
          <Stack sx={{ py: 0.5 }}>
            <Link component={RouterLink} to={`/students/${row.id}`} underline="hover">
              {`${row.firstName} ${row.lastName}`.trim() || row.username}
            </Link>
            <Typography variant="caption" color="text.secondary">
              {row.username}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'studentId',
        headerName: 'Admission no.',
        width: 150,
        renderCell: ({ row }) => (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.studentId}
          </Typography>
        ),
      },
      {
        field: 'className',
        headerName: 'Class',
        width: 130,
        renderCell: ({ row }) =>
          row.className ?? (
            // The column is nullable: a student can be admitted without being placed.
            <Typography variant="body2" color="text.disabled">
              Unplaced
            </Typography>
          ),
      },
      {
        field: 'email',
        headerName: 'Contact',
        flex: 1,
        minWidth: 200,
        renderCell: ({ row }) => (
          <Stack sx={{ py: 0.5 }}>
            <Typography variant="body2">{row.email}</Typography>
            {row.phoneNumber && (
              <Typography variant="caption" color="text.secondary">
                {row.phoneNumber}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'isActive',
        headerName: 'Status',
        width: 110,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            label={row.isActive ? 'Active' : 'Inactive'}
            color={row.isActive ? 'success' : 'default'}
            variant={row.isActive ? 'filled' : 'outlined'}
          />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 170,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            <Tooltip title="Profile">
              <IconButton size="small" onClick={() => void navigate(`/students/${row.id}`)}>
                <PersonOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {canEdit && (
              <>
                {/* sp_UpdateStudent and sp_PromoteStudent both require an active student and
                    answer "Student not found in this school" otherwise. There is no
                    reactivate endpoint, so saying why here is all we can do. */}
                <Tooltip title={row.isActive ? 'Edit' : 'Inactive students cannot be edited'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!row.isActive}
                      onClick={() => {
                        setEditing(row)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={row.isActive ? 'Promote to another class' : 'Inactive'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!row.isActive}
                      onClick={() => setPromoting(row)}
                    >
                      <MoveUpIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}

            {canDelete && row.isActive && (
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => setPendingDelete(row)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [canEdit, canDelete, navigate],
  )

  const addButton = (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => {
        setEditing(null)
        setFormOpen(true)
      }}
    >
      Register student
    </Button>
  )

  const filtersApplied = classId !== 'all' || status !== 'active' || searchTerm !== ''

  return (
    <Box>
      <PageHeader
        title="Students"
        subtitle="Everyone on the roll. Registering a student creates their login; attendance, results and fees are all recorded against these records."
        actions={<Can module="Students" action="Create">{addButton}</Can>}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search"
            size="small"
            value={searchInput}
            placeholder="Name, email, username, admission or roll number"
            onChange={(event) => setSearchInput(event.target.value)}
            sx={{ minWidth: 280, flex: 1 }}
            helperText="Matched by the server across all five"
          />
          <TextField
            select
            label="Class"
            size="small"
            value={classId}
            onChange={(event) => {
              const raw = event.target.value
              setClassId(raw === 'all' ? 'all' : Number(raw))
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            disabled={!canViewClasses || loadingClasses}
            sx={{ minWidth: 220 }}
            helperText={
              canViewClasses
                ? loadingClasses
                  ? 'Loading…'
                  : 'Active classes only'
                : 'Needs permission to view classes'
            }
          >
            <MenuItem value="all">All classes</MenuItem>
            {classOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="active">Active only</MenuItem>
            <MenuItem value="inactive">Inactive only</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </TextField>
        </Stack>
        {/* A thin progress line rather than swapping the grid out: refetching a filter
            should not make the rows the user is reading disappear. */}
        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ServerDataGrid<StudentRow>
        rows={data?.items}
        totalCount={data?.totalCount}
        value={pageState}
        onChange={setPageState}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        rowHeight={58}
        emptyTitle={filtersApplied ? 'No students match these filters' : 'No students yet'}
        emptyDescription={
          filtersApplied
            ? 'Try clearing the search, choosing another class, or widening the status filter.'
            : 'Register the first student. A class has to exist first, since the roll number is allocated from it.'
        }
        emptyAction={canCreate && !filtersApplied ? addButton : undefined}
      />

      <StudentFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        // Straight to the new profile: assigning subjects is the next thing to do, and it
        // lives there.
        onRegistered={(result) => void navigate(`/students/${result.studentId}`)}
      />

      <StudentPromoteDialog
        open={promoting !== null}
        student={promoting}
        onClose={() => setPromoting(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this student?"
        destructive
        busy={deleting}
        confirmLabel="Delete"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingDelete?.firstName} {pendingDelete?.lastName} and their login are
              deactivated, along with their subject enrolments and parent links. Any signed-in
              session is revoked.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              If attendance, results or fees have ever been recorded for them, the server will
              refuse this — that history has to stay attached to a student.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              There is no reactivate endpoint for students, so this cannot be undone from the
              app. The record and its admission number are kept.
            </Typography>
          </Stack>
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  )
}
