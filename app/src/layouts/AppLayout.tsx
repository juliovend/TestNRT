import {
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { Link, Outlet, useLocation } from 'react-router-dom';
import type { User } from '../types';

const drawerWidth = 260;

const items = [{ path: '/dashboard', label: 'Studio', icon: <DashboardRoundedIcon /> }];

interface Props {
  user: User;
  onLogout: () => void;
}

export default function AppLayout({ user, onLogout }: Props) {
  const location = useLocation();
  const userInitials = (user.name ?? user.email ?? 'U')
    .split(' ')
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: 1201,
          background: 'linear-gradient(90deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              sx={{
                bgcolor: 'secondary.main',
                color: '#030712',
                fontWeight: 800,
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)',
              }}
            >
              ✨
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              NRT Manager
            </Typography>
            <AutoAwesomeRoundedIcon sx={{ color: 'secondary.main' }} />
          </Stack>
          <Typography color="text.secondary">Qualité logicielle, version turbo 🚀</Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: '#070b16',
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
          },
        }}
      >
        <Box>
          <Toolbar />
          <List sx={{ px: 1.5, py: 2 }}>
            {items.map((item) => (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                selected={location.pathname.startsWith(item.path)}
                sx={{ borderRadius: 2, mb: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Stack spacing={1.25} sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main' }}>{userInitials}</Avatar>
            <Box>
              <Typography fontWeight={700}>{user.name ?? 'Utilisateur'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
          </Stack>
          <Button startIcon={<PersonRoundedIcon />} color="inherit" onClick={onLogout}>
            Logout
          </Button>
        </Stack>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: `${drawerWidth}px` }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
