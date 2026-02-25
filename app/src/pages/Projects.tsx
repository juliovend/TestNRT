import { Button, List, ListItem, ListItemText, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import type { Project } from '../types';

export default function Projects() {
  const [items, setItems] = useState<Project[]>([]);
  const [name, setName] = useState('');

  const load = async () => {
    const data = await apiFetch<{ projects: Project[] }>(API_ROUTES.projects.list);
    setItems(data.projects);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    await apiFetch(API_ROUTES.projects.create, { method: 'POST', bodyJson: { name } });
    setName('');
    await load();
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Projects</Typography>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2}>
          <TextField label="Project name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="contained" onClick={create}>Create</Button>
        </Stack>
      </Paper>
      <List>
        {items.map((project) => (
          <ListItem key={project.id}>
            <ListItemText primary={project.name} secondary={project.description || 'No description'} />
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
