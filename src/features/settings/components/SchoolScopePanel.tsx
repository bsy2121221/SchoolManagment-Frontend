import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import LogoutIcon from '@mui/icons-material/Logout'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { useDeferredValue, useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import {
  useExitSchoolSwitchMutation,
  useGetSchoolsQuery,
  useSwitchSchoolMutation,
} from '@/features/schools/schoolsApi'
import type { SchoolRow } from '@/features/schools/types'

/**
 * The platform administrator's way into one school's settings.
 *
 * Settings live per school and the school always comes from the token, so there is no
 * `?schoolId=` to pass: the SuperAdmin has to *switch into* the school first, which
 * reissues the access token scoped to it. `schoolsApi` puts the new token and school into
 * the session and drops every cached query, so the page re-reads as that school.
 *
 * Two things this panel says out loud because they surprise people:
 * - only the access token is reissued, so the scope ends at the next token refresh
 *   (within the hour) and the page falls back to this picker on its own;
 * - every other school module still answers 403 while switched, because their guards
 *   check the role as well as the grid. Settings and the dashboard are the exceptions.
 */
export function SchoolPicker() {
  const dispatch = useAppDispatch()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [selected, setSelected] = useState<SchoolRow | null>(null)

  const { data, isFetching, error } = useGetSchoolsQuery({
    page: 1,
    pageSize: 20,
    isActive: true,
    ...(deferredSearch ? { searchTerm: deferredSearch } : {}),
  })
  const [switchSchool, { isLoading: switching }] = useSwitchSchoolMutation()

  const handleSwitch = async () => {
    if (!selected) return
    try {
      await switchSchool(selected.id).unwrap()
      dispatch(toastSuccess(`Now editing the settings of ${selected.schoolName}.`))
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not switch into that school.')))
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <div>
          <Typography variant="h6">Choose a school</Typography>
          <Typography variant="body2" color="text.secondary">
            Settings belong to one school. As platform administrator you have none of your own,
            so pick the school whose settings you want to read or change.
          </Typography>
        </div>

        {error ? (
          <Alert severity="error">{getErrorMessage(error, 'Could not load the schools.')}</Alert>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
          <Autocomplete
            sx={{ flex: 1, width: '100%' }}
            options={data?.items ?? []}
            value={selected}
            onChange={(_event, value) => setSelected(value)}
            inputValue={search}
            onInputChange={(_event, value) => setSearch(value)}
            // The server does the matching (name, code or city), so the list is shown as returned.
            filterOptions={(options) => options}
            getOptionLabel={(option) => `${option.schoolName} (${option.schoolCode})`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={isFetching}
            noOptionsText={deferredSearch ? 'No active school matches' : 'No active schools'}
            renderInput={(params) => (
              <TextField {...params} label="School" placeholder="Search by name, code or city" />
            )}
          />
          <Button
            variant="contained"
            startIcon={<SwapHorizIcon />}
            disabled={!selected || switching}
            onClick={handleSwitch}
            sx={{ flexShrink: 0 }}
          >
            {switching ? 'Switching…' : 'Open settings'}
          </Button>
        </Stack>

        <Alert severity="info">
          Switching lasts until your session next refreshes, usually within the hour. Only
          Settings and the Dashboard act as that school; other school screens stay closed to the
          platform role.
        </Alert>
      </Stack>
    </Paper>
  )
}

interface ActingAsBannerProps {
  schoolName: string | null
  schoolCode: string | null
  /** Set while there are unsaved edits: leaving the school would silently discard them. */
  disabled?: boolean
}

/** Shown above the settings while a SuperAdmin is switched into a school. */
export function ActingAsBanner({ schoolName, schoolCode, disabled }: ActingAsBannerProps) {
  const dispatch = useAppDispatch()
  const [exitSwitch, { isLoading }] = useExitSchoolSwitchMutation()

  const handleExit = async () => {
    try {
      await exitSwitch().unwrap()
      dispatch(toastSuccess('Back to platform scope.'))
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not leave the school.')))
    }
  }

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2, alignItems: 'center' }}
      action={
        <Button
          color="inherit"
          size="small"
          startIcon={<LogoutIcon />}
          disabled={isLoading || disabled}
          onClick={handleExit}
        >
          Leave school
        </Button>
      }
    >
      You are editing the settings of <strong>{schoolName ?? 'a school'}</strong>
      {schoolCode ? ` (${schoolCode})` : ''} as platform administrator. Changes apply to that
      school immediately.
    </Alert>
  )
}
