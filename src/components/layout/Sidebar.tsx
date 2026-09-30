import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { NavLink } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import { can, selectCurrentUser, selectRoleName } from '@/features/auth/permissions'
import { NAV_ITEMS, NAV_SECTIONS } from './navConfig'
import type { NavItem } from './navConfig'

export const SIDEBAR_WIDTH = 260

/**
 * Permission-filtered navigation.
 *
 * An entry survives only if the user can View its module, clears any role restriction,
 * and is not in the entry's `excludeRoles`. Entries without a module (the dashboard) pass
 * the permission check automatically. Because a module missing from the grid means
 * denied, a user with a narrow role simply sees a short sidebar rather than a wall of
 * links that 403.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAppSelector(selectCurrentUser)
  const role = useAppSelector(selectRoleName)

  const visible = useAppSelector((state) =>
    NAV_ITEMS.filter((item) => {
      if (item.roles && (!role || !item.roles.includes(role))) return false
      if (role && item.excludeRoles?.includes(role)) return false
      if (!item.module) return true
      return can(state, item.module, 'View')
    }),
  )

  const bySection = NAV_SECTIONS.map((section) => ({
    section,
    items: visible.filter((i) => i.section === section),
  })).filter((group) => group.items.length > 0)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1.5} sx={{ px: 2.5, py: 2, alignItems: 'center' }}>
        <SchoolRoundedIcon color="primary" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
            {import.meta.env.VITE_APP_NAME ?? 'School Management'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {/* SuperAdmin has no school: their SchoolId is null by design. */}
            {user?.schoolName ?? 'Platform administration'}
          </Typography>
        </Box>
      </Stack>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {bySection.map(({ section, items }) => (
          <List
            key={section}
            dense
            subheader={
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  fontSize: '0.68rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  lineHeight: 2.4,
                }}
              >
                {section}
              </ListSubheader>
            }
          >
            {items.map((item) => (
              <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </List>
        ))}
      </Box>
    </Box>
  )
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <ListItemButton
      component={NavLink}
      to={item.to}
      // `end` only for the index route, so /students/12 still highlights Students.
      end={item.to === '/'}
      onClick={onNavigate}
      sx={{
        mx: 1,
        borderRadius: 1,
        '&.active': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '& .MuiListItemIcon-root': { color: 'inherit' },
          '&:hover': { bgcolor: 'primary.dark' },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 38 }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      {/* v9 replaced primaryTypographyProps with the slotProps API. */}
      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '0.9rem' } } }} />
    </ListItemButton>
  )
}
