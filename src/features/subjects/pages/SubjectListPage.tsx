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
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
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
import { SubjectFormDialog } from '../components/SubjectFormDialog'
import {
  useDeleteSubjectMutation,
  useGetSubjectsQuery,
  useUpdateSubjectStatusMutation,
} from '../subjectsApi'
import type { SubjectRow } from '../types'

/** The `isActive` filter. Held as a string because it drives a `<TextField select>`. */
type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_PARAM: Record<StatusFilter, boolean | undefined> = {
  all: undefined,
  active: true,
  inactive: false,
}

export default function SubjectListPage() {
  const dispatch = useAppDispatch()
  const { canCreate, canEdit, canDelete } = useModulePermissions('Subjects')

  const [pageState, setPageState] = useState<ServerPage>(FIRST_PAGE)
  const [grade, setGrade] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')

  const [editing, setEditing] = useState<SubjectRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SubjectRow | null>(null)

  const { data, isLoading, isFetching, error, refetch } = useGetSubjectsQuery({
    // The procedure reads an empty grade as "no filter", but sending the empty string at
    // all is noise in the query string.
    grade: grade.trim() || undefined,
    isActive: STATUS_PARAM[status],
    page: pageState.page,
    pageSize: pageState.pageSize,
  })

  const [updateStatus, { isLoading: togglingStatus }] = useUpdateSubjectStatusMutation()
  const [deleteSubject, { isLoading: deleting }] = useDeleteSubjectMutation()

  const handleToggleStatus = async (row: SubjectRow) => {
    try {
      await updateStatus({ subjectId: row.id, isActive: !row.isActive }).unwrap()
      dispatch(
        toastSuccess(`${row.subjectName} ${row.isActive ? 'deactivated' : 'reactivated'}.`),
      )
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not change the subject status.')))
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteSubject(pendingDelete.id).unwrap()
      dispatch(toastSuccess(`${pendingDelete.subjectName} deleted.`))
      setPendingDelete(null)
    } catch (caught) {
      // The API names the blocker -- an active examination on this subject -- and that
      // needs the user to go and deal with the examination, so the message is the point.
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the subject.')))
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<SubjectRow>[]>(
    () => [
      { field: 'subjectName', headerName: 'Subject', flex: 1, minWidth: 200 },
      {
        field: 'subjectCode',
        headerName: 'Code',
        width: 140,
        renderCell: ({ row }) =>
          row.subjectCode ? (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {row.subjectCode}
            </Typography>
          ) : (
            // The column allows NULL for rows that predate sp_CreateSubject; every write
            // path requires a code, so editing such a row fixes it.
            <Typography variant="body2" color="text.disabled">
              None
            </Typography>
          ),
      },
      { field: 'grade', headerName: 'Grade', width: 100 },
      {
        field: 'isActive',
        headerName: 'Status',
        width: 120,
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
        width: 130,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            {canEdit && (
              <>
                {/* The procedure only updates active rows, so editing an inactive subject
                    would come back "Subject not found in this school". Saying why here is
                    better than letting the dialog fail on submit. */}
                <Tooltip title={row.isActive ? 'Edit' : 'Reactivate it before editing'}>
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
                <Tooltip title={row.isActive ? 'Deactivate' : 'Reactivate'}>
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
      Add subject
    </Button>
  )

  const filtersApplied = Boolean(grade.trim()) || status !== 'active'

  return (
    <Box>
      <PageHeader
        title="Subjects"
        subtitle="What is taught in each grade. Examinations, results and the timetable are all built on these."
        actions={<Can module="Subjects" action="Create">{addButton}</Can>}
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
            helperText="Must match the grade exactly, as typed on the subject"
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
            <MenuItem value="inactive">Inactive only</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </TextField>
        </Stack>
        {/* A thin progress line rather than swapping the grid out: refetching a filter
            should not make the rows the user is reading disappear. */}
        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ServerDataGrid<SubjectRow>
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
        emptyTitle={filtersApplied ? 'No subjects match these filters' : 'No subjects yet'}
        emptyDescription={
          filtersApplied
            ? 'Try clearing the grade or widening the status filter.'
            : 'A new school starts with a seeded list; add the ones this school actually teaches.'
        }
        emptyAction={canCreate && !filtersApplied ? addButton : undefined}
      />

      <SubjectFormDialog open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this subject?"
        destructive
        busy={deleting}
        confirmLabel="Delete"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingDelete?.subjectName} will be removed from the subject list. Student
              enrolments, teacher qualifications and timetable periods for it are
              deactivated with it.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The record is kept, so past examinations and results stay intact — but the
              code {pendingDelete?.subjectCode ?? ''} stays taken. Creating a subject with
              that code again brings this one back rather than adding another.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              To stop it being taught without unpicking any of that, deactivate it instead.
            </Typography>
          </Stack>
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  )
}
