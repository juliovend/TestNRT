import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useEffect, useMemo, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import type { Project, Release, TestCase, TestRun } from '../types';

type RunStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'NOT_RUN';

interface RunResult {
  test_run_case_id: number;
  title: string;
  steps: string;
  status: RunStatus;
  comment: string | null;
}

interface RunDetails {
  summary: TestRun['summary'];
  results: RunResult[];
}

const EXEC_STATUS: Exclude<RunStatus, 'NOT_RUN'>[] = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'];

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [runDetails, setRunDetails] = useState<RunDetails | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRunCaseId, setSelectedRunCaseId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [newProjectName, setNewProjectName] = useState('');
  const [newReleaseVersion, setNewReleaseVersion] = useState('');
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseSteps, setNewCaseSteps] = useState('');

  const loadProjects = async () => {
    const data = await apiFetch<{ projects: Project[] }>(API_ROUTES.projects.list);
    setProjects(data.projects);
    if (!selectedProjectId && data.projects[0]) {
      setSelectedProjectId(data.projects[0].id);
    }
  };

  const loadProjectLinkedData = async (projectId: number) => {
    const [releaseData, testCaseData] = await Promise.all([
      apiFetch<{ releases: Release[] }>(API_ROUTES.releases.list(projectId)),
      apiFetch<{ test_cases: TestCase[] }>(API_ROUTES.testcases.list(projectId)),
    ]);
    setReleases(releaseData.releases);
    setTestCases(testCaseData.test_cases);

    const releaseToSelect = releaseData.releases.find((release) => release.id === selectedReleaseId) ?? releaseData.releases[0] ?? null;
    setSelectedReleaseId(releaseToSelect?.id ?? null);
  };

  const loadRuns = async (releaseId: number) => {
    const data = await apiFetch<{ runs: TestRun[] }>(API_ROUTES.runs.list(releaseId));
    setRuns(data.runs);
    const nextRun = data.runs.find((run) => run.id === selectedRunId) ?? data.runs[0] ?? null;
    setSelectedRunId(nextRun?.id ?? null);
  };

  const loadRunDetails = async (runId: number) => {
    const data = await apiFetch<RunDetails>(API_ROUTES.runs.get(runId));
    setRunDetails(data);
    const candidate = data.results.find((result) => result.status === 'NOT_RUN') ?? data.results[0] ?? null;
    setSelectedRunCaseId(candidate?.test_run_case_id ?? null);
    setComment(candidate?.comment ?? '');
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadProjectLinkedData(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedReleaseId) return;
    void loadRuns(selectedReleaseId);
  }, [selectedReleaseId]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetails(null);
      return;
    }
    void loadRunDetails(selectedRunId);
  }, [selectedRunId]);

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    await apiFetch(API_ROUTES.projects.create, { method: 'POST', bodyJson: { name: newProjectName } });
    setNewProjectName('');
    await loadProjects();
  };

  const createRelease = async () => {
    if (!selectedProjectId || !newReleaseVersion.trim()) return;
    await apiFetch(API_ROUTES.releases.create, {
      method: 'POST',
      bodyJson: { project_id: selectedProjectId, version: newReleaseVersion },
    });
    setNewReleaseVersion('');
    await loadProjectLinkedData(selectedProjectId);
  };

  const createRun = async () => {
    if (!selectedProjectId || !selectedReleaseId) return;
    const payload = await apiFetch<{ run_id: number }>(API_ROUTES.runs.create, {
      method: 'POST',
      bodyJson: { project_id: selectedProjectId, release_id: selectedReleaseId },
    });
    await loadRuns(selectedReleaseId);
    setSelectedRunId(payload.run_id);
  };

  const createTestCase = async () => {
    if (!selectedProjectId || !newCaseTitle.trim() || !newCaseSteps.trim()) return;
    await apiFetch(API_ROUTES.testcases.create, {
      method: 'POST',
      bodyJson: {
        project_id: selectedProjectId,
        title: newCaseTitle,
        steps: newCaseSteps,
        expected_result: '',
      },
    });
    setNewCaseTitle('');
    setNewCaseSteps('');
    await loadProjectLinkedData(selectedProjectId);
  };

  const updateRunCase = async (status: Exclude<RunStatus, 'NOT_RUN'>) => {
    if (!selectedRunCaseId || !selectedRunId) return;
    setError(null);
    try {
      await apiFetch(API_ROUTES.runs.setResult, {
        method: 'POST',
        bodyJson: { test_run_case_id: selectedRunCaseId, status, comment },
      });
      await loadRunDetails(selectedRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  };

  const selectedRunCase = useMemo(
    () => runDetails?.results.find((item) => item.test_run_case_id === selectedRunCaseId) ?? null,
    [runDetails, selectedRunCaseId],
  );

  return (
    <Stack spacing={2.5}>
      <Card sx={{ background: 'linear-gradient(120deg, #111827 0%, #0f172a 50%, #1e1b4b 100%)' }}>
        <CardContent>
          <Typography variant="h4" fontWeight={800}>NRT Manager 🌙</Typography>
          <Typography color="text.secondary">Vue unifiée de vos projets, releases, runs et cas de tests ✨</Typography>
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2} alignItems="stretch">
        <Paper sx={{ p: 2, width: { xs: '100%', xl: 360 } }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Projets 📁</Typography>
            <Stack direction="row" spacing={1}>
              <TextField label="Nouveau projet" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} fullWidth />
              <Button variant="contained" onClick={createProject}><AddRoundedIcon /></Button>
            </Stack>
            <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
              {projects.map((project) => (
                <ListItemButton key={project.id} selected={project.id === selectedProjectId} onClick={() => setSelectedProjectId(project.id)}>
                  <ListItemText primary={project.name} secondary={project.description || 'Sans description'} />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Releases 🧩</Typography>
            <Stack direction="row" spacing={1}>
              <TextField label="Nouvelle release" value={newReleaseVersion} onChange={(e) => setNewReleaseVersion(e.target.value)} fullWidth disabled={!selectedProjectId} />
              <Button variant="contained" onClick={createRelease} disabled={!selectedProjectId}><AddRoundedIcon /></Button>
            </Stack>

            <List dense sx={{ maxHeight: 180, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              {releases.map((release) => (
                <ListItemButton key={release.id} selected={release.id === selectedReleaseId} onClick={() => setSelectedReleaseId(release.id)}>
                  <ListItemText primary={release.version} secondary={release.notes || 'Pas de note'} />
                </ListItemButton>
              ))}
            </List>

            <Divider />

            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Runs ▶️</Typography>
                <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={createRun} disabled={!selectedReleaseId || !selectedProjectId}>
                  Nouveau run
                </Button>
              </Stack>
              <List dense sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                {runs.map((run) => (
                  <ListItemButton key={run.id} selected={run.id === selectedRunId} onClick={() => setSelectedRunId(run.id)}>
                    <ListItemText
                      primary={`Run #${run.id}`}
                      secondary={
                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={`Total ${run.summary.total}`} />
                          <Chip size="small" color="success" variant="outlined" label={`✅ ${run.summary.pass}`} />
                          <Chip size="small" color="error" variant="outlined" label={`❌ ${run.summary.fail}`} />
                          <Chip size="small" color="warning" variant="outlined" label={`⏳ ${run.summary.not_run}`} />
                        </Stack>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            </Stack>
          </Stack>
        </Paper>
      </Stack>

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, width: { xs: '100%', xl: 420 } }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Cas de tests du projet 🧪</Typography>
            <TextField label="Titre" value={newCaseTitle} onChange={(e) => setNewCaseTitle(e.target.value)} disabled={!selectedProjectId} />
            <TextField label="Étapes" value={newCaseSteps} onChange={(e) => setNewCaseSteps(e.target.value)} minRows={3} multiline disabled={!selectedProjectId} />
            <Button variant="outlined" onClick={createTestCase} disabled={!selectedProjectId}>Ajouter au projet</Button>
            <List dense sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              {testCases.map((testCase) => (
                <ListItemText key={testCase.id} primary={testCase.title} secondary={testCase.steps} sx={{ px: 1.5, py: 0.75 }} />
              ))}
            </List>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Exécution du run sélectionné ⚡</Typography>
            {runDetails ? (
              <>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`Total ${runDetails.summary.total}`} />
                  <Chip color="success" label={`PASS ${runDetails.summary.pass}`} />
                  <Chip color="error" label={`FAIL ${runDetails.summary.fail}`} />
                  <Chip color="warning" label={`NOT_RUN ${runDetails.summary.not_run}`} />
                  <Chip label={`BLOCKED ${runDetails.summary.blocked}`} />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <List dense sx={{ width: { xs: '100%', md: 360 }, maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    {runDetails.results.map((result) => (
                      <ListItemButton
                        key={result.test_run_case_id}
                        selected={result.test_run_case_id === selectedRunCaseId}
                        onClick={() => {
                          setSelectedRunCaseId(result.test_run_case_id);
                          setComment(result.comment ?? '');
                        }}
                      >
                        <ListItemText primary={result.title} secondary={`Statut: ${result.status}`} />
                      </ListItemButton>
                    ))}
                  </List>

                  <Box sx={{ flex: 1 }}>
                    {selectedRunCase ? (
                      <Stack spacing={1.2}>
                        <Typography fontWeight={700}>{selectedRunCase.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedRunCase.steps}</Typography>
                        <TextField label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} multiline minRows={2} />
                        <ToggleButtonGroup exclusive value={null}>
                          {EXEC_STATUS.map((status) => (
                            <ToggleButton key={status} value={status} onClick={() => void updateRunCase(status)}>
                              {status}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      </Stack>
                    ) : (
                      <Typography color="text.secondary">Sélectionnez un cas de test à exécuter.</Typography>
                    )}
                  </Box>
                </Stack>
              </>
            ) : (
              <Typography color="text.secondary">Sélectionnez d'abord un run depuis la liste.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}
