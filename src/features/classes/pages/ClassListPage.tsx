import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
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
import { Link as RouterLink } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ServerDataGrid } from '@/components/data/ServerDataGrid'
import { FIRST_PAGE } from '@/components/data/serverPage'
import type { ServerPage } from '@/components/data/serverPage'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useModulePermissions } from '@/features/auth/permissions'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import {
  useDeleteClassMutation,
  useGetClassesQuery,
  useUpdateClassStatusMutation,
} from '../classesApi'
import { ClassFormDialog } from '../components/ClassFormDialog'
import type { ClassRow } from '../types'

/** The `isActive` filter. Held as a string because it drives a `<TextField select>`. */
type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_PARAM: Record<StatusFilter, boolean | undefined> = {
  all: undefined,
  active: true,
  inactive: false,
}

export default function ClassListPage() {
  const dispatch = useAppDispatch()
  const { canCreate, canEdit, canDelete } = useModulePermissions('Classes')

  const [pageState, setPageState] = useState<ServerPage>(FIRST_PAGE)
  const [grade, setGrade] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')

  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ClassRow | null>(null)

  const { data, isLoading, isFetching, error, refetch } = useGetClassesQuery({
    // The procedure treats an empty grade as "no filter", but sending the empty string
    // at all is noise in the query string.
    grade: grade.trim() || undefined,
    isActive: STATUS_PARAM[status],
    page: pageState.page,
    pageSize: pageState.pageSize,
  })

  const [updateStatus, { isLoading: togglingStatus }] = useUpdateClassStatusMutation()
  const [deleteClass, { isLoading: deleting }] = useDeleteClassMutation()

  const handleToggleStatus = async (row: ClassRow) => {
    try {
      await updateStatus({ classId: row.id, isActive: !row.isActive }).unwrap()
      dispatch(
        toastSuccess(`${row.className} ${row.isActive ? 'suspended' : 'reactivated'}.`),
      )
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not change the class status.')))
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteClass(pendingDelete.id).unwrap()
      dispatch(toastSuccess(`${pendingDelete.className} deleted.`))
      setPendingDelete(null)
    } catch (caught) {
      // The API names the blocker -- enrolled students, recorded attendance, an active
      // examination -- and each needs a different action, so the message is the point.
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the class.')))
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<ClassRow>[]>(
    () => [
      {
        field: 'className',
        headerName: 'Class',
        flex: 1,
        minWidth: 160,
        renderCell: ({ row }) => (
          <Link component={RouterLink} to={`/classes/${row.id}`} underline="hover">
            {row.className}
          </Link>
        ),
      },
      { field: 'grade', headerName: 'Grade', width: 90 },
      { field: 'section', headerName: 'Section', width: 90 },
      {
        field: 'classTeacherName',
        headerName: 'Class teacher',
        flex: 1,
        minWidth: 170,
        renderCell: ({ row }) =>
          row.classTeacherName ?? (
            <Typography variant="body2" color="text.disabled">
              Not assigned
            </Typography>
          ),
      },
      {
        field: 'totalStudents',
        headerName: 'Students',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        // "31 / 40" says more in the same space than a bare count, and capacity is the
        // number an admin is deciding against when they look at this column.
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            color={row.totalStudents >= row.maxStudents ? 'warning.main' : 'text.primary'}
          >
            {row.totalStudents} / {row.maxStudents}
          </Typography>
        ),
      },
      {
        field: 'isActive',
        headerName: 'Status',
        width: 110,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            label={row.isActive ? 'Active' : 'Suspended'}
            color={row.isActive ? 'success' : 'default'}
            variant={row.isActive ? 'filled' : 'outlined'}
          />
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 130,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            {canEdit && (
              <>
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
                <Tooltip title={row.isActive ? 'Suspend' : 'Reactivate'}>
                  <IconButton
                    size="small"
                    disabled={togglingStatus}
                    onClick={() => void handleToggleStatus(row)}
                  >
                    {row.isActive ? (
                      <ToggleOnOutlinedIcon fontSize="small" color="success" />
                    ) : (
                      <ToggleOffOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </>
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
      },
    ],
    // handleToggleStatus is stable enough for this list's purposes; the flags are what
    // actually change the rendered columns.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, canDelete, togglingStatus],
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
      Add class
    </Button>
  )

  const filtersApplied = Boolean(grade.trim()) || status !== 'active'

  return (
    <Box>
      <PageHeader
        title="Classes"
        subtitle="Grades and sections in this school, with their rolls and capacities."
        actions={<Can module="Classes" action="Create">{addButton}</Can>}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Grade"
            size="small"
            value={grade}
            placeholder="Any"
            onChange={(event) => {
              setGrade(event.target.value)
              // A filter change renumbers the pages, so staying on page 3 would show an
              // empty grid for a filter that matched plenty.
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              setPageState((current) => ({ ...current, page: 1 }))
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="active">Active only</MenuItem>
            <MenuItem value="inactive">Suspended only</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </TextField>
        </Stack>
        {/* A thin progress line rather than swapping the grid out: refetching a filter
            should not make the rows the user is reading disappear. */}
        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ServerDataGrid<ClassRow>
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
        emptyTitle={filtersApplied ? 'No classes match these filters' : 'No classes yet'}
        emptyDescription={
          filtersApplied
            ? 'Try clearing the grade or widening the status filter.'
            : 'Add the first class to start enrolling students.'
        }
        emptyAction={canCreate && !filtersApplied ? addButton : undefined}
      />

      <ClassFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this class?"
        destructive
        busy={deleting}
        confirmLabel="Delete"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingDelete?.className} will be removed from the class list. Its teacher
              schedules and subject assignments are deactivated with it.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The record is kept, so past attendance and results stay intact — but the
              grade and section stay taken, and a new class cannot reuse them.
            </Typography>
            {(pendingDelete?.totalStudents ?? 0) > 0 && (
              <Typography variant="body2" color="warning.main">
                This class has {pendingDelete?.totalStudents} enrolled student
                {pendingDelete?.totalStudents === 1 ? '' : 's'}. The server will refuse
                until they are moved.
              </Typography>
            )}
          </Stack>
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  )
}
