<?php
$user = require_login();

$projectId = (int) ($_POST['project_id'] ?? 0);
if ($projectId <= 0) {
    json_response(['message' => 'project_id is required'], 422);
}

require_project_membership($projectId, (int) $user['id']);

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    json_response(['message' => 'Excel file is required'], 422);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_response(['message' => 'Invalid uploaded file'], 422);
}

$tmpPath = (string) ($file['tmp_name'] ?? '');
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    json_response(['message' => 'Invalid uploaded file'], 422);
}

function xml_cell_to_string(SimpleXMLElement $cell, array $sharedStrings): string
{
    $type = (string) ($cell['t'] ?? '');

    if ($type === 's') {
        $index = (int) ($cell->v ?? 0);
        return isset($sharedStrings[$index]) ? trim($sharedStrings[$index]) : '';
    }

    if ($type === 'inlineStr') {
        if (isset($cell->is->t)) {
            return trim((string) $cell->is->t);
        }

        $parts = [];
        if (isset($cell->is->r)) {
            foreach ($cell->is->r as $run) {
                $parts[] = (string) ($run->t ?? '');
            }
        }

        return trim(implode('', $parts));
    }

    return trim((string) ($cell->v ?? ''));
}

function column_letters_to_index(string $letters): int
{
    $letters = strtoupper($letters);
    $index = 0;

    for ($i = 0; $i < strlen($letters); $i++) {
        $char = ord($letters[$i]);
        if ($char < 65 || $char > 90) {
            continue;
        }
        $index = ($index * 26) + ($char - 64);
    }

    return max(0, $index - 1);
}

function normalize_zip_path(string $path): string
{
    $path = str_replace('\\', '/', $path);
    $parts = [];

    foreach (explode('/', $path) as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..') {
            array_pop($parts);
            continue;
        }
        $parts[] = $part;
    }

    return implode('/', $parts);
}

function read_xlsx_rows(string $path): array
{
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new RuntimeException('Unable to open Excel file.');
    }

    $sharedStrings = [];
    $sharedXml = $zip->getFromName('xl/sharedStrings.xml');
    if (is_string($sharedXml) && $sharedXml !== '') {
        $xml = simplexml_load_string($sharedXml);
        if ($xml instanceof SimpleXMLElement && isset($xml->si)) {
            foreach ($xml->si as $si) {
                if (isset($si->t)) {
                    $sharedStrings[] = (string) $si->t;
                    continue;
                }

                $parts = [];
                if (isset($si->r)) {
                    foreach ($si->r as $run) {
                        $parts[] = (string) ($run->t ?? '');
                    }
                }
                $sharedStrings[] = implode('', $parts);
            }
        }
    }

    $sheetPath = 'xl/worksheets/sheet1.xml';
    $workbookXml = $zip->getFromName('xl/workbook.xml');
    $workbookRelsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');

    if (is_string($workbookXml) && is_string($workbookRelsXml)) {
        $workbook = simplexml_load_string($workbookXml);
        $rels = simplexml_load_string($workbookRelsXml);

        if ($workbook instanceof SimpleXMLElement && $rels instanceof SimpleXMLElement) {
            $relMap = [];
            foreach ($rels->Relationship as $rel) {
                $id = (string) ($rel['Id'] ?? '');
                $target = (string) ($rel['Target'] ?? '');
                if ($id !== '' && $target !== '') {
                    $relMap[$id] = normalize_zip_path('xl/' . $target);
                }
            }

            $ns = $workbook->getNamespaces(true);
            $rid = '';
            if (isset($workbook->sheets->sheet[0])) {
                $sheet = $workbook->sheets->sheet[0];
                $attributes = isset($ns['r']) ? $sheet->attributes($ns['r']) : null;
                $rid = (string) ($attributes['id'] ?? '');
            }

            if ($rid !== '' && isset($relMap[$rid])) {
                $sheetPath = $relMap[$rid];
            }
        }
    }

    $sheetXml = $zip->getFromName($sheetPath);
    $zip->close();

    if (!is_string($sheetXml) || $sheetXml === '') {
        throw new RuntimeException('Unable to read first worksheet.');
    }

    $sheet = simplexml_load_string($sheetXml);
    if (!$sheet instanceof SimpleXMLElement) {
        throw new RuntimeException('Invalid worksheet format.');
    }

    $rows = [];
    if (!isset($sheet->sheetData->row)) {
        return $rows;
    }

    foreach ($sheet->sheetData->row as $rowNode) {
        $cells = [];
        $maxIndex = -1;

        foreach ($rowNode->c as $cell) {
            $reference = (string) ($cell['r'] ?? '');
            $letters = preg_replace('/\d+/', '', $reference);
            $index = column_letters_to_index((string) $letters);
            $cells[$index] = xml_cell_to_string($cell, $sharedStrings);
            $maxIndex = max($maxIndex, $index);
        }

        if ($maxIndex < 0) {
            continue;
        }

        $row = [];
        for ($i = 0; $i <= $maxIndex; $i++) {
            $row[] = isset($cells[$i]) ? trim((string) $cells[$i]) : '';
        }

        $rows[] = $row;
    }

    return $rows;
}

$pdo = db();
$axesStmt = $pdo->prepare('SELECT id, level_number, label FROM test_book_axes WHERE project_id = ? ORDER BY level_number ASC');
$axesStmt->execute([$projectId]);
$axes = $axesStmt->fetchAll();

if (!$axes) {
    json_response(['message' => 'Define test book axes before importing.'], 422);
}

