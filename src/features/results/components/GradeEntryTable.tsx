import CircleIcon from '@mui/icons-material/Circle'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import Link from '@mui/material/Link'
import {
  draftOutcome,
  formatPercent,
  isRowDirty,
  marksPercentage,
  marksProblem,
  marksProblemMessage,
} from '../resultRules'
import type { GradeDraft } from '../resultRules'
import type { GradeEntryRow } from '../types'

interface GradeEntryTableProps {
  rows: readonly GradeEntryRow[]
  drafts: Record<number, GradeDraft>
  onChange: (studentId: number, draft: GradeDraft) => void
  disabled: boolean
}

/**
 * The entry grid: one row per student on the examination's class roll.
 *
 * A plain `Table` rather than a DataGrid, for the reason Phase 9's register gives — two controlled
 * inputs per row and a live derived figure beside them is not what a DataGrid's cell editing is
 * for, and fighting it costs more than the sorting and filtering are worth on a single class.
 *
 * The rule the whole component is built around: **an unmarked student's marks box starts empty.**
 * Not at 0. The server used to coalesce the mark to 0, which meant a teacher who marked half a
 * class and saved would silently record zeros for the other half. The box being empty is what makes
 * "not marked" expressible at all, and an empty box is never submitted.
 */
export function GradeEntryTable({ rows, drafts, onChange, disabled }: GradeEntryTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 70 }}>Roll</TableCell>
            <TableCell>Student</TableCell>
            <TableCell sx={{ width: 150 }}>Marks</TableCell>
            <TableCell sx={{ width: 110 }} align="right">
              Percentage
            </TableCell>
            <TableCell sx={{ width: 110 }}>Outcome</TableCell>
            <TableCell>Remarks</TableCell>
            <TableCell sx={{ width: 110 }}>State</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const draft = drafts[row.studentId] ?? { marks: '', remarks: '' }
            const problem = marksProblem(draft.marks, row.maxMarks)
            // `empty` is not an error, so it must not paint the input red.
            const errorText =
              problem && problem.kind !== 'empty' ? marksProblemMessage(problem) : null
            const outcome = draftOutcome(row, draft)
            const percentage = problem
              ? null
              : marksPercentage(Number(draft.marks.trim()), row.maxMarks)
            const dirty = isRowDirty(row, draft)

            return (
              <TableRow key={row.studentId} hover>
                <TableCell>
                  {row.rollNumber ? (
                    <Typography variant="body2">{row.rollNumber}</Typography>
                  ) : (
                    <Tooltip title="No roll number assigned">
                      <Typography variant="body2" color="text.disabled">
                        —
                      </Typography>
                    </Tooltip>
                  )}
                </TableCell>

                <TableCell>
                  <Stack spacing={0.25}>
                    {/* A URL, not a feature import: the report card is this module's own route. */}
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
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    value={draft.marks}
                    disabled={disabled}
                    error={errorText !== null}
                    helperText={errorText ?? ` of ${row.maxMarks}`}
                    onChange={(event) =>
                      onChange(row.studentId, { ...draft, marks: event.target.value })
                    }
                    slotProps={{
                      htmlInput: {
                        inputMode: 'numeric',
                        'aria-label': `Marks for ${row.firstName} ${row.lastName}`,
                      },
                    }}
                    // Not type="number": a number input's spinner and its browser-specific
                    // handling of invalid text both make "empty" hard to hold onto, and empty is
                    // the state this screen depends on.
                    placeholder="—"
                    sx={{ width: 130 }}
                  />
                </TableCell>

                <TableCell align="right">
                  <Typography
                    variant="body2"
                    color={percentage === null ? 'text.disabled' : undefined}
                  >
                    {formatPercent(percentage)}
                  </Typography>
                </TableCell>

                <TableCell>
                  {outcome === null ? (
                    <Typography variant="body2" color="text.disabled">
                      —
                    </Typography>
                  ) : (
                    <Chip
                      size="small"
                      label={outcome === 'pass' ? 'Pass' : 'Fail'}
                      color={outcome === 'pass' ? 'success' : 'error'}
                    />
                  )}
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={draft.remarks}
                    disabled={disabled}
                    placeholder="Optional"
                    onChange={(event) =>
                      onChange(row.studentId, { ...draft, remarks: event.target.value })
                    }
                    slotProps={{
                      htmlInput: {
                        maxLength: 255,
                        'aria-label': `Remarks for ${row.firstName} ${row.lastName}`,
                      },
                    }}
                  />
                </TableCell>

                <TableCell>
                  {dirty ? (
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <CircleIcon sx={{ fontSize: 10, color: 'warning.main' }} />
                      <Typography variant="caption" color="warning.main">
                        Unsaved
                      </Typography>
                    </Stack>
                  ) : row.hasResult ? (
                    <Stack spacing={0.25}>
                      <Typography variant="caption" color="success.main">
                        Saved
                      </Typography>
                      {row.currentGrade && (
                        <Typography variant="caption" color="text.secondary">
                          Grade {row.currentGrade}
                        </Typography>
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      Not marked
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {rows.length === 0 && (
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Nobody on this class roll.
          </Typography>
        </Box>
      )}
    </TableContainer>
  )
}
