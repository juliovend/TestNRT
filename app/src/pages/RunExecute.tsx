import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';

type RunStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'NOT_RUN';
type StatusFilter = 'ALL' | RunStatus;

interface RunResult {
  test_run_case_id: number;
  title: string;
  steps: string;
  status: RunStatus;
  comment: string | null;
}

interface RunDetails {
  summary: {
    total: number;
    pass: number;
    fail: number;
    blocked: number;
    skipped: number;
    not_run: number;
  };
  results: RunResult[];
}

const STATUS_OPTIONS: RunStatus[] = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'];

export default function RunExecute() {
  const [runId, setRunId] = useState('1');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectNextNotRun = (results: RunResult[]) => {
    const nextCase = results.find((result) => result.status === 'NOT_RUN') ?? results[0] ?? null;
    setSelectedCaseId(nextCase ? nextCase.test_run_case_id : null);
    setComment(nextCase?.comment ?? '');
  };

  const load = async () => {
    setError(null);
    try {
      const data = await apiFetch<RunDetails>(API_ROUTES.runs.get(runId));
      setDetails(data);
      selectNextNotRun(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  };

  const exportCsv = () => {
    window.open(API_ROUTES.runs.exportCsv(runId), '_blank', 'noopener,noreferrer');
  };

  const selectedResult = useMemo(
    () => details?.results.find((result) => result.test_run_case_id === selectedCaseId) ?? null,
    [details, selectedCaseId],
  );

  const filteredResults = useMemo(() => {
    if (!details) {
      return [];
    }
    if (statusFilter === 'ALL') {
      return details.results;
    }
    return details.results.filter((result) => result.status === statusFilter);
  }, [details, statusFilter]);

  const saveResult = async (status: RunStatus) => {
    if (!selectedCaseId) {
      return;
    }

    await apiFetch(API_ROUTES.runs.setResult, {
      method: 'POST',
      bodyJson: { test_run_case_id: selectedCaseId, status, comment },
    });

    const refreshed = await apiFetch<RunDetails>(API_ROUTES.runs.get(runId));
    setDetails(refreshed);
    selectNextNotRun(refreshed.results);
  };

  const total = details?.summary.total ?? 0;
  const notRun = details?.summary.not_run ?? 0;
  const executed = Math.max(total - notRun, 0);
  const remaining = notRun;
  const progress = total > 0 ? Math.round((executed / total) * 100) : 0;

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Exécuter un run</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="Run ID" value={runId} onChange={(e) => setRunId(e.target.value)} />
        <Button variant="outlined" onClick={exportCsv}>Exporter CSV</Button>
        <Button variant="contained" onClick={load}>
          Charger
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {details ? (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1">Résumé du run</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`Total: ${total}`} />
              <Chip label={`Exécutés: ${executed}`} color="primary" />
              <Chip label={`Restants: ${remaining}`} color="warning" />
              <Chip label={`Progression: ${progress}%`} color="success" />
              <Chip label={`PASS: ${details.summary.pass}`} color="success" variant="outlined" />
              <Chip label={`FAIL: ${details.summary.fail}`} color="error" variant="outlined" />
              <Chip label={`BLOCKED: ${details.summary.blocked}`} color="warning" variant="outlined" />
              <Chip label={`SKIPPED: ${details.summary.skipped}`} variant="outlined" />
              <Chip label={`NOT_RUN: ${details.summary.not_run}`} variant="outlined" />
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, width: { xs: '100%', md: '45%' } }}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="run-status-filter-label">Filtre status</InputLabel>
              <Select
                labelId="run-status-filter-label"
                label="Filtre status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <MenuItem value="ALL">Tous</MenuItem>
                <MenuItem value="NOT_RUN">NOT_RUN</MenuItem>
                <MenuItem value="PASS">PASS</MenuItem>
                <MenuItem value="FAIL">FAIL</MenuItem>
                <MenuItem value="BLOCKED">BLOCKED</MenuItem>
                <MenuItem value="SKIPPED">SKIPPED</MenuItem>
              </Select>
            </FormControl>

            <List dense sx={{ maxHeight: 360, overflow: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
              {filteredResults.map((result) => (
                <ListItemButton
                  key={result.test_run_case_id}
                  selected={selectedCaseId === result.test_run_case_id}
                  onClick={() => {
                    setSelectedCaseId(result.test_run_case_id);
                    setComment(result.comment ?? '');
                  }}
                >
                  <ListItemText
                    primary={`#${result.test_run_case_id} - ${result.title}`}
                    secondary={`Status: ${result.status}`}
                  />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Mode suivant: prochain test NOT_RUN</Typography>

            {selectedResult ? (
              <>
                <Typography variant="body1">
                  <strong>Test sélectionné:</strong> #{selectedResult.test_run_case_id} - {selectedResult.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedResult.steps}
                </Typography>
                <TextField
                  label="Commentaire"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />

                <Box>
                  <ToggleButtonGroup exclusive value={null}>
                    {STATUS_OPTIONS.map((nextStatus) => (
                      <ToggleButton
                        key={nextStatus}
                        value={nextStatus}
                        onClick={() => {
                          void saveResult(nextStatus);
                        }}
                      >
                        {nextStatus}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              </>
            ) : (
              <Typography color="text.secondary">Aucun test disponible pour ce filtre.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}
