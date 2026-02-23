import { Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';

export default function RunExecute() {
  const [runId, setRunId] = useState('1');
  const [testRunCaseId, setTestRunCaseId] = useState('1');
  const [status, setStatus] = useState('PASS');
  const [comment, setComment] = useState('');
  const [details, setDetails] = useState<any>(null);

  const load = async () => {
    const data = await apiFetch(API_ROUTES.runs.get(runId));
    setDetails(data);
  };

  const saveResult = async () => {
    await apiFetch(API_ROUTES.runs.setResult, {
      method: 'POST',
      bodyJson: { test_run_case_id: Number(testRunCaseId), status, comment },
    });
    await load();
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Exécuter un run</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="Run ID" value={runId} onChange={(e) => setRunId(e.target.value)} />
        <Button onClick={load}>Charger</Button>
      </Stack>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1">Résultat d'un test case de run</Typography>
        <Stack spacing={2}>
          <TextField label="Test run case ID" value={testRunCaseId} onChange={(e) => setTestRunCaseId(e.target.value)} />
          <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="PASS">PASS</MenuItem>
            <MenuItem value="FAIL">FAIL</MenuItem>
            <MenuItem value="BLOCKED">BLOCKED</MenuItem>
            <MenuItem value="NOT_RUN">NOT_RUN</MenuItem>
          </TextField>
          <TextField label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button variant="contained" onClick={saveResult}>Enregistrer résultat</Button>
        </Stack>
      </Paper>
      {details ? <pre>{JSON.stringify(details, null, 2)}</pre> : null}
    </Stack>
  );
}
