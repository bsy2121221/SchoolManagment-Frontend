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
import { useModulePermissions } from '@/features/auth/permissions'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { ParentFormDialog } from '../components/ParentFormDialog'
import { useDeleteParentMutation, useGetParentsQuery } from '../parentsApi'
import { childrenNameList } from '../types'
import type { ParentRow } from '../types'

/**
 * Searched in the browser, not on the server.
 *
 * `sp_GetAllParents` takes `@SchoolId` and `@IncludeInactive` -- no page, no page size, no
 * search term -- so every parent arrives in one array and filtering it here is both the
 * only option and the better one: it is instant, and it needs no debounce.
 *
 * The children are searchable too, which is how "who is Aarav's father" gets answered from
 * this screen rather than from the student's profile.
 */
function matchesSearch(row: ParentRow, needle: string): boolean {
  if (needle === '') return true
  const haystack = [
    row.firstName,
    row.lastName,
    row.username,
    row.email,
    row.phoneNumber ?? '',
    row.occupation ?? '',
    row.childrenNames ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function moneyOrDash(amount: number | null): string {
  // 0 is a real figure -- a parent with no income -- and null is nobody having recorded
  // one. They must not render the same.
  if (amount === null) return '—'
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ParentListPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModulePermissions('Parents')

  const [status, setStatus] = useState<'active' | 'all'>('active')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<ParentRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ParentRow | null>(null)

  // The status filter is the one thing the procedure does, so it stays on the server.
  // Undefined rather than `{ includeInactive: false }` for the default, so the two choices
  // do not become two cache entries holding the same rows.
  const { data, isLoading, isFetching, error, refetch } = useGetParentsQuery(
    status === 'all' ? { includeInactive: true } : undefined,
  )

  const [deleteParent, { isLoading: deleting }] = useDeleteParentMutation()

  const needle = search.trim().toLowerCase()
  const rows = useMemo(
    () => (data ?? []).filter((row) => matchesSearch(row, needle)),
    [data, needle],
  )

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteParent({ parentId: pendingDelete.id, userId: pendingDelete.userId }).unwrap()
      dispatch(toastSuccess(`${pendingDelete.firstName} ${pendingDelete.lastName} deactivated.`))
      setPendingDelete(null)
    } catch (caught) {
      // The refusal here is "has recorded fee payments", and the remedy -- leave the account
      // deactivated instead -- is only actionable if the admin is told.
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the parent.')))
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<ParentRow>[]>(() => {
    const defined: GridColDef<ParentRow>[] = [
      {
        field: 'firstName',
        headerName: 'Name',
        flex: 1,
        minWidth: 210,
        // Sorted and searched on the full name rather than the first, since that is what
        // the cell shows.
        valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`.trim(),
        renderCell: ({ row }) => (
          <Stack sx={{ py: 0.5 }}>
            <Link component={RouterLink} to={`/parents/${row.userId}`} underline="hover">
              {`${row.firstName} ${row.lastName}`.trim() || row.username}
            </Link>
            <Typography variant="caption" color="text.secondary">
              {row.username}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'childrenCount',
        headerName: 'Children',
        flex: 1.2,
        minWidth: 220,
        renderCell: ({ row }) => {
          const names = childrenNameList(row)
          if (names.length === 0) {
            // Not a cosmetic gap: a parent with nobody attached can sign in and will find
            // every screen empty, which is the commonest support call in this module.
            return (
              <Typography variant="body2" color="text.disabled">
                Nobody attached
              </Typography>
            )
          }
          return (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, py: 0.75 }}>
              {names.map((name) => (
                <Chip key={name} size="small" label={name} variant="outlined" />
              ))}
            </Stack>
          )
        },
      },
      {
        field: 'email',
        headerName: 'Contact',
        flex: 1,
        minWidth: 200,
        renderCell: ({ row }) => (
          <Stack sx={{ py: 0.5 }}>
            <Typography variant="body2">{row.email}</Typography>
            {row.phoneNumber ? (
              <Typography variant="caption" color="text.secondary">
                {row.phoneNumber}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.disabled">
                No phone number
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'occupation',
        headerName: 'Occupation',
        width: 160,
        renderCell: ({ row }) => row.occupation ?? '—',
      },
      {
        field: 'annualIncome',
        headerName: 'Annual income',
        width: 150,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => moneyOrDash(row.annualIncome),
      },
    ]

    // Only worth a column when deactivated parents can actually be in the grid.
    if (status === 'all') {
      defined.push({
        field: 'isActive',
        headerName: 'Status',
        width: 120,
        renderCell: ({ row }) =>
          row.isActive ? (
            <Chip size="small" label="Active" color="success" variant="outlined" />
          ) : (
            <Chip size="small" label="Deactivated" color="default" variant="outlined" />
          ),
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
            <IconButton size="small" onClick={() => void navigate(`/parents/${row.userId}`)}>
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
            // A deactivated parent cannot be deactivated again, and there is no endpoint
            // that brings one back -- so the button goes rather than misleading.
            <Tooltip title={row.isActive ? 'Delete' : 'Already deactivated'}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={!row.isActive}
                  onClick={() => setPendingDelete(row)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      ),
    })

    return defined
  }, [canEdit, canDelete, status, navigate])

  const addButton = (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => {
        setEditing(null)
        setFormOpen(true)
      }}
    >
      Register parent
    </Button>
  )

  const filtersApplied = status === 'all' || needle !== ''

  return (
    <Box>
      <PageHeader
        title="Parents"
        subtitle="Parent and guardian accounts. Registering a parent creates their login; what they can see is decided entirely by the children attached to them on their profile."
        actions={<Can module="Parents" action="Create">{addButton}</Can>}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search"
            size="small"
            value={search}
            placeholder="Name, username, email, phone, occupation or a child's name"
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 300, flex: 1 }}
            helperText="Filtered in the browser — the list endpoint takes no search term"
          />
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(event) => setStatus(event.target.value === 'all' ? 'all' : 'active')}
            sx={{ minWidth: 220 }}
            helperText="Deactivated parents are otherwise unreachable"
          >
            <MenuItem value="active">Active only</MenuItem>
            <MenuItem value="all">Include deactivated</MenuItem>
          </TextField>
        </Stack>

        {/* Worth saying plainly, because the delete button implies otherwise: deleting a
            parent deactivates them, and no endpoint brings them back. "Include
            deactivated" is the only way to see one again. */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Deleting a parent deactivates their account and detaches their children. There is no
          reactivate endpoint, so the record can be found again but not revived from the app.
        </Typography>

        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ClientDataGrid<ParentRow>
        rows={rows}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        rowHeight={62}
        emptyTitle={filtersApplied ? 'No parents match these filters' : 'No parents yet'}
        emptyDescription={
          filtersApplied
            ? 'Try clearing the search. The search covers the children’s names too, so a spelling that does not match anything here will not match a child either.'
            : 'Register the first parent. Until a parent exists and is attached to a student, nobody outside the school can see that student’s attendance, results or fees.'
        }
        emptyAction={canCreate && !filtersApplied ? addButton : undefined}
      />

      <ParentFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        // Straight to the new profile: attaching the children is the next thing to do, and
        // that is where it lives.
        onRegistered={(result) => void navigate(`/parents/${result.userId}`)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this parent?"
        destructive
        busy={deleting}
        confirmLabel="Delete"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingDelete?.firstName} {pendingDelete?.lastName} and their login are
              deactivated, and the {pendingDelete?.childrenCount === 1 ? 'child' : 'children'}{' '}
              attached to them are detached. Any signed-in session is revoked.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The server refuses this outright for a parent who has recorded a fee payment: that
              money has to stay attributed to whoever paid it. Leave the account deactivated
              instead — an edit is still possible afterwards.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              There is no reactivate endpoint for parents, so this cannot be undone from the app.
              The student records themselves are untouched.
            </Typography>
          </Stack>
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  )
}
