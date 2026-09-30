import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
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
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useCan, useModulePermissions } from '@/features/auth/permissions'
import { useGetSubjectsQuery } from '@/features/subjects/subjectsApi'
import { getErrorMessage } from '@/lib/serverErrors'
import { PAGE } from '@/types/enums'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { TeacherFormDialog } from '../components/TeacherFormDialog'
import { useDeleteTeacherMutation, useGetTeachersQuery } from '../teachersApi'
import type { TeacherRow } from '../types'

/**
 * Searched in the browser, not on the server.
 *
 * `sp_GetTeachersWithDetails` takes only `@SubjectId` -- no page, no page size, no search
 * term -- so the whole active staff arrives in one array and filtering it here is both the
 * only option and the better one: it is instant, and it needs no debounce.
 */
function matchesSearch(row: TeacherRow, needle: string): boolean {
  if (needle === '') return true
  const haystack = [
    row.firstName,
    row.lastName,
    row.employeeId,
    row.username,
    row.email,
    row.phoneNumber ?? '',
    row.subject ?? '',
    row.subjectNames ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function moneyOrDash(amount: number | null): string {
  if (amount === null) return '—'
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TeacherListPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModulePermissions('Teachers')
  const canViewSubjects = useCan('Subjects', 'View')

  const [subjectId, setSubjectId] = useState<'all' | number>('all')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<TeacherRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TeacherRow | null>(null)

  const { data: subjects, isLoading: loadingSubjects } = useGetSubjectsQuery(
    { isActive: true, page: 1, pageSize: PAGE.maxSize },
    { skip: !canViewSubjects },
  )

  // The subject filter is the one thing the procedure does, so it stays on the server --
  // it filters on the link table, which the rows only carry as joined-up names.
  const { data, isLoading, isFetching, error, refetch } = useGetTeachersQuery(
    subjectId === 'all' ? undefined : { subjectId },
  )

  const [deleteTeacher, { isLoading: deleting }] = useDeleteTeacherMutation()

  /**
   * Salary is on every row of this response and the endpoint is Admin **or Teacher**, so
   * any teacher can already read a colleague's pay by calling the API directly. Gating the
   * column on `Teachers:Edit` -- which only Admin holds in the seeded grid -- keeps it off
   * the screen for the rest; the API gap itself is recorded in FRONTEND_PLAN.md §7.
   */
  const showSalary = canEdit

  const needle = search.trim().toLowerCase()
  const rows = useMemo(
    () => (data ?? []).filter((row) => matchesSearch(row, needle)),
    [data, needle],
  )

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteTeacher({ teacherId: pendingDelete.id, userId: pendingDelete.userId }).unwrap()
      dispatch(toastSuccess(`${pendingDelete.firstName} ${pendingDelete.lastName} deactivated.`))
      setPendingDelete(null)
    } catch (caught) {
      // The two refusals -- still class teacher of an active class, or has attendance
      // history -- have different remedies, so the message has to be shown as sent.
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the teacher.')))
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<TeacherRow>[]>(() => {
    const defined: GridColDef<TeacherRow>[] = [
      {
        field: 'firstName',
        headerName: 'Name',
        flex: 1,
        minWidth: 200,
        // Sorted and searched on the full name rather than the first, since that is what
        // the cell shows.
        valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`.trim(),
        renderCell: ({ row }) => (
          <Stack sx={{ py: 0.5 }}>
            <Link component={RouterLink} to={`/teachers/${row.userId}`} underline="hover">
              {`${row.firstName} ${row.lastName}`.trim() || row.username}
            </Link>
            <Typography variant="caption" color="text.secondary">
              {row.username}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'employeeId',
        headerName: 'Employee no.',
        width: 140,
        renderCell: ({ row }) => (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.employeeId}
          </Typography>
        ),
      },
      {
        field: 'subjectNames',
        headerName: 'Subjects',
        flex: 1,
        minWidth: 200,
        sortable: false,
        renderCell: ({ row }) =>
          row.subjectNames ? (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, py: 0.75 }}>
              {row.subjectNames.split(',').map((name) => (
                <Chip key={name} size="small" label={name.trim()} variant="outlined" />
              ))}
            </Stack>
          ) : (
            // Not a cosmetic gap: without a subject they cannot be assigned to teach one in
            // a class, and so cannot enter marks at all.
            <Typography variant="body2" color="text.disabled">
              None assigned
            </Typography>
          ),
      },
      {
        field: 'qualification',
        headerName: 'Qualification',
        width: 170,
        renderCell: ({ row }) => row.qualification ?? '—',
      },
      {
        field: 'experience',
        headerName: 'Experience',
        width: 110,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) =>
          // 0 is a real answer -- a newly qualified teacher -- and null means nobody
          // recorded it. They must not render the same.
          row.experience === null ? '—' : `${row.experience} yr`,
      },
      {
        field: 'email',
        headerName: 'Contact',
        flex: 1,
        minWidth: 190,
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
    ]

    if (showSalary) {
      defined.push({
        field: 'salary',
        headerName: 'Salary',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => moneyOrDash(row.salary),
      })
    }

    defined.push({
      field: 'actions',
      headerName: '',
      width: 130,
      sortable: false,
      filterable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="Profile">
            <IconButton size="small" onClick={() => void navigate(`/teachers/${row.userId}`)}>
              <PersonOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {canEdit && (
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => {
                  setEditing(row)
                  setFormOpen(true)
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {canDelete && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => setPendingDelete(row)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    })

    return defined
  }, [canEdit, canDelete, showSalary, navigate])

  const addButton = (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => {
        setEditing(null)
        setFormOpen(true)
      }}
    >
      Register teacher
    </Button>
  )

  const filtersApplied = subjectId !== 'all' || needle !== ''

  return (
    <Box>
      <PageHeader
        title="Teachers"
        subtitle="The teaching staff. Registering a teacher creates their login; what they can mark and grade is decided by the subjects and classes assigned on their profile."
        actions={<Can module="Teachers" action="Create">{addButton}</Can>}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search"
            size="small"
            value={search}
            placeholder="Name, employee number, username, email, phone or subject"
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 280, flex: 1 }}
            helperText="Filtered in the browser — the list endpoint takes no search term"
          />
          <TextField
            select
            label="Subject"
            size="small"
            value={subjectId}
            onChange={(event) => {
              const raw = event.target.value
              setSubjectId(raw === 'all' ? 'all' : Number(raw))
            }}
            disabled={!canViewSubjects || loadingSubjects}
            sx={{ minWidth: 220 }}
            helperText={
              canViewSubjects
                ? loadingSubjects
                  ? 'Loading…'
                  : 'Who is assigned to teach it'
                : 'Needs permission to view subjects'
            }
          >
            <MenuItem value="all">All subjects</MenuItem>
            {(subjects?.items ?? []).map((subject) => (
              <MenuItem key={subject.id} value={subject.id}>
                {subject.subjectName} (grade {subject.grade})
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {/* No status filter, and that is the endpoint's doing: the procedure hard-filters
            Teachers.IsActive = 1 AND Users.IsActive = 1, so a deactivated teacher is absent
            rather than greyed out, and there is nothing to filter by. */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Active staff only. A deleted teacher is not listed anywhere, and there is no way to
          bring one back from the app.
        </Typography>

        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ClientDataGrid<TeacherRow>
        rows={rows}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        rowHeight={62}
        emptyTitle={filtersApplied ? 'No teachers match these filters' : 'No teachers yet'}
        emptyDescription={
          filtersApplied
            ? 'Try clearing the search, or choosing another subject — the subject filter matches only teachers actually assigned to it.'
            : 'Register the first teacher. Classes need one before they can have a class teacher, and marks cannot be entered without one.'
        }
        emptyAction={canCreate && !filtersApplied ? addButton : undefined}
      />

      <TeacherFormDialog
        open={formOpen}
        editing={editing}
        showSalary={showSalary}
        onClose={() => setFormOpen(false)}
        // Straight to the new profile: assigning subjects and classes is the next thing to
        // do, and both live there.
        onRegistered={(result) => void navigate(`/teachers/${result.userId}`)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this teacher?"
        destructive
        busy={deleting}
        confirmLabel="Delete"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingDelete?.firstName} {pendingDelete?.lastName} and their login are
              deactivated, along with their subjects, their subject-in-class assignments and
              their timetable. Any signed-in session is revoked.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The server refuses this outright in two cases: while they are still the class
              teacher of an active class — reassign it first — and if they have ever taken a
              register, because that history has to stay attributed to whoever took it.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              There is no reactivate endpoint for teachers, so this cannot be undone from the
              app. The record and its employee number are kept.
            </Typography>
          </Stack>
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  )
}
