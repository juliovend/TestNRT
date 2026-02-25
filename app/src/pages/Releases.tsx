import { Button, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import type { Release } from '../types';

export default function Releases() {
  const [projectId, setProjectId] = useState('1');
  const [version, setVersion] = useState('');
  const [items, setItems] = useState<Release[]>([]);

  const load = async () => {
    const data = await apiFetch<{ releases: Release[] }>(API_ROUTES.releases.list(projectId));
    setItems(data.releases);
  };

  const create = async () => {
    await apiFetch(API_ROUTES.releases.create, { method: 'POST', bodyJson: { project_id: Number(projectId), version } });
    setVersion('');
    await load();
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Releases</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        <Button onClick={load}>Load</Button>
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField label="Release version" value={version} onChange={(e) => setVersion(e.target.value)} />
        <Button variant="contained" onClick={create}>Create release</Button>
      </Stack>
      <List>
        {items.map((r) => <ListItem key={r.id}><ListItemText primary={r.version} secondary={r.notes || ''} /></ListItem>)}
      </List>
    </Stack>
  );
}
