import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Link as RouterLink } from 'react-router-dom'
import { formatDate } from '@/lib/dates'
import { PlatformStatCards } from '@/features/schools/components/PlatformStatCards'
import type { PlatformSection as PlatformSectionData } from '../types'

/**
 * The platform administrator's half of the dashboard: the installation's totals and the
 * newest schools. The full picture (usage, suspended schools, onboarding) stays on the
 * Platform page, which this links to rather than repeats.
 */
export function PlatformSection({ platform }: { platform: PlatformSectionData }) {
  const more = platform.totalSchools - platform.recentSchools.length

  return (
    <Stack spacing={2}>
      {platform.stats ? (
        <PlatformStatCards stats={platform.stats} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Platform totals are not available to your role.
        </Typography>
      )}

      <Paper variant="outlined">
        <Stack
          direction="row"
          sx={{ px: 2, pt: 2, pb: 1, justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Newest schools
          </Typography>
          <Button component={RouterLink} to="/platform" size="small" endIcon={<ArrowForwardIcon />}>
            Platform overview
          </Button>
        </Stack>

        {platform.recentSchools.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            No schools have been created yet.
          </Typography>
        ) : (
          <List dense disablePadding>
            {platform.recentSchools.map((school) => (
              <ListItemButton key={school.id} component={RouterLink} to={`/schools/${school.id}`}>
                <ListItemText
                  primary={`${school.schoolName} (${school.schoolCode})`}
                  secondary={`${school.totalStudents} students · ${school.totalTeachers} teachers · added ${formatDate(school.createdAt)}`}
                />
                {!school.isActive && <Chip size="small" color="warning" label="Suspended" />}
              </ListItemButton>
            ))}
          </List>
        )}

        {more > 0 && (
          <Button component={RouterLink} to="/schools" size="small" sx={{ m: 1 }}>
            {`All ${platform.totalSchools} schools`}
          </Button>
        )}
      </Paper>
    </Stack>
  )
}
