import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useCan } from '@/features/auth/permissions'
import { getErrorMessage } from '@/lib/serverErrors'
import { useGetGradeThresholdsQuery } from '../settingsApi'
import type { GradeThreshold } from '../types'

/**
 * True when some band's minimum is not below the one above it. `fn_CalculateGrade` tests
 * the bands top-down and takes the first match, so a band whose floor is at or above the
 * previous one can never be awarded. Nothing on the server refuses such a scale.
 */
function hasOrderProblem(bands: readonly GradeThreshold[]): boolean {
  return bands.some((band, index) => {
    const previous = index > 0 ? bands[index - 1] : undefined
    return previous !== undefined && band.minPercentage >= previous.minPercentage
  })
}

/**
 * The grading scale *as applied*, read from `/settings/grades` rather than worked out
 * from the rows on screen. It reflects the saved values only, so it updates after a save,
 * and it shows where the function falls back to a built-in default because a threshold is
 * missing or not a number.
 *
 * That endpoint is guarded on Results:View, not Settings:View, so a role allowed to edit
 * settings but not to see results simply does not get the card.
 */
export function GradeScaleCard() {
  const canViewResults = useCan('Results', 'View')
  const { data, isLoading, error } = useGetGradeThresholdsQuery(undefined, {
    skip: !canViewResults,
  })

  if (!canViewResults) return null

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Grading scale in effect
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        A mark saved without a grade of its own is graded against these bands, highest first. A change
        applies to marks saved from then on; grades already stored are not recalculated.
      </Typography>

      {isLoading ? (
        <Stack spacing={1}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={28} />
          ))}
        </Stack>
      ) : error ? (
        <Alert severity="error">{getErrorMessage(error, 'Could not load the grading scale.')}</Alert>
      ) : data && data.length > 0 ? (
        <Stack spacing={1.5}>
          {hasOrderProblem(data) && (
            <Alert severity="warning">
              The thresholds are not in descending order, so at least one grade can never be
              awarded. Each grade&apos;s minimum should be lower than the grade above it.
            </Alert>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Grade</TableCell>
                <TableCell align="right">From</TableCell>
                <TableCell>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((band) => (
                <TableRow key={band.grade}>
                  <TableCell sx={{ fontWeight: 600 }}>{band.grade}</TableCell>
                  <TableCell align="right">{`${band.minPercentage}%`}</TableCell>
                  <TableCell>
                    {band.settingKey === null ? (
                      <Typography variant="body2" color="text.secondary">
                        Anything below
                      </Typography>
                    ) : band.isDefault ? (
                      <Chip size="small" color="warning" variant="outlined" label="Built-in default" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {band.settingKey}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No grading scale was returned.
        </Typography>
      )}
    </Paper>
  )
}
