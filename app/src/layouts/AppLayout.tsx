import { AppBar, Avatar, Box, Button, Stack, Toolbar, Typography } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { Outlet } from 'react-router-dom';
import type { User } from '../types';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function AppLayout({ user, onLogout }: Props) {
  const userInitials = (user.name ?? user.email ?? 'U')
    .split(' ')
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
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
              Test Assistant
            </Typography>
            <AutoAwesomeRoundedIcon sx={{ color: 'secondary.main' }} />
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
              Qualité logicielle, version turbo 🚀
            </Typography>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Avatar sx={{ bgcolor: 'primary.main', width: 30, height: 30 }}>{userInitials}</Avatar>
              <Button startIcon={<PersonRoundedIcon />} color="inherit" onClick={onLogout}>
                Logout
              </Button>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ p: 3, pt: 11 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
