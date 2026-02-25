import { Add, AttachFile, CloudUpload, Delete, DragIndicator, GroupAdd, MenuBook, PlayArrow, Refresh, Save } from '@mui/icons-material';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import RunTabView from '../components/RunTabView';
import { getRunScopeHighlightThreshold, getScopeHighlightSx } from '../utils/runScope';
import type { Project, Release, TestBookAxis, TestBookCase } from '../types';

type TabItem = { id: string; label: string; kind: 'home' | 'testbook' | 'run' };
type TestBookSection = 'parameters' | 'cases';

type CaseFilters = {
  caseNumber: string;
  steps: string;
  expectedResult: string;
  attachments: string;
  axisValues: Record<string, string>;
};

const defaultAxis = (level: number): TestBookAxis => ({
  level_number: level,
  label: `Axe ${level}`,
  values: [{ value_label: 'Valeur 1' }],
});

const defaultFilters = (): CaseFilters => ({
  caseNumber: '',
  steps: '',
  expectedResult: '',
  attachments: '',
  axisValues: {},
});

const normalize = (value: string) => value.toLowerCase().trim();


const parseAttachment = (entry: string) => {
  const separatorIndex = entry.indexOf('::');
  if (separatorIndex === -1) {
    return { label: entry, stored: '', isLegacy: true };
  }

  return {
    label: entry.slice(0, separatorIndex),
    stored: entry.slice(separatorIndex + 2),
    isLegacy: false,
  };
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<TabItem[]>([{ id: 'home', label: 'My Projects', kind: 'home' }]);
  const [activeTab, setActiveTab] = useState('home');

  const [projectModal, setProjectModal] = useState<{ open: boolean }>({ open: false });
  const [assignUsersModal, setAssignUsersModal] = useState<{ open: boolean; project?: Project }>({ open: false });
  const [projectName, setProjectName] = useState('');
  const [assignedEmails, setAssignedEmails] = useState('');
  const [releaseModal, setReleaseModal] = useState<{ open: boolean; projectId?: number; release?: Release }>({ open: false });
  const [versionName, setVersionName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingReleaseId, setEditingReleaseId] = useState<number | null>(null);
  const [editingVersionName, setEditingVersionName] = useState('');
  const [draggingProjectId, setDraggingProjectId] = useState<number | null>(null);

  const [tbSectionByTab, setTbSectionByTab] = useState<Record<string, TestBookSection>>({});
  const [tbAxes, setTbAxes] = useState<TestBookAxis[]>([]);
  const [tbCases, setTbCases] = useState<TestBookCase[]>([]);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbSaving, setTbSaving] = useState(false);
  const [tbParamsDirty, setTbParamsDirty] = useState(false);
  const [tbCasesDirty, setTbCasesDirty] = useState(false);
  const [tbUploadingCaseId, setTbUploadingCaseId] = useState<number | null>(null);
  const [caseFilters, setCaseFilters] = useState<CaseFilters>(defaultFilters());
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

  useEffect(() => {
    void load();
  }, []);

  const loadTestBook = async (projectId: number) => {
    setTbLoading(true);
    try {
      const [params, cases] = await Promise.all([
        apiFetch<{ axes: TestBookAxis[] }>(API_ROUTES.testbook.paramsGet(projectId)),
        apiFetch<{ test_cases: TestBookCase[] }>(API_ROUTES.testbook.casesList(projectId)),
      ]);
      setTbAxes(params.axes.length ? params.axes : [defaultAxis(1)]);
      setTbCases(cases.test_cases);
      setTbParamsDirty(false);
      setTbCasesDirty(false);
      setCaseFilters(defaultFilters());
    } finally {
      setTbLoading(false);
    }
  };

  useEffect(() => {
    if (!currentProjectId) return;
    void loadTestBook(currentProjectId);
  }, [currentProjectId]);

  const submitProject = async () => {
    const emails = assignedEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    await apiFetch(API_ROUTES.projects.create, { method: 'POST', bodyJson: { name: projectName, assigned_emails: emails } });
    setProjectModal({ open: false });
    await load();
  };

  const submitAssignedUsers = async () => {
    if (!assignUsersModal.project) return;
    const emails = assignedEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    await apiFetch(API_ROUTES.projects.update, {
      method: 'POST',
      bodyJson: { project_id: assignUsersModal.project.id, name: assignUsersModal.project.name, assigned_emails: emails },
    });
    setAssignUsersModal({ open: false });
    await load();
  };

  const submitRelease = async () => {
    if (!releaseModal.projectId) return;
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
  };

  const submitRun = async (projectId: number, releaseId: number, runs: Release['runs']) => {
    const nextRun = Math.max(0, ...(runs ?? []).map((run) => run.run_number)) + 1;
    await apiFetch(API_ROUTES.runs.create, {
      method: 'POST',
      bodyJson: { project_id: projectId, release_id: releaseId, run_number: nextRun },
    });
    await load();
  };

  const saveProjectName = async (project: Project) => {
    const trimmed = editingProjectName.trim();
    if (!trimmed || trimmed === project.name) {
      setEditingProjectId(null);
      return;
    }
    await apiFetch(API_ROUTES.projects.update, {
      method: 'POST',
      bodyJson: { project_id: project.id, name: trimmed, assigned_emails: project.assigned_emails },
    });
    setEditingProjectId(null);
    await load();
  };

  const saveReleaseVersion = async (release: Release) => {
    const trimmed = editingVersionName.trim();
    if (!trimmed || trimmed === release.version) {
      setEditingReleaseId(null);
      return;
    }
    await apiFetch(API_ROUTES.releases.update, {
      method: 'POST',
      bodyJson: { release_id: release.id, version: trimmed },
    });
    setEditingReleaseId(null);
    await load();
  };

  const closeTab = (tabId: string) => {
    setTabs((old) => old.filter((tab) => tab.id !== tabId));
    if (activeTab === tabId) setActiveTab('home');
  };

  const saveProjectOrder = async (orderedProjects: Project[]) => {
    await apiFetch(API_ROUTES.projects.reorder, {
      method: 'POST',
      bodyJson: {
        project_orders: orderedProjects.map((project, index) => ({ project_id: project.id, project_order: index + 1 })),
      },
    });
  };

  const moveProject = async (sourceProjectId: number, targetProjectId: number) => {
    if (sourceProjectId === targetProjectId) return;

    const sourceIndex = projects.findIndex((project) => project.id === sourceProjectId);
    const targetIndex = projects.findIndex((project) => project.id === targetProjectId);

    if (sourceIndex < 0 || targetIndex < 0) return;

    const reordered = [...projects];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setProjects(reordered);

    try {
      await saveProjectOrder(reordered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde de l'ordre des projets");
      await load();
    }
  };

  const deleteProject = async (project: Project) => {
    if (!confirm(`Supprimer le projet "${project.name}" ? Cette action est irréversible.`)) return;

    await apiFetch(API_ROUTES.projects.delete, {
      method: 'POST',
      bodyJson: { project_id: project.id },
    });

    setTabs((old) => old.filter((tab) => tab.id !== `tb-${project.id}`));
    if (activeTab === `tb-${project.id}`) {
      setActiveTab('home');
    }
    await load();
  };

  const saveParameters = async () => {
    if (!currentProjectId) return;
    setTbSaving(true);
    try {
      await apiFetch(API_ROUTES.testbook.paramsSave, {
        method: 'POST',
        bodyJson: {
          project_id: currentProjectId,
          axes: tbAxes.map((axis, idx) => ({ ...axis, level_number: idx + 1 })),
        },
      });
      await loadTestBook(currentProjectId);
    } finally {
      setTbSaving(false);
    }
  };

  const saveCases = async () => {
    if (!currentProjectId) return;
    setTbSaving(true);
    try {
      for (const item of tbCases) {
        await apiFetch(API_ROUTES.testbook.casesUpdate, {
          method: 'POST',
          bodyJson: {
            id: item.id,
            description: item.steps,
            expected_result: item.expected_result ?? '',
            analytical_values: item.analytical_values,
            attachments: item.attachments,
            is_active: item.is_active,
          },
        });
      }
      await loadTestBook(currentProjectId);
    } finally {
      setTbSaving(false);
    }
  };

  const updateCase = (caseId: number, patch: Partial<TestBookCase>) => {
    setTbCases((old) => old.map((item) => (item.id === caseId ? { ...item, ...patch } : item)));
    setTbCasesDirty(true);
  };


  const uploadAttachments = async (caseId: number, files: FileList | File[]) => {
    if (!currentProjectId) return;
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const formData = new FormData();
    formData.append('project_id', String(currentProjectId));
    formData.append('case_id', String(caseId));
    fileList.forEach((file) => formData.append('files[]', file));

    setTbUploadingCaseId(caseId);
    try {
      const response = await fetch(API_ROUTES.testbook.attachmentsUpload, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Upload impossible');
      }

      const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
      setTbCases((old) => old.map((item) => (item.id === caseId ? { ...item, attachments } : item)));
    } finally {
      setTbUploadingCaseId(null);
    }
  };

  const filteredCases = useMemo(() => {
    return tbCases.filter((item) => {
      const matchesCase = normalize(String(item.case_number)).includes(normalize(caseFilters.caseNumber));
      const matchesSteps = normalize(item.steps ?? '').includes(normalize(caseFilters.steps));
      const matchesExpected = normalize(item.expected_result ?? '').includes(normalize(caseFilters.expectedResult));
      const matchesAttachments = normalize(item.attachments.join(' | ')).includes(normalize(caseFilters.attachments));
      const matchesAxes = tbAxes.every((axis) => {
        const needle = normalize(caseFilters.axisValues[String(axis.level_number)] ?? '');
        if (!needle) return true;
        return normalize(item.analytical_values[String(axis.level_number)] ?? '').includes(needle);
      });
      return matchesCase && matchesSteps && matchesExpected && matchesAttachments && matchesAxes;
    });
  }, [caseFilters, tbAxes, tbCases]);

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

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            {projects.map((project) => (
              <Paper
                key={project.id}
                sx={{ p: 2, opacity: draggingProjectId === project.id ? 0.6 : 1 }}
                draggable
                onDragStart={() => setDraggingProjectId(project.id)}
                onDragEnd={() => setDraggingProjectId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingProjectId !== null) {
                    void moveProject(draggingProjectId, project.id);
                  }
                  setDraggingProjectId(null);
                }}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                  {editingProjectId === project.id ? (
                    <TextField
                      size="small"
                      value={editingProjectName}
                      autoFocus
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onBlur={() => void saveProjectName(project)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void saveProjectName(project);
                        }
                      }}
                    />
                  ) : (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <DragIndicator fontSize="small" sx={{ color: 'text.secondary', cursor: 'grab' }} />
                      <Typography
                        variant="h6"
                        sx={{ cursor: 'text' }}
                        onClick={() => {
                          setEditingProjectId(project.id);
                          setEditingProjectName(project.name);
                        }}
                      >
                        {project.name}
                      </Typography>
                    </Stack>
                  )}
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
                        setAssignUsersModal({ open: true, project });
                        setAssignedEmails(project.assigned_emails.join(', '));
                      }}
                    >
                      <GroupAdd />
                    </IconButton>
                    <IconButton color="error" onClick={() => void deleteProject(project)}>
                      <Delete />
                    </IconButton>
                  </Stack>
                </Stack>

                {(project.releases ?? []).map((release) => (
                  <Paper key={release.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        {editingReleaseId === release.id ? (
                          <TextField
                            size="small"
                            value={editingVersionName}
                            autoFocus
                            onChange={(e) => setEditingVersionName(e.target.value)}
                            onBlur={() => void saveReleaseVersion(release)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveReleaseVersion(release);
                              }
                            }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label={release.version}
                            sx={{ cursor: 'text' }}
                            onClick={() => {
                              setEditingReleaseId(release.id);
                              setEditingVersionName(release.version);
                            }}
                          />
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {(release.runs ?? []).length} runs
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1}>
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

                    <Stack sx={{ mt: 1 }} spacing={0.5}>
                      {(release.runs ?? []).map((run) => {
                        const runScopeThreshold = getRunScopeHighlightThreshold(run.id);
                        return (
                        <Stack key={run.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Typography variant="body2">Run #{run.run_number}</Typography>
                            <Typography variant="body2" sx={getScopeHighlightSx(run.scope_validated, runScopeThreshold)}>{`${run.scope_validated.toFixed(0)}% Scope Validated`}</Typography>
                          </Stack>
                          <Stack direction="row">
                            <IconButton
                              size="small"
                              onClick={() => {
                                const tabId = `run-${run.id}`;
                                if (!tabs.some((t) => t.id === tabId)) {
                                  setTabs((oldTabs) => [...oldTabs, { id: tabId, label: `${project.name} - ${release.version} - Run ${run.run_number}`, kind: 'run' }]);
                                }
                                setActiveTab(tabId);
                              }}
                            >
                              <PlayArrow fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={async () => {
                                if (confirm('Supprimer ce run ?')) {
                                  await apiFetch(API_ROUTES.runs.delete, {
                                    method: 'POST',
                                    bodyJson: { run_id: run.id },
                                  });
                                  await load();
                                }
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      );
                      })}

                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => void submitRun(project.id, release.id, release.runs)}
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
          </Box>
        </Stack>
      );
    }

    if (currentTab?.kind === 'testbook' && currentProjectId) {
      const section = tbSectionByTab[activeTab] ?? 'parameters';

      return (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Paper sx={{ width: 260, p: 1.5, alignSelf: 'flex-start' }}>
            <List dense>
              <ListItemButton
                selected={section === 'parameters'}
                onClick={() => setTbSectionByTab((old) => ({ ...old, [activeTab]: 'parameters' }))}
              >
                <ListItemText primary="Test Book parameters" />
              </ListItemButton>
              <ListItemButton selected={section === 'cases'} onClick={() => setTbSectionByTab((old) => ({ ...old, [activeTab]: 'cases' }))}>
                <ListItemText primary="Test Cases" />
              </ListItemButton>
            </List>
          </Paper>

          <Paper sx={{ flex: 1, p: 2 }}>
            {tbLoading ? (
              <Typography>Chargement...</Typography>
            ) : section === 'parameters' ? (
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Paramètres du Test Book</Typography>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    disabled={!tbParamsDirty || tbSaving}
                    onClick={() => void saveParameters()}
                  >
                    Save
                  </Button>
                </Stack>

                {tbAxes.map((axis, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          fullWidth
                          label={`Niveau ${idx + 1}`}
                          value={axis.label}
                          onChange={(e) => {
                            const next = tbAxes.map((a, i) => (i === idx ? { ...a, label: e.target.value } : a));
                            setTbAxes(next);
                            setTbParamsDirty(true);
                          }}
                        />
                        {tbAxes.length > 1 ? (
                          <IconButton
                            color="error"
                            onClick={() => {
                              setTbAxes(tbAxes.filter((_, i) => i !== idx));
                              setTbParamsDirty(true);
                            }}
                          >
                            <Delete />
                          </IconButton>
                        ) : null}
                      </Stack>

                      {axis.values.map((value, valueIdx) => (
                        <Stack key={valueIdx} direction="row" spacing={1} alignItems="center">
                          <TextField
                            size="small"
                            fullWidth
                            label={`Valeur ${valueIdx + 1}`}
                            value={value.value_label}
                            onChange={(e) => {
                              const next = tbAxes.map((a, i) => {
                                if (i !== idx) return a;
                                return {
                                  ...a,
                                  values: a.values.map((v, j) => (j === valueIdx ? { ...v, value_label: e.target.value } : v)),
                                };
                              });
                              setTbAxes(next);
                              setTbParamsDirty(true);
                            }}
                          />
                          {axis.values.length > 1 ? (
                            <IconButton
                              color="error"
                              onClick={() => {
                                const next = tbAxes.map((a, i) => {
                                  if (i !== idx) return a;
                                  return { ...a, values: a.values.filter((_, j) => j !== valueIdx) };
                                });
                                setTbAxes(next);
                                setTbParamsDirty(true);
                              }}
                            >
                              <Delete />
                            </IconButton>
                          ) : null}
                        </Stack>
                      ))}

                      <Button
                        size="small"
                        onClick={() => {
                          const next = tbAxes.map((a, i) =>
                            i !== idx ? a : { ...a, values: [...a.values, { value_label: `Valeur ${a.values.length + 1}` }] },
                          );
                          setTbAxes(next);
                          setTbParamsDirty(true);
                        }}
                      >
                        Ajouter une valeur
                      </Button>
                    </Stack>
                  </Paper>
                ))}

                <Button
                  startIcon={<Add />}
                  onClick={() => {
                    setTbAxes([...tbAxes, defaultAxis(tbAxes.length + 1)]);
                    setTbParamsDirty(true);
                  }}
                >
                  Ajouter un axe
                </Button>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Cas de tests</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      startIcon={<Add />}
                      onClick={async () => {
                        await apiFetch(API_ROUTES.testbook.casesCreate, {
                          method: 'POST',
                          bodyJson: {
                            project_id: currentProjectId,
                            insert_index: tbCases.length + 1,
                            description: '',
                            expected_result: '',
                            analytical_values: {},
                          },
                        });
                        await loadTestBook(currentProjectId);
                      }}
                    >
                      Ajouter en fin
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      disabled={!tbCasesDirty || tbSaving}
                      onClick={() => void saveCases()}
                    >
                      Save
                    </Button>
                  </Stack>
                </Stack>

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 620 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        {tbAxes.map((axis) => (
                          <TableCell key={axis.level_number}>{axis.label}</TableCell>
                        ))}
                        <TableCell>Description</TableCell>
                        <TableCell>Résultat attendu</TableCell>
                        <TableCell>Pièces jointes</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="Filtrer"
                            value={caseFilters.caseNumber}
                            onChange={(e) => setCaseFilters((old) => ({ ...old, caseNumber: e.target.value }))}
                          />
                        </TableCell>
                        {tbAxes.map((axis) => (
                          <TableCell key={axis.level_number}>
                            <TextField
                              size="small"
                              placeholder="Filtrer"
                              value={caseFilters.axisValues[String(axis.level_number)] ?? ''}
                              onChange={(e) =>
                                setCaseFilters((old) => ({
                                  ...old,
                                  axisValues: { ...old.axisValues, [String(axis.level_number)]: e.target.value },
                                }))
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="Filtrer"
                            value={caseFilters.steps}
                            onChange={(e) => setCaseFilters((old) => ({ ...old, steps: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="Filtrer"
                            value={caseFilters.expectedResult}
                            onChange={(e) => setCaseFilters((old) => ({ ...old, expectedResult: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="Filtrer"
                            value={caseFilters.attachments}
                            onChange={(e) => setCaseFilters((old) => ({ ...old, attachments: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCases.map((item) => {
                        const rowIndex = tbCases.findIndex((caseItem) => caseItem.id === item.id);
                        return (
                          <TableRow key={item.id} hover>
                            <TableCell>{item.case_number}</TableCell>
                            {tbAxes.map((axis) => (
                              <TableCell key={`${item.id}-${axis.level_number}`}>
                                <TextField
                                  size="small"
                                  select
                                  value={item.analytical_values[String(axis.level_number)] ?? ''}
                                  onChange={(e) => {
                                    updateCase(item.id, {
                                      analytical_values: {
                                        ...item.analytical_values,
                                        [String(axis.level_number)]: e.target.value,
                                      },
                                    });
                                  }}
                                  sx={{ minWidth: 170 }}
                                >
                                  {axis.values.map((value, idx) => (
                                    <MenuItem key={idx} value={value.value_label}>
                                      {value.value_label}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </TableCell>
                            ))}
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                value={item.steps}
                                onChange={(e) => updateCase(item.id, { steps: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                value={item.expected_result ?? ''}
                                onChange={(e) => updateCase(item.id, { expected_result: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack spacing={1}>
                                <Box
                                  onDragOver={(event) => {
                                    event.preventDefault();
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    void uploadAttachments(item.id, event.dataTransfer.files);
                                  }}
                                  onClick={() => fileInputRefs.current[item.id]?.click()}
                                  sx={{
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    px: 1,
                                    py: 0.75,
                                    cursor: 'pointer',
                                    backgroundColor: 'background.default',
                                  }}
                                >
                                  <Stack direction="row" spacing={0.75} alignItems="center">
                                    <CloudUpload fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                      Glisser-déposer un ou plusieurs fichiers, ou cliquer
                                    </Typography>
                                  </Stack>
                                </Box>
                                <input
                                  ref={(ref) => {
                                    fileInputRefs.current[item.id] = ref;
                                  }}
                                  type="file"
                                  hidden
                                  multiple
                                  onChange={(event) => {
                                    if (event.target.files?.length) {
                                      void uploadAttachments(item.id, event.target.files);
                                    }
                                    event.target.value = '';
                                  }}
                                />

                                {tbUploadingCaseId === item.id ? <Typography variant="caption">Upload en cours…</Typography> : null}

                                <Stack spacing={0.5}>
                                  {item.attachments.map((entry, attachmentIndex) => {
                                    const attachment = parseAttachment(entry);
                                    const openUrl = attachment.isLegacy
                                      ? attachment.label
                                      : API_ROUTES.testbook.attachmentsOpen(currentProjectId, item.id, attachment.stored);

                                    return (
                                      <Button
                                        key={`${item.id}-attachment-${attachmentIndex}`}
                                        size="small"
                                        startIcon={<AttachFile fontSize="small" />}
                                        onClick={() => window.open(openUrl, '_blank', 'noopener,noreferrer')}
                                        sx={{ justifyContent: 'flex-start' }}
                                      >
                                        {attachment.label}
                                      </Button>
                                    );
                                  })}
                                </Stack>
                              </Stack>
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                <IconButton
                                  size="small"
                                  onClick={async () => {
                                    await apiFetch(API_ROUTES.testbook.casesCreate, {
                                      method: 'POST',
                                      bodyJson: {
                                        project_id: currentProjectId,
                                        insert_index: rowIndex + 2,
                                        description: '',
                                        expected_result: '',
                                        analytical_values: {},
                                      },
                                    });
                                    await loadTestBook(currentProjectId);
                                  }}
                                >
                                  <Add fontSize="small" />
                                </IconButton>
                                {tbCases.length > 1 ? (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={async () => {
                                      await apiFetch(API_ROUTES.testbook.casesDelete, {
                                        method: 'POST',
                                        bodyJson: { id: item.id },
                                      });
                                      await loadTestBook(currentProjectId);
                                    }}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                ) : null}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </Paper>
        </Box>
      );
    }

    if (currentTab?.kind === 'run') {
      const runId = Number(currentTab.id.replace('run-', ''));
      return <RunTabView runId={runId} />;
    }

    return null;
  }, [
    activeTab,
    assignedEmails,
    caseFilters,
    currentProjectId,
    currentTab,
    draggingProjectId,
    filteredCases,
    load,
    projectName,
    projects,
    tabs,
    tbAxes,
    tbCases,
    tbCasesDirty,
    tbLoading,
    tbUploadingCaseId,
    tbParamsDirty,
    tbSaving,
    tbSectionByTab,
    versionName,
  ]);

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
                {tab.id !== 'home' ? (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ×
                  </IconButton>
                ) : null}
              </Stack>
            }
          />
        ))}
      </Tabs>
      {body}

      <Dialog open={projectModal.open} onClose={() => setProjectModal({ open: false })}>
        <DialogTitle>New Project</DialogTitle>
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

      <Dialog open={assignUsersModal.open} onClose={() => setAssignUsersModal({ open: false })}>
        <DialogTitle>Assign Users</DialogTitle>
        <DialogContent>
          <TextField
            sx={{ mt: 1, minWidth: 420 }}
            label="Assigned emails (comma separated)"
            value={assignedEmails}
            onChange={(e) => setAssignedEmails(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignUsersModal({ open: false })}>Cancel</Button>
          <Button onClick={() => void submitAssignedUsers()} variant="contained">
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

    </Stack>
  );
}
