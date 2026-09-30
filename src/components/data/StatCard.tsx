import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { SvgIconComponent } from '@mui/icons-material'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  /**
   * A node rather than a number, so a figure the server could not compute can be
   * rendered as words. Printing `0` for a null is the single most common way a stats
   * strip lies: "0%" attendance describes a class that never turns up, not a register
   * nobody has opened.
   */
  value: ReactNode
  caption?: ReactNode
  /** A progress bar, a chip row -- anything that belongs under the caption. */
  extra?: ReactNode
  icon?: SvgIconComponent
  /** Theme colour for the icon, e.g. `primary.main`, `warning.main`. */
  iconColor?: string
}

/**
 * The one stat tile in the app.
 *
 * Extracted from the Classes stats strip when the platform dashboard needed the same
 * shape: a label, one large figure, an explanatory caption, and optional extras. Any
 * screen showing headline numbers uses this, so they stay visually identical.
 */
export function StatCard({
  label,
  value,
  caption,
  extra,
  icon: Icon,
  iconColor = 'primary.main',
}: StatCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="overline" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 600 }}>
            {value}
          </Typography>
        </Box>
        {Icon && <Icon sx={{ color: iconColor, fontSize: 22, mt: 0.5, flexShrink: 0 }} />}
      </Stack>

      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {caption}
        </Typography>
      )}
      {extra}
    </Paper>
  )
}
