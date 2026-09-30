import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { useModulePermissions } from '@/features/auth/permissions'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { formatMoney } from '../feeRules'
import { useDeleteFeeTypeMutation, useGetFeeTypesQuery } from '../feesApi'
import type { FeeType } from '../types'
import { FeeTypeFormDialog } from './FeeTypeFormDialog'

/** The price list: every active fee type, with create, edit and delete. */
export function FeeTypesTab() {
  const dispatch = useAppDispatch()
  const { canCreate, canEdit, canDelete } = useModulePermissions('Fees')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FeeType | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FeeType | null>(null)

  const { data, isLoading, error, refetch } = useGetFeeTypesQuery()
  const [deleteFeeType, { isLoading: deleting }] = useDeleteFeeTypeMutation()

  const handleDelete = async () => {
    if (!pendingDelete) return
    const { id, feeTypeName } = pendingDelete
    try {
      await deleteFeeType(id).unwrap()
      dispatch(toastSuccess(`${feeTypeName} removed from the price list.`))
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the fee type.')))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<FeeType>[]>(
    () => [
      { field: 'feeTypeName', headerName: 'Fee type', flex: 1, minWidth: 180 },
      {
        field: 'description',
        headerName: 'Description',
        flex: 2,
        minWidth: 220,
        valueGetter: (value: string | null) => value ?? '',
      },
      {
        field: 'defaultAmount',
        headerName: 'Default amount',
        type: 'number',
        width: 150,
        valueFormatter: (value: number | null) => (value === null ? '—' : formatMoney(value)),
      },
      ...(canEdit || canDelete
        ? [
            {
              field: 'actions',
              headerName: '',
              sortable: false,
              filterable: false,
              width: 110,
              align: 'right',
              renderCell: ({ row }) => (
                <Stack direction="row" spacing={0.5}>
                  {canEdit && (
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        aria-label={`Edit ${row.feeTypeName}`}
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
                      <IconButton
                        size="small"
                        aria-label={`Delete ${row.feeTypeName}`}
                        onClick={() => setPendingDelete(row)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              ),
            } satisfies GridColDef<FeeType>,
          ]
        : []),
    ],
    [canEdit, canDelete],
  )

  const addButton = canCreate ? (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => {
        setEditing(null)
        setFormOpen(true)
      }}
    >
      Add fee type
    </Button>
  ) : undefined

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          What a fee can be for. Amounts are set each time a fee is billed.
        </Typography>
        {addButton}
      </Stack>

      <ClientDataGrid
        rows={data}
        loading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        autoHeight
        emptyTitle="No fee types yet"
        emptyDescription="Add tuition, transport or whatever this school charges for, then bill it to students."
        emptyAction={addButton}
        initialState={{ sorting: { sortModel: [{ field: 'feeTypeName', sort: 'asc' }] } }}
      />

      <FeeTypeFormDialog open={formOpen} editing={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.feeTypeName ?? 'fee type'}?`}
        message="It is refused while any fee of this type is on a student's account — including fees already paid in full. Cancel the unpaid ones first."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Stack>
  )
}
