import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { apiFetch } from '../api/client';

export default function RunCreate() {
  const [projectId, setProjectId] = useState('1');
  const [releaseId, setReleaseId] = useState('1');
  const [runId, setRunId] = useState<number | null>(null);

  const create = async () => {
    const data = await apiFetch<{ run_id: number }>('/runs/create', {
      method: 'POST',
      bodyJson: { project_id: Number(projectId), release_id: Number(releaseId) },
    });
    setRunId(data.run_id);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Créer un run</Typography>
      <TextField label="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
      <TextField label="Release ID" value={releaseId} onChange={(e) => setReleaseId(e.target.value)} />
      <Button variant="contained" onClick={create}>Créer</Button>
      {runId ? <Typography>Run créé: #{runId}</Typography> : null}
    </Stack>
  );
}
