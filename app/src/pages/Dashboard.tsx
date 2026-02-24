import { Add, Delete, Edit, MenuBook, PlayArrow, Refresh } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import type { Project, Release, RunItem, TestBookAxis, TestBookCase } from '../types';

type TabItem = { id: string; label: string; kind: 'home' | 'testbook' | 'run' };
type TestBookSection = 'parameters' | 'cases';

const defaultAxis = (level: number): TestBookAxis => ({ level_number: level, label: `Axe ${level}`, values: [{ value_label: 'Valeur 1' }] });

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<TabItem[]>([{ id: 'home', label: 'My Projects', kind: 'home' }]);
  const [activeTab, setActiveTab] = useState('home');

  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: Project }>({ open: false });
  const [projectName, setProjectName] = useState('');
  const [assignedEmails, setAssignedEmails] = useState('');
  const [releaseModal, setReleaseModal] = useState<{ open: boolean; projectId?: number; release?: Release }>({ open: false });
  const [versionName, setVersionName] = useState('');
  const [runModal, setRunModal] = useState<{ open: boolean; projectId?: number; releaseId?: number; run?: RunItem }>({ open: false });
  const [runNumber, setRunNumber] = useState('');

  const [tbSectionByTab, setTbSectionByTab] = useState<Record<string, TestBookSection>>({});
  const [tbAxes, setTbAxes] = useState<TestBookAxis[]>([]);
  const [tbCases, setTbCases] = useState<TestBookCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbSaving, setTbSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const currentTab = tabs.find((t) => t.id === activeTab);
  const currentProjectId = currentTab?.kind === 'testbook' ? Number(currentTab.id.replace('tb-', '')) : null;

  const load = async () => {
    try {
      setError(null);
      const data = await apiFetch<{ projects: Project[] }>(API_ROUTES.dashboard.home);
      setProjects(data.projects);
    } catch (err) {
      setProjects([]);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des projets');
    }
  };
  useEffect(() => { void load(); }, []);

  const scheduleAutoSave = (action: () => Promise<void>) => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      setTbSaving(true);
      action().finally(() => setTbSaving(false));
    }, 500);
  };

  const loadTestBook = async (projectId: number) => {
    setTbLoading(true);
    try {
      const [params, cases] = await Promise.all([
        apiFetch<{ axes: TestBookAxis[] }>(API_ROUTES.testbook.paramsGet(projectId)),
        apiFetch<{ test_cases: TestBookCase[] }>(API_ROUTES.testbook.casesList(projectId)),
      ]);
      setTbAxes(params.axes.length ? params.axes : [defaultAxis(1)]);
      setTbCases(cases.test_cases);
      setSelectedCaseId(cases.test_cases[0]?.id ?? null);
    } finally {
      setTbLoading(false);
    }
  };

  useEffect(() => {
    if (!currentProjectId) return;
    void loadTestBook(currentProjectId);
  }, [currentProjectId]);

  const submitProject = async () => {
    const emails = assignedEmails.split(',').map((e) => e.trim()).filter(Boolean);
    if (projectModal.project) {
      await apiFetch(API_ROUTES.projects.update, { method: 'POST', bodyJson: { project_id: projectModal.project.id, name: projectName, assigned_emails: emails } });
    } else {
      await apiFetch(API_ROUTES.projects.create, { method: 'POST', bodyJson: { name: projectName, assigned_emails: emails } });
    }
    setProjectModal({ open: false });
    await load();
  };

  const submitRelease = async () => {
    if (!releaseModal.projectId) return;
    if (releaseModal.release) {
      await apiFetch(API_ROUTES.releases.update, { method: 'POST', bodyJson: { release_id: releaseModal.release.id, version: versionName } });
    } else {
      await apiFetch(API_ROUTES.releases.create, { method: 'POST', bodyJson: { project_id: releaseModal.projectId, version: versionName } });
    }
    setReleaseModal({ open: false });
    await load();
  };

  const submitRun = async () => {
    if (!runModal.projectId || !runModal.releaseId) return;
    if (runModal.run) {
      await apiFetch(API_ROUTES.runs.update, { method: 'POST', bodyJson: { run_id: runModal.run.id, run_number: Number(runNumber) } });
    } else {
      await apiFetch(API_ROUTES.runs.create, { method: 'POST', bodyJson: { project_id: runModal.projectId, release_id: runModal.releaseId, run_number: Number(runNumber) } });
    }
    setRunModal({ open: false });
    await load();
  };

  const closeTab = (tabId: string) => {
    setTabs((old) => old.filter((tab) => tab.id !== tabId));
    if (activeTab === tabId) setActiveTab('home');
  };

  const saveAxes = (next: TestBookAxis[]) => {
    if (!currentProjectId) return;
    setTbAxes(next.map((a, i) => ({ ...a, level_number: i + 1 })));
    scheduleAutoSave(async () => {
      await apiFetch(API_ROUTES.testbook.paramsSave, { method: 'POST', bodyJson: { project_id: currentProjectId, axes: next } });
      await loadTestBook(currentProjectId);
    });
  };

  const selectedCase = tbCases.find((item) => item.id === selectedCaseId) ?? null;
  const saveCase = (nextCase: TestBookCase) => {
    setTbCases((old) => old.map((item) => (item.id === nextCase.id ? nextCase : item)));
    scheduleAutoSave(async () => {
      await apiFetch(API_ROUTES.testbook.casesUpdate, {
        method: 'POST',
        bodyJson: {
          id: nextCase.id,
          description: nextCase.steps,
          expected_result: nextCase.expected_result ?? '',
          analytical_values: nextCase.analytical_values,
          attachments: nextCase.attachments,
          is_active: nextCase.is_active,
        },
      });
      if (currentProjectId) await loadTestBook(currentProjectId);
    });
  };

  const body = useMemo(() => {
    if (activeTab === 'home') {
      return <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between"><Typography variant="h4">My Projects</Typography><Stack direction="row" spacing={1}><Button startIcon={<Refresh />} onClick={() => void load()}>Refresh</Button><Button variant="contained" startIcon={<Add />} onClick={() => { setProjectName(''); setAssignedEmails(''); setProjectModal({ open: true }); }}>New Project</Button></Stack></Stack>
        {projects.map((project) => <Paper key={project.id} sx={{ p: 2 }}><Stack spacing={1.25}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">{project.name}</Typography><Stack direction="row" spacing={1}><IconButton onClick={() => { const tabId = `tb-${project.id}`; if (!tabs.some((t) => t.id === tabId)) setTabs((old) => [...old, { id: tabId, label: `${project.name} - Test Book`, kind: 'testbook' }]); setActiveTab(tabId); }}><MenuBook /></IconButton><IconButton onClick={() => { setProjectModal({ open: true, project }); setProjectName(project.name); setAssignedEmails(project.assigned_emails.join(', ')); }}><Edit /></IconButton></Stack></Stack>
          {(project.releases ?? []).map((release) => <Paper key={release.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={release.version} /><Typography variant="body2" color="text.secondary">{(release.runs ?? []).length} runs</Typography></Stack><Stack direction="row" spacing={1}><IconButton size="small" onClick={() => { setReleaseModal({ open: true, projectId: project.id, release }); setVersionName(release.version); }}><Edit fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={async () => { if (confirm('Supprimer cette version ?')) { await apiFetch(API_ROUTES.releases.delete, { method: 'POST', bodyJson: { release_id: release.id } }); await load(); } }}><Delete fontSize="small" /></IconButton><IconButton size="small" onClick={() => { const tabId = `run-${release.id}`; if (!tabs.some((t) => t.id === tabId)) setTabs((old) => [...old, { id: tabId, label: `${project.name} - Run`, kind: 'run' }]); setActiveTab(tabId); }}><PlayArrow fontSize="small" /></IconButton></Stack></Stack>
            <Stack sx={{ mt: 1 }} spacing={0.5}>{(release.runs ?? []).map((run) => <Stack key={run.id} direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2">Run #{run.run_number}</Typography><Stack direction="row"><IconButton size="small" onClick={() => { setRunModal({ open: true, projectId: project.id, releaseId: release.id, run }); setRunNumber(String(run.run_number)); }}><Edit fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={async () => { if (confirm('Supprimer ce run ?')) { await apiFetch(API_ROUTES.runs.delete, { method: 'POST', bodyJson: { run_id: run.id } }); await load(); } }}><Delete fontSize="small" /></IconButton></Stack></Stack>)}<Button size="small" startIcon={<Add />} onClick={() => { setRunModal({ open: true, projectId: project.id, releaseId: release.id }); setRunNumber(''); }}>New Run</Button></Stack>
          </Paper>)}
          <Button size="small" startIcon={<Add />} onClick={() => { setReleaseModal({ open: true, projectId: project.id }); setVersionName(''); }}>New Version</Button>
        </Stack></Paper>)}
      </Stack>;
    }

    if (currentTab?.kind === 'testbook' && currentProjectId) {
      const section = tbSectionByTab[activeTab] ?? 'parameters';
      return <Box sx={{ display: 'flex', gap: 2 }}>
        <Paper sx={{ width: 260, p: 1.5, alignSelf: 'flex-start' }}>
          <List dense>
            <ListItemButton selected={section === 'parameters'} onClick={() => setTbSectionByTab((old) => ({ ...old, [activeTab]: 'parameters' }))}><ListItemText primary="Test Book parameters" /></ListItemButton>
            <ListItemButton selected={section === 'cases'} onClick={() => setTbSectionByTab((old) => ({ ...old, [activeTab]: 'cases' }))}><ListItemText primary="Test Cases" /></ListItemButton>
          </List>
          {tbSaving ? <Typography variant="caption">Auto save...</Typography> : null}
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          {tbLoading ? <Typography>Chargement...</Typography> : section === 'parameters' ? <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between"><Typography variant="h6">Axes analytiques</Typography><Button startIcon={<Add />} onClick={() => saveAxes([...tbAxes, defaultAxis(tbAxes.length + 1)])}>Ajouter un axe</Button></Stack>
            {tbAxes.map((axis, idx) => <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1}><Stack direction="row" alignItems="center" spacing={1}><Chip label={`Niveau ${idx + 1}`} /><TextField size="small" label="Libellé" value={axis.label} onChange={(e) => saveAxes(tbAxes.map((a, i) => (i === idx ? { ...a, label: e.target.value } : a)))} />{tbAxes.length > 1 ? <IconButton color="error" onClick={() => saveAxes(tbAxes.filter((_, i) => i !== idx))}><Delete /></IconButton> : null}</Stack>
              {axis.values.map((v, vIdx) => <Stack key={vIdx} direction="row" spacing={1}><TextField size="small" label={`Valeur ${vIdx + 1}`} value={v.value_label} onChange={(e) => saveAxes(tbAxes.map((a, i) => i !== idx ? a : { ...a, values: a.values.map((x, j) => j === vIdx ? { ...x, value_label: e.target.value } : x) }))} />{axis.values.length > 1 ? <IconButton color="error" onClick={() => saveAxes(tbAxes.map((a, i) => i !== idx ? a : { ...a, values: a.values.filter((_, j) => j !== vIdx) }))}><Delete /></IconButton> : null}</Stack>)}
              <Button size="small" onClick={() => saveAxes(tbAxes.map((a, i) => i !== idx ? a : { ...a, values: [...a.values, { value_label: `Valeur ${a.values.length + 1}` }] }))}>Ajouter une valeur</Button>
            </Stack></Paper>)}
          </Stack> : <Stack spacing={2}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Cas de tests</Typography><Button startIcon={<Add />} onClick={async () => { await apiFetch(API_ROUTES.testbook.casesCreate, { method: 'POST', bodyJson: { project_id: currentProjectId, insert_index: tbCases.length + 1, description: '', expected_result: '', analytical_values: {} } }); await loadTestBook(currentProjectId); }}>Ajouter en fin</Button></Stack>
            <Stack direction="row" spacing={2} alignItems="flex-start"><Paper variant="outlined" sx={{ width: 280, maxHeight: 520, overflow: 'auto' }}><List dense>{tbCases.map((tc, idx) => <ListItemButton key={tc.id} selected={selectedCaseId === tc.id} onClick={() => setSelectedCaseId(tc.id)}><ListItemText primary={`#${tc.case_number}`} secondary={tc.steps || 'Sans description'} />
              <IconButton size="small" onClick={async (e) => { e.stopPropagation(); await apiFetch(API_ROUTES.testbook.casesCreate, { method: 'POST', bodyJson: { project_id: currentProjectId, insert_index: idx + 1, description: '', expected_result: '', analytical_values: {} } }); await loadTestBook(currentProjectId); }}><Add fontSize="small" /></IconButton>
              {tbCases.length > 1 ? <IconButton size="small" color="error" onClick={async (e) => { e.stopPropagation(); await apiFetch(API_ROUTES.testbook.casesDelete, { method: 'POST', bodyJson: { id: tc.id } }); await loadTestBook(currentProjectId); }}><Delete fontSize="small" /></IconButton> : null}
            </ListItemButton>)}</List></Paper>
            <Box sx={{ flex: 1 }}>{selectedCase ? <Stack spacing={1}><Typography variant="subtitle1">Cas #{selectedCase.case_number}</Typography>
              {tbAxes.map((axis) => <TextField key={axis.level_number} select label={`${axis.level_number}. ${axis.label}`} size="small" value={selectedCase.analytical_values[String(axis.level_number)] ?? ''} onChange={(e) => saveCase({ ...selectedCase, analytical_values: { ...selectedCase.analytical_values, [String(axis.level_number)]: e.target.value } })}>{axis.values.map((v, i) => <MenuItem key={i} value={v.value_label}>{v.value_label}</MenuItem>)}</TextField>)}
              <TextField label="Description du test" multiline minRows={3} value={selectedCase.steps} onChange={(e) => saveCase({ ...selectedCase, steps: e.target.value })} />
              <TextField label="Résultat attendu" multiline minRows={2} value={selectedCase.expected_result ?? ''} onChange={(e) => saveCase({ ...selectedCase, expected_result: e.target.value })} />
              <TextField label="Pièces jointes (une par ligne)" multiline minRows={2} value={selectedCase.attachments.join('\n')} onChange={(e) => saveCase({ ...selectedCase, attachments: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
            </Stack> : <Typography color="text.secondary">Sélectionnez un cas.</Typography>}</Box></Stack></Stack>}
        </Paper>
      </Box>;
    }

    return <Paper sx={{ p: 3 }}><Typography variant="h5">{currentTab?.label}</Typography><Typography color="text.secondary">Vue run en préparation.</Typography></Paper>;
  }, [activeTab, assignedEmails, currentProjectId, currentTab, load, projectName, projects, runNumber, selectedCase, selectedCaseId, tabs, tbAxes, tbCases, tbLoading, tbSaving, tbSectionByTab, versionName]);

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={<Stack direction="row" alignItems="center" spacing={0.5}><span>{tab.label}</span>{tab.id !== 'home' ? <IconButton size="small" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</IconButton> : null}</Stack>}
          />
        ))}
      </Tabs>
      {body}

      <Dialog open={projectModal.open} onClose={() => setProjectModal({ open: false })}><DialogTitle>{projectModal.project ? 'Edit Project' : 'New Project'}</DialogTitle><DialogContent><Stack sx={{ mt: 1 }} spacing={1}><TextField label="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} /><TextField label="Assigned emails (comma separated)" value={assignedEmails} onChange={(e) => setAssignedEmails(e.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={() => setProjectModal({ open: false })}>Cancel</Button><Button onClick={() => void submitProject()} variant="contained">Save</Button></DialogActions></Dialog>
      <Dialog open={releaseModal.open} onClose={() => setReleaseModal({ open: false })}><DialogTitle>{releaseModal.release ? 'Edit Version' : 'New Version'}</DialogTitle><DialogContent><TextField sx={{ mt: 1 }} label="Version name" value={versionName} onChange={(e) => setVersionName(e.target.value)} /></DialogContent><DialogActions><Button onClick={() => setReleaseModal({ open: false })}>Cancel</Button><Button onClick={() => void submitRelease()} variant="contained">Save</Button></DialogActions></Dialog>
      <Dialog open={runModal.open} onClose={() => setRunModal({ open: false })}><DialogTitle>{runModal.run ? 'Edit Run' : 'New Run'}</DialogTitle><DialogContent><TextField sx={{ mt: 1 }} label="Run number" type="number" value={runNumber} onChange={(e) => setRunNumber(e.target.value)} /></DialogContent><DialogActions><Button onClick={() => setRunModal({ open: false })}>Cancel</Button><Button onClick={() => void submitRun()} variant="contained">Save</Button></DialogActions></Dialog>
    </Stack>
  );
}
