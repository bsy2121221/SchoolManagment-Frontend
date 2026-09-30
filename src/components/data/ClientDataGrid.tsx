import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { DataGrid } from '@mui/x-data-grid'
import type { DataGridProps, GridValidRowModel } from '@mui/x-data-grid'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { QueryError } from '@/lib/serverErrors'
import { PAGE } from '@/types/enums'

interface ClientDataGridProps<R extends GridValidRowModel>
  extends Omit<DataGridProps<R>, 'rows' | 'loading' | 'paginationMode' | 'pageSizeOptions'> {
  rows: readonly R[] | undefined
  loading?: boolean
  error?: QueryError
  onRetry?: () => void
  /** Shown in place of the grid when there are no rows to show. */
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
}

/**
 * The counterpart to `ServerDataGrid`, for endpoints that return the whole collection in
 * one response.
 *
 * Not every list endpoint is paginated. `GET /api/Teachers` returns every active teacher
 * in the school in one array -- `sp_GetTeachersWithDetails` takes no page, no page size
 * and no search term -- so there is no ±1 conversion to make and nothing to ask the
 * server for. Handing that array to `ServerDataGrid` would be worse than useless: it
 * would claim `rowCount` was the length of the page it was given and then refuse to sort,
 * because server-side sorting is a thing this endpoint cannot do.
 *
 * So the differences from `ServerDataGrid` are all deliberate:
 *
 *  - Paging, sorting and filtering are the grid's own, because the browser genuinely
 *    holds every row. Sorting here sorts everything, which is exactly what it cannot do
 *    in server mode.
 *  - There is no `value`/`onChange` page state to thread through a caller.
 *
 * Error and empty are rendered *instead of* the grid, as there: an empty table after a
 * failed request is indistinguishable from a school with no teachers.
 */
export function ClientDataGrid<R extends GridValidRowModel>({
  rows,
  loading = false,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  ...gridProps
}: ClientDataGridProps<R>) {
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  // `rows` is undefined, not [], until a response has arrived.
  if (!loading && rows && rows.length === 0) {
    return (
      <Paper variant="outlined">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </Paper>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <DataGrid<R>
        rows={rows ?? []}
        loading={loading}
        pageSizeOptions={PAGE.sizeOptions}
        initialState={{
          pagination: { paginationModel: { page: 0, pageSize: PAGE.defaultSize } },
        }}
        disableRowSelectionOnClick
        disableColumnMenu
        sx={{
          bgcolor: 'background.paper',
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        }}
        {...gridProps}
      />
    </Box>
  )
}
