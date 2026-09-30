import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { DataGrid } from '@mui/x-data-grid'
import type { DataGridProps, GridPaginationModel, GridValidRowModel } from '@mui/x-data-grid'
import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { QueryError } from '@/lib/serverErrors'
import { PAGE } from '@/types/enums'
import type { ServerPage } from './serverPage'

interface ServerDataGridProps<R extends GridValidRowModel>
  extends Omit<
    DataGridProps<R>,
    | 'rows'
    | 'rowCount'
    | 'loading'
    | 'paginationMode'
    | 'paginationModel'
    | 'onPaginationModelChange'
    | 'pageSizeOptions'
  > {
  rows: readonly R[] | undefined
  /** `PaginatedResponse.totalCount`. Undefined while the first page is in flight. */
  totalCount: number | undefined
  /** The 1-based page currently requested. */
  value: ServerPage
  onChange: (next: ServerPage) => void
  /** RTK Query's `isLoading` (first load) OR `isFetching` (page change). */
  loading?: boolean
  error?: QueryError
  onRetry?: () => void
  /** Shown in place of the grid body when the server returned zero rows. */
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
}

/**
 * The project's one adapter between `PaginatedResponse<T>` and MUI's DataGrid.
 *
 * It exists for a single reason: the API's `page` starts at 1 and the grid's starts at
 * 0. That ±1 is the kind of thing that gets fixed correctly on one screen, copied
 * wrongly onto the next, and then shows page 2's rows above a footer reading "1-20 of
 * 43". Converting in exactly one place makes the mistake unrepeatable -- callers pass
 * and receive `ServerPage`, which is always 1-based.
 *
 * It also fixes the page size the server will actually honour: pageSize is clamped to
 * `MaxPageSize = 100` server-side, so offering 250 in the dropdown would silently
 * return 100 and leave the footer claiming otherwise.
 *
 * Error and empty are rendered instead of the grid, not inside it. An empty grid after
 * a failed request is indistinguishable from a school with no classes.
 */
export function ServerDataGrid<R extends GridValidRowModel>({
  rows,
  totalCount,
  value,
  onChange,
  loading = false,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  ...gridProps
}: ServerDataGridProps<R>) {
  // The grid's own model: same page, one lower.
  const paginationModel = useMemo<GridPaginationModel>(
    () => ({ page: value.page - 1, pageSize: value.pageSize }),
    [value.page, value.pageSize],
  )

  const handleChange = useCallback(
    (model: GridPaginationModel) => {
      // Changing the page size renumbers the pages, so the row the user was looking at
      // is no longer on "their" page. Going back to page 1 is the honest response.
      const sizeChanged = model.pageSize !== value.pageSize
      onChange({ page: sizeChanged ? 1 : model.page + 1, pageSize: model.pageSize })
    },
    [onChange, value.pageSize],
  )

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  // Only once a response has arrived -- `rows` is undefined, not [], while loading.
  if (!loading && rows && rows.length === 0 && (totalCount ?? 0) === 0) {
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
        // -1 tells the grid the count is not known yet, which keeps it from
        // rendering "1-20 of 0" on the very first paint.
        rowCount={totalCount ?? -1}
        loading={loading}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handleChange}
        pageSizeOptions={PAGE.sizeOptions}
        disableRowSelectionOnClick
        disableColumnMenu
        // Server-side paging means the grid holds one page, so sorting or filtering in
        // the browser would sort one page and look like it sorted everything. Screens
        // that need either pass it to the API instead.
        disableColumnSorting
        disableColumnFilter
        sx={{
          bgcolor: 'background.paper',
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        }}
        {...gridProps}
      />
    </Box>
  )
}