$valueStmt = $pdo->prepare('SELECT axis_id, value_label FROM test_book_axis_values WHERE axis_id IN (' . implode(',', array_fill(0, count($axes), '?')) . ') ORDER BY sort_order ASC, id ASC');
$valueStmt->execute(array_map(static fn(array $axis): int => (int) $axis['id'], $axes));
$axisValuesById = [];
foreach ($valueStmt->fetchAll() as $entry) {
    $axisId = (int) $entry['axis_id'];
    if (!isset($axisValuesById[$axisId])) {
        $axisValuesById[$axisId] = [];
    }
    $axisValuesById[$axisId][] = trim((string) $entry['value_label']);
}

try {
    $rows = read_xlsx_rows($tmpPath);
} catch (Throwable $e) {
    json_response(['message' => 'Unable to parse Excel file', 'details' => $e->getMessage()], 422);
}

if (count($rows) === 0) {
    json_response(['message' => 'Excel file is empty'], 422);
}

$headers = array_map(static fn($value): string => trim((string) $value), $rows[0]);
$normalizedHeaders = array_map(static fn(string $value): string => strtolower($value), $headers);
$stepsIndex = array_search('steps', $normalizedHeaders, true);
$expectedIndex = array_search('expected', $normalizedHeaders, true);

if ($stepsIndex === false || $expectedIndex === false) {
    json_response(['message' => 'Excel file must contain "Steps" and "Expected" columns'], 422);
}

if ($expectedIndex <= $stepsIndex) {
    json_response(['message' => '"Expected" column must be after "Steps" column'], 422);
}

$axisHeaders = array_slice($headers, 0, $stepsIndex);
if (count($axisHeaders) !== count($axes)) {
    json_response(['message' => 'Analytical columns before "Steps" do not match defined axes'], 422);
}

foreach ($axes as $index => $axis) {
    $actual = trim((string) ($axisHeaders[$index] ?? ''));
    $expected = trim((string) ($axis['label'] ?? ''));
    if ($actual !== $expected) {
        json_response(['message' => 'Analytical column mismatch', 'details' => sprintf('Column "%s" should be "%s"', $actual, $expected)], 422);
    }
}

$axisValueSets = [];
foreach ($axes as $axis) {
    $axisId = (int) $axis['id'];
    $existing = $axisValuesById[$axisId] ?? [];
    $axisValueSets[$axisId] = [];
    foreach ($existing as $label) {
        if ($label !== '') {
            $axisValueSets[$axisId][$label] = true;
        }
    }
}

$casesToCreate = [];
foreach (array_slice($rows, 1) as $row) {
    $analytical = [];
    foreach ($axes as $index => $axis) {
        $value = trim((string) ($row[$index] ?? ''));
        if ($value === '') {
            continue;
        }
        $level = (string) ((int) $axis['level_number']);
        $analytical[$level] = $value;
        $axisValueSets[(int) $axis['id']][$value] = true;
    }

    $steps = trim((string) ($row[$stepsIndex] ?? ''));
    $expected = trim((string) ($row[$expectedIndex] ?? ''));

    if ($steps === '' && $expected === '' && count($analytical) === 0) {
        continue;
    }

    $casesToCreate[] = [
        'steps' => $steps,
        'expected_result' => $expected,
        'analytical_values' => $analytical,
    ];
}

if (!$casesToCreate) {
    json_response(['message' => 'No valid test case rows found in Excel file'], 422);
}

$pdo->beginTransaction();
try {
    $delAxes = $pdo->prepare('DELETE FROM test_book_axes WHERE project_id = ?');
    $delAxes->execute([$projectId]);

    $insertAxis = $pdo->prepare('INSERT INTO test_book_axes(project_id, level_number, label) VALUES (?, ?, ?)');
    $insertAxisValue = $pdo->prepare('INSERT INTO test_book_axis_values(axis_id, value_label, sort_order) VALUES (?, ?, ?)');

    $axisIdByLevel = [];
    foreach ($axes as $axis) {
        $level = (int) $axis['level_number'];
        $label = trim((string) $axis['label']);

        $insertAxis->execute([$projectId, $level, $label]);
        $newAxisId = (int) $pdo->lastInsertId();
        $axisIdByLevel[(string) $level] = $newAxisId;

        $sortOrder = 1;
        foreach (array_keys($axisValueSets[(int) $axis['id']]) as $valueLabel) {
            $cleanValue = trim((string) $valueLabel);
            if ($cleanValue === '') {
                continue;
            }
            $insertAxisValue->execute([$newAxisId, $cleanValue, $sortOrder]);
            $sortOrder++;
        }

        if ($sortOrder === 1) {
            throw new RuntimeException('Each axis must contain at least one value');
        }
    }

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM test_cases WHERE project_id = ?');
    $countStmt->execute([$projectId]);
    $nextCaseNumber = (int) $countStmt->fetchColumn() + 1;

    $insertCase = $pdo->prepare('INSERT INTO test_cases(project_id, case_number, title, steps, expected_result, analytical_values_json, attachments_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    foreach ($casesToCreate as $case) {
        $mappedAnalytical = [];
        foreach ($case['analytical_values'] as $level => $value) {
            if (isset($axisIdByLevel[$level])) {
                $mappedAnalytical[$level] = $value;
            }
        }

        $insertCase->execute([
            $projectId,
            $nextCaseNumber,
            'Test case',
            $case['steps'],
            $case['expected_result'] === '' ? null : $case['expected_result'],
            json_encode($mappedAnalytical, JSON_UNESCAPED_UNICODE),
            json_encode([], JSON_UNESCAPED_UNICODE),
            $user['id'],
        ]);

        $nextCaseNumber++;
    }

    $pdo->commit();
    json_response(['success' => true, 'created_count' => count($casesToCreate)]);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Excel import failed', 'details' => $e->getMessage()], 422);
}
