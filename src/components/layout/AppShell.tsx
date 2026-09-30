import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import Toolbar from '@mui/material/Toolbar'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { SIDEBAR_WIDTH, Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/**
 * The authenticated frame: fixed top bar, permanent drawer on desktop, temporary
 * drawer on mobile, routed content in the middle.
 *
 * The Suspense boundary is what makes per-module lazy loading work — each module's
 * chunk is fetched on first navigation instead of shipping all thirteen up front.
 */
export function AppShell() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Topbar onMenuClick={() => setMobileOpen((open) => !open)} />

      {/* displayPrint: a printed page (a fee receipt) is the content alone, without the chrome. */}
      <Box
        component="nav"
        sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 }, displayPrint: 'none' }}
      >
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                width: SIDEBAR_WIDTH,
                boxSizing: 'border-box',
                borderRight: '1px solid',
                borderColor: 'divider',
              },
            }}
          >
            <Toolbar />
            <Sidebar />
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box' } }}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: 'background.default',
          px: { xs: 2, md: 3 },
          pb: 4,
        }}
      >
        <Toolbar sx={{ displayPrint: 'none' }} />
        <Suspense fallback={<FullPageLoader label="Loading…" />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  )
}
