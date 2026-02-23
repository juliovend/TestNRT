import { CircularProgress, Box } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import * as authApi from './api/auth';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await authApi.me();
        setUser(data.user);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={async (email, password) => {
          const data = await authApi.login(email, password);
          setUser(data.user);
        }}
        onRegister={async (email, password, name) => {
          const data = await authApi.register(email, password, name);
          setUser(data.user);
        }}
      />
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout
            user={user}
            onLogout={async () => {
              await authApi.logout();
              setUser(null);
            }}
          />
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
