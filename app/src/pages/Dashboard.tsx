import { Add, Delete, Edit, MenuBook, PlayArrow, Refresh, Save } from '@mui/icons-material';
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
import { useEffect, useMemo, useState } from 'react';
import { API_ROUTES, apiFetch } from '../api/client';
import RunTabView from '../components/RunTabView';
import type { Project, Release, RunItem, TestBookAxis, TestBookCase } from '../types';

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
  const [tbLoading, setTbLoading] = useState(false);
  const [tbSaving, setTbSaving] = useState(false);
  const [tbParamsDirty, setTbParamsDirty] = useState(false);
  const [tbCasesDirty, setTbCasesDirty] = useState(false);
  const [caseFilters, setCaseFilters] = useState<CaseFilters>(defaultFilters());

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
    if (projectModal.project) {
      await apiFetch(API_ROUTES.projects.update, {
        method: 'POST',
        bodyJson: { project_id: projectModal.project.id, name: projectName, assigned_emails: emails },
      });
    } else {
      await apiFetch(API_ROUTES.projects.create, { method: 'POST', bodyJson: { name: projectName, assigned_emails: emails } });
    }
    setProjectModal({ open: false });
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

  const submitRun = async () => {
    if (!runModal.projectId || !runModal.releaseId) return;
    if (runModal.run) {
      await apiFetch(API_ROUTES.runs.update, {
        method: 'POST',
        bodyJson: { run_id: runModal.run.id, run_number: Number(runNumber) },
      });
    } else {
      await apiFetch(API_ROUTES.runs.create, {
        method: 'POST',
        bodyJson: { project_id: runModal.projectId, release_id: runModal.releaseId, run_number: Number(runNumber) },
      });
    }
    setRunModal({ open: false });
    await load();
  };

  const closeTab = (tabId: string) => {
    setTabs((old) => old.filter((tab) => tab.id !== tabId));
    if (activeTab === tabId) setActiveTab('home');
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
                    <IconButton color="error" onClick={() => void deleteProject(project)}>
                      <Delete />
                    </IconButton>
                  </Stack>
                </Stack>

                {(project.releases ?? []).map((release) => (
                  <Paper key={release.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={release.version} />
                        <Typography variant="body2" color="text.secondary">
                          {(release.runs ?? []).length} runs
                        </Typography>
                      </Stack>
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

                    <Stack sx={{ mt: 1 }} spacing={0.5}>
                      {(release.runs ?? []).map((run) => (
                        <Stack key={run.id} direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2">Run #{run.run_number}</Typography>
                          <Stack direction="row">
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
                              <TextField
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                value={item.attachments.join('\n')}
                                onChange={(e) =>
                                  updateCase(item.id, {
                                    attachments: e.target.value
                                      .split('\n')
                                      .map((x) => x.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
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
    filteredCases,
    load,
    projectName,
    projects,
    runNumber,
    tabs,
    tbAxes,
    tbCases,
    tbCasesDirty,
    tbLoading,
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
