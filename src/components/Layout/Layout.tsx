import React, { ReactNode } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  // Button,
  IconButton,
  // Menu,
  // MenuItem,
  // Avatar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  History as HistoryIcon,
  Description as ReportsIcon,
  Person as PersonIcon,
  // Logout as LogoutIcon,
  MedicalServices as MedicalIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

// import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const drawerWidth = 240;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  
  // const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
  //   setAnchorEl(event.currentTarget);
  // };

  // const handleProfileMenuClose = () => {
  //   setAnchorEl(null);
  // };

  // const handleLogout = () => {
  //   logout();
  //   handleProfileMenuClose();
  // };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Chat', icon: <ChatIcon />, path: '/chat' },
    { text: 'Conversations', icon: <HistoryIcon />, path: '/conversations' },
    { text: 'Reports', icon: <ReportsIcon />, path: '/reports' },
    { text: 'Profile', icon: <PersonIcon />, path: '/profile' },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Box display="flex" alignItems="center" gap={1}>
          <MedicalIcon color="primary" />
          <Typography variant="h6" color="primary">
            HealthBot
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem
            key={item.text}
            button
            selected={location.pathname === item.path}
            onClick={() => {
              navigate(item.path);
              if (isMobile) {
                setMobileOpen(false);
              }
            }}
            sx={{
              '&.Mui-selected': {
                bgcolor: 'primary.light',
                '&:hover': {
                  bgcolor: 'primary.light',
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                color: location.pathname === item.path ? 'primary.main' : 'inherit',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              sx={{
                color: location.pathname === item.path ? 'primary.main' : 'inherit',
              }}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'HealthBot'}
          </Typography>
          
          {/* User menu - DISABLED FOR DEVELOPMENT */}
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Development Mode
            </Typography>
            {/* <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="profile-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.full_name?.charAt(0) || 'U'}
              </Avatar>
            </IconButton> */}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        {children}
      </Box>

      {/* Profile menu - DISABLED FOR DEVELOPMENT */}
      {/* <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu> */}
    </Box>
  );
};

export default Layout; 