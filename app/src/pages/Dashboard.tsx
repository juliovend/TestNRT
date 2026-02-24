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
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import type { Project, Release, RunItem } from '../types';

type TabItem = { id: string; label: string; kind: 'home' | 'testbook' | 'run' };

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

  useEffect(() => {
    void load();
  }, []);

  const submitProject = async () => {
    const emails = assignedEmails.split(',').map((e) => e.trim()).filter(Boolean);
    try {
      if (projectModal.project) {
        await apiFetch(API_ROUTES.projects.update, {
          method: 'POST',
          bodyJson: { project_id: projectModal.project.id, name: projectName, assigned_emails: emails },
        });
      } else {
        await apiFetch(API_ROUTES.projects.create, {
          method: 'POST',
          bodyJson: { name: projectName, assigned_emails: emails },
        });
      }
      setProjectModal({ open: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du projet');
    }
  };

  const submitRelease = async () => {
    if (!releaseModal.projectId) return;
    try {
      if (releaseModal.release) {
        await apiFetch(API_ROUTES.releases.update, {
          method: 'POST',
          bodyJson: { release_id: releaseModal.release.id, version: versionName },
        });
      } else {
        await apiFetch(API_ROUTES.releases.create, {
          method: 'POST',
          bodyJson: { project_id: releaseModal.projectId, version: versionName },
        });
      }
      setReleaseModal({ open: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde de la version');
    }
  };

  const submitRun = async () => {
    if (!runModal.projectId || !runModal.releaseId) return;
    try {
      if (runModal.run) {
        await apiFetch(API_ROUTES.runs.update, { method: 'POST', bodyJson: { run_id: runModal.run.id, run_number: Number(runNumber) } });
      } else {
        await apiFetch(API_ROUTES.runs.create, {
          method: 'POST',
          bodyJson: { project_id: runModal.projectId, release_id: runModal.releaseId, run_number: Number(runNumber) },
        });
      }
      setRunModal({ open: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du run');
    }
  };

  const closeTab = (tabId: string) => {
    setTabs((old) => old.filter((tab) => tab.id !== tabId));
    if (activeTab === tabId) setActiveTab('home');
  };

  const body = useMemo(() => {
    if (activeTab === 'home') {
      return (
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h4">My Projects</Typography>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<Refresh />} onClick={() => void load()}>
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setProjectName('');
                  setAssignedEmails('');
                  setProjectModal({ open: true });
                }}
              >
                New Project
              </Button>
            </Stack>
          </Stack>
          {projects.map((project) => (
            <Paper key={project.id} sx={{ p: 2 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">{project.name}</Typography>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      onClick={() => {
                        const tabId = `tb-${project.id}`;
                        if (!tabs.some((t) => t.id === tabId)) {
                          setTabs((old) => [...old, { id: tabId, label: `${project.name} - Test Book`, kind: 'testbook' }]);
                        }
                        setActiveTab(tabId);
                      }}
                    >
                      <MenuBook />
                    </IconButton>
                    <IconButton
                      onClick={() => {
                        setProjectModal({ open: true, project });
                        setProjectName(project.name);
                        setAssignedEmails(project.assigned_emails.join(', '));
                      }}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={async () => {
                        if (confirm('Supprimer ce projet ?')) {
                          await apiFetch(API_ROUTES.projects.delete, { method: 'POST', bodyJson: { project_id: project.id } });
                          await load();
                        }
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </Stack>
                </Stack>
                <Typography variant="body2">Users: {project.assigned_emails.join(', ')}</Typography>

                {(project.releases ?? []).map((release) => (
                  <Paper key={release.id} variant="outlined" sx={{ p: 1.5, ml: 2 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight={700}>Version {release.version}</Typography>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setReleaseModal({ open: true, projectId: project.id, release });
                              setVersionName(release.version);
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              if (confirm('Supprimer cette version ?')) {
                                await apiFetch(API_ROUTES.releases.delete, {
                                  method: 'POST',
                                  bodyJson: { release_id: release.id },
                                });
                                await load();
                              }
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                      {(release.runs ?? []).map((run) => (
                        <Stack key={run.id} direction="row" spacing={1} alignItems="center" sx={{ ml: 2 }}>
                          <Typography>Run #{run.run_number}</Typography>
                          <Chip size="small" label={`T:${run.summary.total}`} />
                          <Chip size="small" color="success" label={`P:${run.summary.pass}`} />
                          <Chip size="small" color="error" label={`F:${run.summary.fail}`} />
                          <Chip size="small" color="warning" label={`ToDo:${run.summary.not_run}`} />
                          <IconButton
                            size="small"
                            onClick={() => {
                              const tabId = `run-${run.id}`;
                              if (!tabs.some((t) => t.id === tabId)) {
                                setTabs((old) => [
                                  ...old,
                                  { id: tabId, label: `${project.name} - ${release.version} - Run ${run.run_number}`, kind: 'run' },
                                ]);
                              }
                              setActiveTab(tabId);
                            }}
                          >
                            <PlayArrow fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setRunModal({ open: true, projectId: project.id, releaseId: release.id, run });
                              setRunNumber(String(run.run_number));
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              if (confirm('Supprimer ce run ?')) {
                                await apiFetch(API_ROUTES.runs.delete, { method: 'POST', bodyJson: { run_id: run.id } });
                                await load();
                              }
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => {
                          setRunModal({ open: true, projectId: project.id, releaseId: release.id });
                          setRunNumber('');
                        }}
                      >
                        New Run
                      </Button>
                    </Stack>
                  </Paper>
                ))}
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => {
                    setReleaseModal({ open: true, projectId: project.id });
                    setVersionName('');
                  }}
                >
                  New Version
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      );
    }

    const current = tabs.find((t) => t.id === activeTab);
    return (
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Paper sx={{ width: 280, p: 1.5, alignSelf: 'flex-start' }}>
          <Typography variant="subtitle2" sx={{ px: 1, pb: 1 }}>
            Navigation du contexte
          </Typography>
          <List dense>
            {tabs
              .filter((tab) => tab.id !== 'home')
              .map((tab) => (
                <ListItemButton key={tab.id} selected={tab.id === activeTab} onClick={() => setActiveTab(tab.id)}>
                  <ListItemText primary={tab.label} />
                </ListItemButton>
              ))}
          </List>
        </Paper>

        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h5">{current?.label}</Typography>
          <Typography color="text.secondary">
            Vue en préparation. Le menu latéral de cette zone reste actif uniquement pour les onglets ouverts depuis My Projects.
          </Typography>
        </Paper>
      </Box>
    );
  }, [activeTab, projects, tabs]);

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <span>{tab.label}</span>
                {tab.id !== 'home' && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ×
                  </IconButton>
                )}
              </Stack>
            }
          />
        ))}
      </Tabs>
      {body}

      <Dialog open={projectModal.open} onClose={() => setProjectModal({ open: false })}>
        <DialogTitle>{projectModal.project ? 'Edit Project' : 'New Project'}</DialogTitle>
        <DialogContent>
          <Stack sx={{ mt: 1 }} spacing={1}>
            <TextField label="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <TextField
              label="Assigned emails (comma separated)"
              value={assignedEmails}
              onChange={(e) => setAssignedEmails(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectModal({ open: false })}>Cancel</Button>
          <Button onClick={() => void submitProject()} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={releaseModal.open} onClose={() => setReleaseModal({ open: false })}>
        <DialogTitle>{releaseModal.release ? 'Edit Version' : 'New Version'}</DialogTitle>
        <DialogContent>
          <TextField sx={{ mt: 1 }} label="Version name" value={versionName} onChange={(e) => setVersionName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReleaseModal({ open: false })}>Cancel</Button>
          <Button onClick={() => void submitRelease()} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={runModal.open} onClose={() => setRunModal({ open: false })}>
        <DialogTitle>{runModal.run ? 'Edit Run' : 'New Run'}</DialogTitle>
        <DialogContent>
          <TextField
            sx={{ mt: 1 }}
            label="Run number"
            type="number"
            value={runNumber}
            onChange={(e) => setRunNumber(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunModal({ open: false })}>Cancel</Button>
          <Button onClick={() => void submitRun()} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
