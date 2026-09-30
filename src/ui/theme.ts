import { createTheme } from '@mui/material/styles'

/**
 * A sober admin-panel theme: this is a tool people use all day, so the palette stays
 * quiet and lets dense tables carry the screen.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2E5AAC', light: '#5B82CE', dark: '#1D3C77' },
    secondary: { main: '#12796B' },
    success: { main: '#1E7A4B' },
    warning: { main: '#B26A00' },
    error: { main: '#C0392B' },
    background: { default: '#F5F7FA', paper: '#FFFFFF' },
    text: { primary: '#1B2430', secondary: '#5A6577' },
    divider: '#E2E7EF',
  },

  shape: { borderRadius: 8 },

  typography: {
    fontFamily: [
      '"Segoe UI"',
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: { fontWeight: 600, fontSize: '1.6rem' },
    h5: { fontWeight: 600, fontSize: '1.3rem' },
    h6: { fontWeight: 600, fontSize: '1.1rem' },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
  },

  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiPaper: {
      styleOverrides: {
        // Flat surfaces with a hairline border read better than stacked shadows
        // once a page holds a toolbar, a filter bar and a grid.
        root: { backgroundImage: 'none' },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: { borderBottom: '1px solid #E2E7EF' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
    MuiDialog: {
      defaultProps: { fullWidth: true, maxWidth: 'sm' },
    },
  },
})
