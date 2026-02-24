import { Add, Delete } from '@mui/icons-material';
import { Box, Button, Chip, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import type { TestBookAxis } from '../types';

type RunCase = {
  test_run_case_id: number;
  case_number: number;
  steps: string;
  expected_result: string | null;
  analytical_values: Record<string, string>;
  attachments: string[];
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
  comment: string | null;
  tested_at: string | null;
  tester_name: string | null;
  tester_email: string | null;
};

interface Props { runId: number }

export default function RunTabView({ runId }: Props) {
  const [axes, setAxes] = useState<TestBookAxis[]>([]);
  const [cases, setCases] = useState<RunCase[]>([]);
  const [selection, setSelection] = useState<string>('overview');

  const load = async () => {
    const data = await apiFetch<{ axes: TestBookAxis[]; results: RunCase[] }>(API_ROUTES.runs.get(runId));
    setAxes(data.axes);
    setCases(data.results);
  };

  useEffect(() => {
    void load();
  }, [runId]);

  const filteredCases = useMemo(() => {
    if (selection === 'overview') return cases;
    const clauses = selection.split('|').map((chunk) => chunk.split('='));
    return cases.filter((row) => clauses.every(([level, value]) => row.analytical_values[level] === value));
  }, [cases, selection]);

  const buildNodes = (levelIndex: number, parentFilters: string[], source: RunCase[]): { key: string; label: string; depth: number }[] => {
    if (levelIndex >= axes.length) return [];
    const levelKey = String(axes[levelIndex].level_number);
    const values = Array.from(new Set(source.map((item) => item.analytical_values[levelKey]).filter(Boolean)));
    return values.flatMap((value) => {
      const key = [...parentFilters, `${levelKey}=${value}`].join('|');
      const matching = source.filter((item) => item.analytical_values[levelKey] === value);
      return [{ key, label: value, depth: levelIndex + 1 }, ...buildNodes(levelIndex + 1, [...parentFilters, `${levelKey}=${value}`], matching)];
    });
  };

  const menuNodes = useMemo(() => buildNodes(0, [], cases), [cases, axes]);

  const setStatus = async (testRunCaseId: number, status: RunCase['status'], comment = '') => {
    await apiFetch(API_ROUTES.runs.setResult, { method: 'POST', bodyJson: { test_run_case_id: testRunCaseId, status, comment } });
    await load();
  };

  const saveRow = async (row: RunCase) => {
    await apiFetch(API_ROUTES.runs.casesUpdate, {
      method: 'POST',
      bodyJson: {
        test_run_case_id: row.test_run_case_id,
        steps: row.steps,
        expected_result: row.expected_result ?? '',
        analytical_values: row.analytical_values,
        attachments: row.attachments,
      },
    });
  };

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Paper sx={{ width: 280, p: 1.5, alignSelf: 'flex-start' }}>
        <List dense>
          <ListItemButton selected={selection === 'overview'} onClick={() => setSelection('overview')}>
            <ListItemText primary="Overview" />
          </ListItemButton>
          {menuNodes.map((node) => (
            <ListItemButton
              key={node.key}
              selected={selection === node.key}
              onClick={() => setSelection(node.key)}
              sx={{ pl: 1.5 + node.depth * 2 }}
            >
              <ListItemText primary={node.label} />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <Paper sx={{ flex: 1, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1}>
            <Chip label={`Total ${cases.length}`} />
            <Chip color="success" label={`Pass ${cases.filter((c) => c.status === 'PASS').length}`} />
            <Chip color="error" label={`Fail ${cases.filter((c) => c.status === 'FAIL').length}`} />
            <Chip color="warning" label={`Blocked ${cases.filter((c) => c.status === 'BLOCKED').length}`} />
            <Chip label={`To Do ${cases.filter((c) => c.status === 'NOT_RUN').length}`} />
          </Stack>
          <Button
            startIcon={<Add />}
            onClick={async () => {
              await apiFetch(API_ROUTES.runs.casesCreate, { method: 'POST', bodyJson: { run_id: runId, insert_index: cases.length + 1 } });
              await load();
            }}
          >
            Ajouter cas
          </Button>
        </Stack>

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 620 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                {axes.map((axis) => <TableCell key={axis.level_number}>{axis.label}</TableCell>)}
                <TableCell sx={{ minWidth: 260 }}>Steps</TableCell>
                <TableCell sx={{ minWidth: 260 }}>Expected</TableCell>
                <TableCell sx={{ minWidth: 260 }}>Comments</TableCell>
                <TableCell>Tester</TableCell>
                <TableCell>Test Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCases.map((row) => (
                <TableRow key={row.test_run_case_id}>
                  <TableCell>{row.case_number}</TableCell>
                  {axes.map((axis) => (
                    <TableCell key={`${row.test_run_case_id}-${axis.level_number}`}>
                      <TextField
                        size="small"
                        select
                        value={row.analytical_values[String(axis.level_number)] ?? ''}
                        onChange={async (e) => {
                          row.analytical_values[String(axis.level_number)] = e.target.value;
                          setCases([...cases]);
                          await saveRow(row);
                        }}
                      >
                        <MenuItem value="">--</MenuItem>
                        {axis.values.map((value) => <MenuItem key={value.value_label} value={value.value_label}>{value.value_label}</MenuItem>)}
                      </TextField>
                    </TableCell>
                  ))}
                  <TableCell sx={{ minWidth: 260, verticalAlign: 'top' }}>
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={3}
                      value={row.steps}
                      onBlur={() => void saveRow(row)}
                      onChange={(e) => {
                        row.steps = e.target.value;
                        setCases([...cases]);
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 260, verticalAlign: 'top' }}>
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={3}
                      value={row.expected_result ?? ''}
                      onBlur={() => void saveRow(row)}
                      onChange={(e) => {
                        row.expected_result = e.target.value;
                        setCases([...cases]);
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 260, verticalAlign: 'top' }}>
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={3}
                      value={row.comment ?? ''}
                      onChange={(e) => {
                        row.comment = e.target.value;
                        setCases([...cases]);
                      }}
                      onBlur={() =>
                        void apiFetch(API_ROUTES.runs.setResult, {
                          method: 'POST',
                          bodyJson: { test_run_case_id: row.test_run_case_id, status: row.status, comment: row.comment ?? '', touch_execution: 0 },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>{row.tester_name ?? row.tester_email ?? '-'}</TableCell>
                  <TableCell>{row.tested_at ?? '-'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" color="success" variant="contained" onClick={() => void setStatus(row.test_run_case_id, 'PASS', row.comment ?? '')}>✅ Pass</Button>
                      <Button size="small" color="error" variant="contained" onClick={() => void setStatus(row.test_run_case_id, 'FAIL', row.comment ?? '')}>❌ Fail</Button>
                      <Button size="small" color="warning" variant="contained" onClick={() => void setStatus(row.test_run_case_id, 'BLOCKED', row.comment ?? '')}>⛔ Blocked</Button>
                      <Button size="small" color="secondary" variant="contained" onClick={() => void setStatus(row.test_run_case_id, 'NOT_RUN', row.comment ?? '')}>📝 To Do</Button>
                      <Button size="small" color="error" startIcon={<Delete />} onClick={async () => {
                        await apiFetch(API_ROUTES.runs.casesDelete, { method: 'POST', bodyJson: { test_run_case_id: row.test_run_case_id } });
                        await load();
                      }} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
