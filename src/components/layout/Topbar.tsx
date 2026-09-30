import LockResetIcon from '@mui/icons-material/LockReset'
import LogoutIcon from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { baseApi } from '@/app/baseApi'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { useLogoutMutation } from '@/features/auth/authApi'
import { loggedOut } from '@/features/auth/authSlice'
import { CHANGE_PASSWORD_PATH, LOGIN_PATH } from '@/features/auth/guards'
import {
  displayName,
  initialsOf,
  selectCurrentUser,
  selectRefreshToken,
} from '@/features/auth/permissions'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(selectCurrentUser)
  const refreshToken = useAppSelector(selectRefreshToken)
  const [logout, { isLoading }] = useLogoutMutation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const handleLogout = async () => {
    setAnchor(null)
    try {
      // Revoke the refresh token server-side. If this fails (expired token, API down)
      // we still clear locally: refusing to sign out would be worse than a stale row.
      if (refreshToken) await logout({ refreshToken }).unwrap()
    } catch {
      // Intentionally ignored; the local teardown below is what matters.
    } finally {
      dispatch(loggedOut())
      // Drop every cached query so the next user cannot see the previous one's data.
      dispatch(baseApi.util.resetApiState())
      navigate(LOGIN_PATH, { replace: true })
    }
  }

  return (
    <AppBar position="fixed" sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        displayPrint: 'none',
      }}>
      <Toolbar>
        <IconButton
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 1, display: { md: 'none' } }}
          aria-label="Toggle navigation"
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {user?.schoolCode && (
            <Chip size="small" variant="outlined" label={user.schoolCode} sx={{ display: { xs: 'none', sm: 'flex' } }} />
          )}
          <Chip size="small" color="primary" variant="outlined" label={user?.role ?? ''} />

          <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account menu">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
              {initialsOf(user)}
            </Avatar>
          </IconButton>
        </Stack>

        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { minWidth: 240 } } }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" noWrap>
              {displayName(user)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {user?.email || user?.username}
            </Typography>
          </Box>
          <Divider />

          <MenuItem
            onClick={() => {
              setAnchor(null)
              navigate(CHANGE_PASSWORD_PATH)
            }}
          >
            <ListItemIcon>
              <LockResetIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Change password</ListItemText>
          </MenuItem>

          <MenuItem onClick={handleLogout} disabled={isLoading}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Sign out</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  )
}
