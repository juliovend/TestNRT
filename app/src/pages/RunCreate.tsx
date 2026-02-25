import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';

export default function RunCreate() {
  const [projectId, setProjectId] = useState('1');
  const [releaseId, setReleaseId] = useState('1');
  const [runId, setRunId] = useState<number | null>(null);

  const create = async () => {
    const data = await apiFetch<{ run_id: number }>(API_ROUTES.runs.create, {
      method: 'POST',
      bodyJson: { project_id: Number(projectId), release_id: Number(releaseId) },
    });
    setRunId(data.run_id);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Create a run</Typography>
      <TextField label="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
      <TextField label="Release ID" value={releaseId} onChange={(e) => setReleaseId(e.target.value)} />
      <Button variant="contained" onClick={create}>Create</Button>
      {runId ? <Typography>Run created: #{runId}</Typography> : null}
    </Stack>
  );
}
