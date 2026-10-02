import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { formatDateTime } from '@/lib/dates'
import type { Activity } from '../types'

/**
 * The caller's own recent audit rows. Real AuditLog entries, so an empty list means the
 * user has done nothing recorded yet, not that the feed failed; it is said that way.
 */
export function RecentActivityCard({ activity }: { activity: readonly Activity[] }) {
  return (
    <Paper variant="outlined" sx={{ height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, px: 2, pt: 2 }}>
        Your recent activity
      </Typography>
      {activity.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          Nothing recorded against your account yet.
        </Typography>
      ) : (
        <List dense>
          {activity.map((item, index) => (
            <ListItem
              key={`${item.activityDate}-${index}`}
              secondaryAction={<Chip size="small" variant="outlined" label={item.activityType} />}
            >
              <ListItemText
                primary={item.activityDescription}
                secondary={formatDateTime(item.activityDate)}
                sx={{ pr: 10 }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  )
}
