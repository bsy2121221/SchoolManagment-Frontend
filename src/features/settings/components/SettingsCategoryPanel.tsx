import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import UndoIcon from '@mui/icons-material/Undo'
import { Fragment } from 'react'
import { formatDateTime } from '@/lib/dates'
import { dataTypeOf, humaniseKey, isGradeThreshold, isTruthy, rowKey, validateValue } from '../settingRules'
import type { SettingRow } from '../types'

interface SettingsCategoryPanelProps {
  rows: readonly SettingRow[]
  /** Edited values by `rowKey`. A row absent from the map shows what is stored. */
  draft: Readonly<Record<string, string>>
  canEdit: boolean
  canDelete: boolean
  onChange: (row: SettingRow, value: string) => void
  onRevert: (row: SettingRow) => void
  onDelete: (row: SettingRow) => void
}

/**
 * One category's settings, each with the control its type calls for.
 *
 * The control edits a draft, not the server: nothing is sent until the page's Save, which
 * writes every changed row in one bulk request. A changed row is marked with a bar and an
 * undo button, and a value its type would refuse shows the reason under the field and
 * holds the Save back.
 *
 * A boolean is a switch, but the stored text is kept as it was spelled when untouched:
 * `1` is a legal stored boolean, and rewriting it to `true` on every save would mark rows
 * changed that the user never touched.
 */
export function SettingsCategoryPanel({
  rows,
  draft,
  canEdit,
  canDelete,
  onChange,
  onRevert,
  onDelete,
}: SettingsCategoryPanelProps) {
  return (
    <Paper variant="outlined">
      {rows.map((row, index) => {
        const key = rowKey(row)
        const type = dataTypeOf(row)
        const value = draft[key] ?? row.settingValue
        const changed = value !== row.settingValue
        const problem = changed ? validateValue(type, value) : null
        const grading = isGradeThreshold(row)

        return (
          <Fragment key={key}>
            {index > 0 && <Divider />}
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr) auto' },
                alignItems: 'center',
                px: 2,
                py: 1.5,
                borderLeft: 3,
                borderLeftColor: changed ? 'primary.main' : 'transparent',
                bgcolor: changed ? 'action.hover' : undefined,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {row.description?.trim() || humaniseKey(row.settingKey)}
                  </Typography>
                  {grading ? (
                    <Chip size="small" color="success" label="Used by grading" />
                  ) : (
                    <Tooltip title="Stored and returned by the API, but nothing in the system reads it yet">
                      <Chip size="small" variant="outlined" label="Stored only" />
                    </Tooltip>
                  )}
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace', display: 'block' }}
                >
                  {row.settingKey} · {type}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Updated {formatDateTime(row.updatedAt)}
                </Typography>
              </Box>

              <Box>
                {type === 'boolean' ? (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isTruthy(value)}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const next = event.target.checked
                          // Back to the stored spelling when that is what it now means.
                          onChange(row, isTruthy(row.settingValue) === next ? row.settingValue : String(next))
                        }}
                      />
                    }
                    label={isTruthy(value) ? 'On' : 'Off'}
                  />
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    value={value}
                    disabled={!canEdit}
                    onChange={(event) => onChange(row, event.target.value)}
                    error={problem !== null}
                    helperText={problem ?? (grading ? 'Minimum percentage for this grade' : undefined)}
                    // Decided by the stored value, not the draft: swapping input for textarea
                    // mid-typing would drop the focus.
                    multiline={type === 'json' || (type === 'string' && row.settingValue.length > 60)}
                    maxRows={8}
                    slotProps={{
                      htmlInput: {
                        'aria-label': row.settingKey,
                        inputMode: type === 'number' ? 'decimal' : undefined,
                        sx: type === 'json' ? { fontFamily: 'monospace', fontSize: 13 } : undefined,
                      },
                      input: grading
                        ? { endAdornment: <InputAdornment position="end">%</InputAdornment> }
                        : undefined,
                    }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', minWidth: 80 }}>
                {changed && (
                  <Tooltip title="Undo this change">
                    <IconButton size="small" onClick={() => onRevert(row)} aria-label={`Undo ${row.settingKey}`}>
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {canDelete && !grading && (
                  <Tooltip title="Delete this setting">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(row)}
                      aria-label={`Delete ${row.settingKey}`}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Fragment>
        )
      })}
    </Paper>
  )
}
