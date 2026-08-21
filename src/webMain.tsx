import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4cc9b0' },
    secondary: { main: '#f4a261' },
    background: { default: '#121a1a', paper: '#1b2525' },
  },
  typography: {
    fontFamily: 'Segoe UI, sans-serif',
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App webModeOverride={true} />
    </ThemeProvider>
  </React.StrictMode>,
);
