import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { API_ROUTES } from '../api/client';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
}

export default function Login({ onLogin, onRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wrap = async (cb: () => Promise<void>) => {
    setError(null);
    try {
      await cb();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Connexion TNR</Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button variant="contained" onClick={() => wrap(() => onLogin(email, password))}>
            Login email+mdp
          </Button>
          <Button variant="outlined" onClick={() => wrap(() => onRegister(email, password, name))}>
            Register email+mdp
          </Button>
          <Button color="secondary" href={API_ROUTES.auth.googleStart}>
            Continuer avec Google
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
