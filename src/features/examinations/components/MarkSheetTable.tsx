import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import type { QueryError } from '@/lib/serverErrors'
import { formatMarks, formatPercentage, markStatus, markTone } from '../examinationRules'
import type { MarkSheetRow } from '../types'

const STATUS_LABEL = {
  unmarked: 'Not marked',
  pass: 'Pass',
  fail: 'Fail',
} as const

interface MarkSheetTableProps {
  rows: readonly MarkSheetRow[] | undefined
  loading: boolean
  error?: QueryError
  onRetry?: () => void
}

/**
 * The mark sheet for one examination: the whole class, ranked.
 *
 * Everything in here follows from the sheet being driven from `Students` rather than from
 * `Results`, so an unmarked student is a row with nulls in it rather than an absent row.
 *
 * The status column goes through `markStatus`, never through `row.isPass`. The procedure
 * computes that field as `ObtainedMarks >= @PassingMarks`, and `NULL >= 40` is unknown in SQL,
 * so an unmarked student arrives as `false` — binding the column straight to it would print
 * "Fail" next to every student nobody has marked yet, on a sheet that gets shown to parents.
 *
 * The rank column is blanked for those students for a related reason. They are sorted to the
 * end deliberately, but they all share one rank, so the number is an artefact of the window
 * function rather than a position anyone holds.
 */
export function MarkSheetTable({ rows, loading, error, onRetry }: MarkSheetTableProps) {
  const columns = useMemo<GridColDef<MarkSheetRow>[]>(
    () => [
      {
        field: 'classRank',
        headerName: 'Rank',
        width: 90,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) =>
          row.obtainedMarks === null ? (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.classRank}
            </Typography>
          ),
      },
      {
        field: 'rollNumber',
        headerName: 'Roll',
        width: 90,
        renderCell: ({ row }) =>
          row.rollNumber ? (
            <Typography variant="body2">{row.rollNumber}</Typography>
          ) : (
            // The column is nullable: a student can be enrolled before a roll number is set.
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: 'firstName',
        headerName: 'Student',
        flex: 1,
        minWidth: 200,
        valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`,
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 1 }}>
            {/* A URL to Results' report card. A plain link, not an import: this feature does not
                depend on that one, and the reverse direction (Results reading this module's
                examination list) is the only real coupling between them. */}
            <Link
              component={RouterLink}
              to={`/results/student/${row.studentId}`}
              variant="body2"
              underline="hover"
            >
              {row.firstName} {row.lastName}
            </Link>
            <Typography variant="caption" color="text.secondary">
              {row.studentNumber}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'obtainedMarks',
        headerName: 'Marks',
        width: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            color={row.obtainedMarks === null ? 'text.disabled' : undefined}
          >
            {formatMarks(row)}
          </Typography>
        ),
      },
      {
        field: 'percentage',
        headerName: 'Percentage',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            color={row.percentage === null ? 'text.disabled' : undefined}
          >
            {row.percentage === null ? '—' : formatPercentage(row.percentage)}
          </Typography>
        ),
      },
      {
        field: 'grade',
        headerName: 'Grade',
        width: 90,
        renderCell: ({ row }) =>
          row.grade ? (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.grade}
            </Typography>
          ) : (
            // Optional even on a marked result: fn_CalculateGrade fills it on entry, but a
            // result written before the thresholds existed can have marks and no letter.
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          ),
      },
      {
        field: 'isPass',
        headerName: 'Result',
        width: 130,
        // Sorted through the same function that renders it, so ordering by this column groups
        // the three states rather than sorting a boolean that lies for unmarked students.
        valueGetter: (_value, row) => markStatus(row),
        renderCell: ({ row }) => {
          const status = markStatus(row)
          const tone = markTone(status)
          return (
            <Chip
              size="small"
              label={STATUS_LABEL[status]}
              color={tone === 'default' ? 'default' : tone}
              variant={tone === 'default' ? 'outlined' : 'filled'}
            />
          )
        },
      },
      {
        field: 'remarks',
        headerName: 'Remarks',
        flex: 1,
        minWidth: 160,
        renderCell: ({ row }) =>
          row.remarks ? (
            <Typography variant="body2" color="text.secondary">
              {row.remarks}
            </Typography>
          ) : null,
      },
    ],
    [],
  )

  return (
    <ClientDataGrid<MarkSheetRow>
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      columns={columns}
      getRowId={(row) => row.studentId}
      autoHeight
      rowHeight={62}
      // The procedure already returns the sheet in rank order, with roll number as the
      // tiebreak, so there is no initial sort model to impose — the server's order is the
      // right one and re-sorting on mount would only ever match it.
      emptyTitle="Nobody on the roll"
      emptyDescription="This examination's class has no active students, so there is nothing to mark. Check the class roll."
    />
  )
}
