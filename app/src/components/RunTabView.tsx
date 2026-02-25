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

  const cloneWithComputedStyles = (node: HTMLElement) => {
    const clone = node.cloneNode(true) as HTMLElement;

    const applyStyles = (source: Element, target: Element) => {
      if (source instanceof HTMLElement && target instanceof HTMLElement) {
        const computed = window.getComputedStyle(source);
        const cssText = Array.from(computed)
          .map((prop) => `${prop}:${computed.getPropertyValue(prop)};`)
          .join('');
        target.style.cssText = cssText;
      }

      const sourceChildren = Array.from(source.children);
      const targetChildren = Array.from(target.children);
      sourceChildren.forEach((sourceChild, idx) => {
        const targetChild = targetChildren[idx];
        if (targetChild) {
          applyStyles(sourceChild, targetChild);
        }
      });
    };

    applyStyles(node, clone);
    return clone;
  };

  const tableToJpegBytes = async (tableElement: HTMLElement) => {
    const rect = tableElement.getBoundingClientRect();
    const width = Math.max(Math.ceil(rect.width), 1);
    const height = Math.max(Math.ceil(rect.height), 1);
    const scale = Math.min(window.devicePixelRatio || 1, 2);

    const clonedNode = cloneWithComputedStyles(tableElement);
    clonedNode.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

    const serializer = new XMLSerializer();
    const markup = serializer.serializeToString(clonedNode);
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to convert overview table into an image.'));
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(Math.floor(width * scale), 1);
      canvas.height = Math.max(Math.floor(height * scale), 1);
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas rendering is not available in this browser.');
      }

      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const byteString = atob(dataUrl.split(',')[1]);
      const bytes = Uint8Array.from(byteString, (char) => char.charCodeAt(0));
      return { bytes, width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const buildPdfWithImage = (headerLines: string[], imageBytes: Uint8Array, imageWidth: number, imageHeight: number) => {
    const encoder = new TextEncoder();
    const asBytes = (value: string) => encoder.encode(value);
    const concat = (chunks: Uint8Array[]) => {
      const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const output = new Uint8Array(size);
      let offset = 0;
      chunks.forEach((chunk) => {
        output.set(chunk, offset);
        offset += chunk.length;
      });
      return output;
    };

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
    const lineHeight = 14;
    const headerTopY = pageHeight - margin;
    const imageMaxWidth = pageWidth - margin * 2;
    const availableImageHeight = pageHeight - margin * 2 - headerLines.length * lineHeight - 20;
    const ratio = Math.min(imageMaxWidth / imageWidth, availableImageHeight / imageHeight, 1);
    const drawWidth = Math.max(1, Math.floor(imageWidth * ratio));
    const drawHeight = Math.max(1, Math.floor(imageHeight * ratio));

    const headerCommands = headerLines
      .map((line, idx) => {
        const y = headerTopY - idx * lineHeight;
        return `BT /F1 11 Tf ${margin} ${y} Td (${sanitizePdfText(line)}) Tj ET`;
      })
      .join('\n');

    const contentStream = `${headerCommands}\nq\n${drawWidth} 0 0 ${drawHeight} ${margin} ${margin} cm\n/Im1 Do\nQ\n`;

    const objects: Record<number, Uint8Array> = {
      1: asBytes('<< /Type /Catalog /Pages 2 0 R >>'),
      2: asBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      3: asBytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>'),
      4: asBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
      5: concat([
        asBytes(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`),
        imageBytes,
        asBytes('\nendstream'),
      ]),
      6: asBytes(`<< /Length ${asBytes(contentStream).length} >>\nstream\n${contentStream}endstream`),
    };

    const objectIds = Object.keys(objects).map(Number).sort((a, b) => a - b);
    const parts: Uint8Array[] = [];
    const offsets: number[] = [0];
    let cursor = 0;

    const header = asBytes('%PDF-1.4\n');
    parts.push(header);
    cursor += header.length;

    objectIds.forEach((id) => {
      offsets[id] = cursor;
      const open = asBytes(`${id} 0 obj\n`);
      const close = asBytes('\nendobj\n');
      parts.push(open, objects[id], close);
      cursor += open.length + objects[id].length + close.length;
    });

    const size = Math.max(...objectIds) + 1;
    const xrefOffset = cursor;
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let i = 1; i < size; i += 1) {
      xref += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(asBytes(xref), asBytes(trailer));

    return new Blob(parts as unknown as BlobPart[], { type: 'application/pdf' });
  };

  const exportOverviewToPdf = async () => {
    if (selection !== 'overview') return;

    const tableElement = overviewTableRef.current;
    if (!tableElement) return;

    try {

    const axisLabels = selectedOverviewAxes
      .map((axisLevel) => axes.find((axis) => String(axis.level_number) === axisLevel)?.label ?? axisLevel)
      .join(' > ');

    const { bytes, width, height } = await tableToJpegBytes(tableElement);

    const headerLines = [
      `Project: ${runMeta?.project_name ?? '-'}`,
      `Version: ${runMeta?.release_version ?? '-'}`,
      `Run: #${runMeta?.run_number ?? runId} (id ${runId})`,
      `Axes: ${axisLabels || 'None selected'}`,
      `Scope threshold: ${scopeHighlightThreshold}%`,
      `Generated: ${new Date().toLocaleString()}`,
    ];

    const blob = buildPdfWithImage(headerLines, bytes, width, height);
    const link = document.createElement('a');
    const dateSlug = new Date().toISOString().slice(0, 10);
    const runLabel = runMeta?.run_number ?? runId;
    const href = URL.createObjectURL(blob);
    link.href = href;
    link.download = `overview-run-${runLabel}-${dateSlug}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (error) {
      console.error(error);
      window.alert('Impossible de générer le PDF. Réessayez après avoir affiché le tableau Overview.');
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
                onClick={() => void exportOverviewToPdf()}
                disabled={selectedOverviewAxes.length === 0}
              >
                Export to PDF
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
