import { Button, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import type { TestCase } from '../types';

export default function TestCases() {
  const [projectId, setProjectId] = useState('1');
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [items, setItems] = useState<TestCase[]>([]);

  const load = async () => {
    const data = await apiFetch<{ test_cases: TestCase[] }>(`${API_ROUTES.testcases}?project_id=${projectId}`);
    setItems(data.test_cases);
  };

  const create = async () => {
    await apiFetch(API_ROUTES.testcases, {
      method: 'POST',
      bodyJson: { project_id: Number(projectId), title, steps, expected_result: '' },
    });
    setTitle('');
    setSteps('');
    await load();
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Test cases</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        <Button onClick={load}>Charger</Button>
      </Stack>
      <TextField label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextField label="Steps" value={steps} onChange={(e) => setSteps(e.target.value)} multiline minRows={3} />
      <Button variant="contained" onClick={create}>Créer test case</Button>
      <List>
        {items.map((t) => <ListItem key={t.id}><ListItemText primary={t.title} secondary={t.steps} /></ListItem>)}
      </List>
    </Stack>
  );
}
