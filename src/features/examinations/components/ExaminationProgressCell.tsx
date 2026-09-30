import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { markingProgress } from '../examinationRules'
import type { ExaminationRow } from '../types'

/**
 * The marking-progress cell: "12 of 30 marked", with a bar.
 *
 * Its own component because the three states it has to distinguish are more than a
 * `renderCell` arrow reads well with, and one of them is easy to get wrong. A class with
 * nobody in it has nothing to mark, which is neither complete nor 0% done — showing a full
 * green bar for "0 of 0" would report an unmarked exam as finished, and an empty grey bar
 * would suggest work that does not exist.
 */
export function ExaminationProgressCell({ row }: { row: ExaminationRow }) {
  const { entered, total, percent, complete } = markingProgress(row)

  if (total === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        No students on roll
      </Typography>
    )
  }

  return (
    <Stack spacing={0.5} sx={{ width: '100%', py: 1 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        {complete && <CheckCircleOutlinedIcon fontSize="small" color="success" />}
        <Typography variant="body2" color={complete ? 'success.main' : 'text.primary'}>
          {entered} of {total} marked
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={complete ? 'success' : 'primary'}
        sx={{ height: 5, borderRadius: 1 }}
      />
    </Stack>
  )
}
