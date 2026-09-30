import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { formatDate } from '@/lib/dates'
import { formatPercent, percentTone } from '../resultRules'
import type { SubjectBreakdown } from '../resultRules'

/**
 * The report card grouped by subject, one expandable panel each.
 *
 * Grouped rather than listed flat because a report card is read per subject — "how is he doing in
 * maths" — while the endpoint returns marks in date order across all subjects. The panel header
 * carries the subject's own average so the question is answered without expanding anything.
 *
 * Every percentage here is the server's, not recomputed: `sp_GetStudentResults` and
 * `sp_GetExaminationResults` round the same mark the same way, and a client that did its own
 * division would make the report card and the mark sheet disagree on the same result.
 */
export function SubjectBreakdownTable({ groups }: { groups: readonly SubjectBreakdown[] }) {
  return (
    <Stack spacing={1}>
      {groups.map((group) => {
        const tone = percentTone(group.averagePercentage)
        return (
          <Accordion key={group.subjectId} disableGutters variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', flexWrap: 'wrap', width: '100%' }}
              >
                <Typography variant="subtitle2">{group.subjectName}</Typography>
                {group.subjectCode && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {group.subjectCode}
                  </Typography>
                )}
                <Chip
                  size="small"
                  label={formatPercent(group.averagePercentage)}
                  color={tone === 'default' ? 'default' : tone}
                />
                <Typography variant="caption" color="text.secondary">
                  {group.count} examination{group.count === 1 ? '' : 's'} · {group.passed} passed
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Examination</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Marks</TableCell>
                    <TableCell align="right">Percentage</TableCell>
                    <TableCell>Grade</TableCell>
                    <TableCell>Outcome</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.results.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2">{row.examName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.examType} · {row.className}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(row.examDate)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {row.obtainedMarks} / {row.maxMarks}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{formatPercent(row.percentage)}</Typography>
                      </TableCell>
                      <TableCell>
                        {row.grade ? (
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.grade}
                          </Typography>
                        ) : (
                          // Possible on a real mark: the server derives the letter and returns
                          // nothing when it cannot.
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Safe to read directly, unlike the mark sheet's: this endpoint has no
                            unmarked rows, so the comparison behind it always had two operands. */}
                        <Chip
                          size="small"
                          label={row.isPass ? 'Pass' : 'Fail'}
                          color={row.isPass ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.25}>
                          {row.remarks && (
                            <Typography variant="body2" color="text.secondary">
                              {row.remarks}
                            </Typography>
                          )}
                          {row.updatedAt && (
                            // The only trace of a correction the API exposes, and worth showing on
                            // a document people query.
                            <Typography variant="caption" color="text.secondary">
                              Corrected {formatDate(row.updatedAt)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Stack>
  )
}
