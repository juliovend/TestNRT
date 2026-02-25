import { Add, Delete, PictureAsPdf } from '@mui/icons-material';
import { Box, Button, Chip, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
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

type AxisValueStats = {
  key: string;
  depth: number;
  label: string;
  total: number;
  remaining: number;
  ok: number;
  ko: number;
  nt: number;
  scopeValidated: number;
};

type RunMeta = {
  project_name: string;
  release_version: string;
  run_number: number;
};

export default function RunTabView({ runId }: Props) {
  const [axes, setAxes] = useState<TestBookAxis[]>([]);
  const [cases, setCases] = useState<RunCase[]>([]);
  const [selection, setSelection] = useState<string>('overview');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RunCase['status']>('ALL');
  const [overviewAxisSelections, setOverviewAxisSelections] = useState<string[]>([]);
  const [scopeHighlightThreshold, setScopeHighlightThreshold] = useState<number>(80);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const overviewTableRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const data = await apiFetch<{ run: RunMeta; axes: TestBookAxis[]; results: RunCase[] }>(API_ROUTES.runs.get(runId));
    setRunMeta(data.run);
    setAxes(data.axes);
    setCases(data.results);
  };

  useEffect(() => {
    void load();
  }, [runId]);

  useEffect(() => {
    setOverviewAxisSelections((old) => axes.map((_, idx) => old[idx] ?? ''));
  }, [axes]);

  const filteredCases = useMemo(() => {
    const analyticalFiltered = selection === 'overview'
      ? cases
      : cases.filter((row) => {
          const clauses = selection.split('|').map((chunk) => chunk.split('='));
          return clauses.every(([level, value]) => row.analytical_values[level] === value);
        });

    const activeStatusFilter = selection === 'overview' ? 'ALL' : statusFilter;
    if (activeStatusFilter === 'ALL') return analyticalFiltered;
    return analyticalFiltered.filter((row) => row.status === activeStatusFilter);
  }, [cases, selection, statusFilter]);

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

  const selectedOverviewAxes = useMemo(
    () => overviewAxisSelections.filter((axisLevel) => axisLevel),
    [overviewAxisSelections],
  );

  const summarizeCases = (source: RunCase[]) => {
    const total = source.length;
    const ok = source.filter((runCase) => runCase.status === 'PASS').length;
    const ko = source.filter((runCase) => runCase.status === 'FAIL').length;
    const nt = source.filter((runCase) => runCase.status === 'BLOCKED').length;
    const remaining = source.filter((runCase) => runCase.status === 'NOT_RUN').length;

    return {
      total,
      remaining,
      ok,
      ko,
      nt,
      scopeValidated: total > 0 ? (ok / total) * 100 : 0,
    };
  };

  const overviewStats = useMemo<AxisValueStats[]>(() => {
    if (selectedOverviewAxes.length === 0) return [];

    const buildRows = (depth: number, source: RunCase[], keyParts: string[]): AxisValueStats[] => {
      const axisLevel = selectedOverviewAxes[depth];
      if (!axisLevel) return [];

      const axis = axes.find((item) => String(item.level_number) === axisLevel);
      const values = Array.from(new Set(source.map((item) => item.analytical_values[axisLevel]).filter(Boolean)));

      const orderedValues = axis
        ? values.sort((a, b) => {
            const aIdx = axis.values.findIndex((item) => item.value_label === a);
            const bIdx = axis.values.findIndex((item) => item.value_label === b);
            const safeA = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
            const safeB = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
            return safeA - safeB;
          })
        : values.sort((a, b) => a.localeCompare(b));

      return orderedValues.flatMap((value) => {
        const scopedCases = source.filter((runCase) => runCase.analytical_values[axisLevel] === value);
        const metrics = summarizeCases(scopedCases);
        const key = [...keyParts, `${axisLevel}=${value}`].join('|');
        const row: AxisValueStats = {
          key,
          depth,
          label: value,
          ...metrics,
        };

        return [row, ...buildRows(depth + 1, scopedCases, [...keyParts, `${axisLevel}=${value}`])];
      });
    };

    return buildRows(0, cases, []);
  }, [axes, cases, selectedOverviewAxes]);

  const grandTotalStats = useMemo(() => summarizeCases(cases), [cases]);

  const getScopeCellSx = (scopeValidated: number) => ({
    fontWeight: 700,
    ...(scopeValidated > scopeHighlightThreshold
      ? {
          bgcolor: 'success.light',
          color: 'success.dark',
          borderRadius: 1,
        }
      : {}),
  });

  const sanitizePdfText = (value: string) => value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');

  const encodePdfTextObject = (lines: string[]) => {
    const text = `BT\n/F1 11 Tf\n14 TL\n40 800 Td\n${lines.map((line) => `(${sanitizePdfText(line)}) Tj`).join('\nT*\n')}\nET`;
    return new TextEncoder().encode(text);
  };

  const collectDocumentStyles = () => Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  const base64ToBytes = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const captureElementAsJpeg = async (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));
    const serializer = new XMLSerializer();
    const clonedNode = element.cloneNode(true) as HTMLElement;
    const styles = collectDocumentStyles();
    const elementMarkup = serializer.serializeToString(clonedNode);
    const svgMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <style>${styles}</style>
            ${elementMarkup}
          </div>
        </foreignObject>
      </svg>
    `;

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const imageUrl = URL.createObjectURL(svgBlob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Impossible de capturer le tableau en image.'));
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas non disponible pour l’export PDF.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0);

      const jpegBase64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      return { width, height, bytes: base64ToBytes(jpegBase64) };
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const buildOverviewPdf = (summaryLines: string[], image: { width: number; height: number; bytes: Uint8Array }) => {
    const encoder = new TextEncoder();
    const chunks: ArrayBuffer[] = [];
    const offsets: number[] = [0];
    let totalLength = 0;

    const encode = (value: string) => encoder.encode(value);
    const append = (chunk: Uint8Array | string) => {
      const bytes = typeof chunk === 'string' ? encode(chunk) : chunk;
      chunks.push(Uint8Array.from(bytes).buffer);
      totalLength += bytes.length;
    };

    const concatBytes = (...parts: Uint8Array[]) => {
      const total = parts.reduce((sum, part) => sum + part.length, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      parts.forEach((part) => {
        merged.set(part, offset);
        offset += part.length;
      });
      return merged;
    };

    const writeObject = (id: number, body: Uint8Array) => {
      offsets[id] = totalLength;
      append(`${id} 0 obj\n`);
      append(body);
      append('\nendobj\n');
    };

    const pageWidth = 595;
    const pageHeight = 842;
    const imageMargin = 30;
    const maxImageWidth = pageWidth - imageMargin * 2;
    const maxImageHeight = pageHeight - imageMargin * 2;
    const scale = Math.min(maxImageWidth / image.width, maxImageHeight / image.height, 1);
    const renderWidth = image.width * scale;
    const renderHeight = image.height * scale;
    const renderX = (pageWidth - renderWidth) / 2;
    const renderY = (pageHeight - renderHeight) / 2;

    const textStream = encodePdfTextObject(summaryLines);
    const imagePlacementStream = encode(`q\n${renderWidth.toFixed(2)} 0 0 ${renderHeight.toFixed(2)} ${renderX.toFixed(2)} ${renderY.toFixed(2)} cm\n/Im1 Do\nQ`);

    append('%PDF-1.4\n');

    writeObject(1, encode('<< /Type /Catalog /Pages 2 0 R >>'));
    writeObject(2, encode('<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>'));
    writeObject(3, encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
    writeObject(4, encode('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>'));
    writeObject(5, concatBytes(
      encode(`<< /Length ${textStream.length} >>\nstream\n`),
      textStream,
      encode('\nendstream'),
    ));
    writeObject(6, encode('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 7 0 R >> >> /Contents 8 0 R >>'));
    writeObject(7, concatBytes(
      encode(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
      image.bytes,
      encode('\nendstream'),
    ));
    writeObject(8, concatBytes(
      encode(`<< /Length ${imagePlacementStream.length} >>\nstream\n`),
      imagePlacementStream,
      encode('\nendstream'),
    ));

    const xrefOffset = totalLength;
    append('xref\n0 9\n');
    append('0000000000 65535 f \n');
    for (let i = 1; i <= 8; i += 1) {
      append(`${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`);
    }
    append(`trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(chunks, { type: 'application/pdf' });
  };

  const exportOverviewToPdf = async () => {
    if (selection !== 'overview' || isExportingPdf) return;

    const tableElement = overviewTableRef.current;
    if (!tableElement) return;

    setIsExportingPdf(true);

    try {
      const axisLabels = selectedOverviewAxes
        .map((axisLevel) => axes.find((axis) => String(axis.level_number) === axisLevel)?.label ?? axisLevel)
        .join(' > ');

      const screenshot = await captureElementAsJpeg(tableElement);
      const summaryLines = [
        'TNR Overview Export',
        `Projet: ${runMeta?.project_name ?? '-'}`,
        `Version: ${runMeta?.release_version ?? '-'}`,
        `Run: ${runMeta?.run_number ?? '-'}`,
        `Run ID: ${runId}`,
        `Axes: ${axisLabels || 'Aucun axe selectionne'}`,
        `Seuil Scope: ${scopeHighlightThreshold}%`,
        `Genere le: ${new Date().toLocaleString()}`,
        'Page suivante: capture du tableau des resultats.',
      ];

      const blob = buildOverviewPdf(summaryLines, screenshot);
      const link = document.createElement('a');
      const dateSlug = new Date().toISOString().slice(0, 10);
      link.href = URL.createObjectURL(blob);
      link.download = `overview-run-${runId}-${dateSlug}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error(error);
      alert('Export PDF impossible. Vérifie que le tableau est visible puis réessaie.');
    } finally {
      setIsExportingPdf(false);
    }
  };
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
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="number"
              label="Seuil Scope (%)"
              value={scopeHighlightThreshold}
              onChange={(e) => setScopeHighlightThreshold(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              inputProps={{ min: 0, max: 100, step: 1 }}
              sx={{ width: 150 }}
            />
            {selection === 'overview' && (
              <Button
                variant="contained"
                startIcon={<PictureAsPdf />}
                onClick={exportOverviewToPdf}
                disabled={isExportingPdf || selectedOverviewAxes.length === 0}
              >
                {isExportingPdf ? 'Export en cours...' : 'Export to PDF'}
              </Button>
            )}
            {selection !== 'overview' && (
              <>
                <TextField
                  size="small"
                  select
                  label="Statut"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | RunCase['status'])}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="ALL">Tous</MenuItem>
                  <MenuItem value="PASS">PASS</MenuItem>
                  <MenuItem value="FAIL">FAIL</MenuItem>
                  <MenuItem value="BLOCKED">BLOCKED</MenuItem>
                  <MenuItem value="NOT_RUN">NOT_RUN</MenuItem>
                </TextField>
                <Button
                  startIcon={<Add />}
                  onClick={async () => {
                    await apiFetch(API_ROUTES.runs.casesCreate, { method: 'POST', bodyJson: { run_id: runId, insert_index: cases.length + 1 } });
                    await load();
                  }}
                >
                  Ajouter cas
                </Button>
              </>
            )}
          </Stack>
        </Stack>

        {selection === 'overview' ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {axes.map((_, idx) => {
                const current = overviewAxisSelections[idx] ?? '';
                const alreadyPicked = new Set(overviewAxisSelections.filter((value, selectionIdx) => value && selectionIdx !== idx));
                const axisOptions = axes.filter((axis) => !alreadyPicked.has(String(axis.level_number)) || String(axis.level_number) === current);

                return (
                  <TextField
                    key={`overview-axis-${idx + 1}`}
                    size="small"
                    select
                    label={`axis ${idx + 1}`}
                    value={current}
                    onChange={(e) => {
                      const next = [...overviewAxisSelections];
                      next[idx] = e.target.value;
                      for (let i = idx + 1; i < next.length; i += 1) {
                        next[i] = '';
                      }
                      setOverviewAxisSelections(next);
                    }}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="">--</MenuItem>
                    {axisOptions.map((axis) => (
                      <MenuItem key={axis.level_number} value={String(axis.level_number)}>{axis.label}</MenuItem>
                    ))}
                  </TextField>
                );
              })}
            </Stack>

            {selectedOverviewAxes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Select an analytical axis in <strong>axis 1</strong> to display the overview table.</Typography>
            ) : (
              <TableContainer ref={overviewTableRef} component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 280 }}>Row Labels</TableCell>
                      <TableCell align="right">Total Tests</TableCell>
                      <TableCell align="right">Remaining</TableCell>
                      <TableCell align="right">OK</TableCell>
                      <TableCell align="right">KO</TableCell>
                      <TableCell align="right">NT</TableCell>
                      <TableCell align="right">% Scope Validated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overviewStats.map((stat) => (
                      <TableRow key={stat.key}>
                        <TableCell sx={{ pl: 2 + stat.depth * 3, fontWeight: stat.depth === 0 ? 700 : 400 }}>{stat.label}</TableCell>
                        <TableCell align="right">{stat.total}</TableCell>
                        <TableCell align="right">{stat.remaining}</TableCell>
                        <TableCell align="right">{stat.ok}</TableCell>
                        <TableCell align="right">{stat.ko}</TableCell>
                        <TableCell align="right">{stat.nt}</TableCell>
                        <TableCell align="right" sx={getScopeCellSx(stat.scopeValidated)}>{`${stat.scopeValidated.toFixed(0)}%`}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Grand Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{grandTotalStats.total}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{grandTotalStats.remaining}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{grandTotalStats.ok}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{grandTotalStats.ko}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{grandTotalStats.nt}</TableCell>
                      <TableCell align="right" sx={getScopeCellSx(grandTotalStats.scopeValidated)}>{`${grandTotalStats.scopeValidated.toFixed(0)}%`}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 620 }}>
            <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                {axes.map((axis) => <TableCell key={axis.level_number}>{axis.label}</TableCell>)}
                <TableCell sx={{ minWidth: 260 }}>Steps</TableCell>
                <TableCell sx={{ minWidth: 260 }}>Expected</TableCell>
                <TableCell>Status</TableCell>
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
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status}
                      color={row.status === 'PASS' ? 'success' : row.status === 'FAIL' ? 'error' : row.status === 'BLOCKED' ? 'warning' : 'default'}
                      variant={row.status === 'NOT_RUN' ? 'outlined' : 'filled'}
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
        )}
      </Paper>
    </Box>
  );
}
