import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';

// import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SnackbarProvider } from './contexts/SnackbarContext';

// Components
import Layout from './components/Layout/Layout';
// import LoginPage from './pages/LoginPage';
// import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';

// Theme configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

// Create react-query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// // Protected Route component - DISABLED FOR DEVELOPMENT
// const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const { isAuthenticated, loading } = useAuth();

//   if (loading) {
//     return (
//       <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
//         Loading...
//       </Box>
//     );
//   }

//   return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
// };

// // Public Route component (redirect if authenticated) - DISABLED FOR DEVELOPMENT
// const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const { isAuthenticated, loading } = useAuth();

//   if (loading) {
//     return (
//       <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
//         Loading...
//       </Box>
//     );
//   }

//   return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" />;
// };

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* <AuthProvider> */}
          <SnackbarProvider>
            <Router>
              <Layout>
                <Routes>
                  {/* All routes are now public for development */}
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/" element={<Navigate to="/chat" />} />
                </Routes>
              </Layout>
            </Router>
          </SnackbarProvider>
        {/* </AuthProvider> */}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App; 