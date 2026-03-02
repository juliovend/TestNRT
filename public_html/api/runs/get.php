<?php
$user = require_login();
$runId = (int) ($_GET['run_id'] ?? ($_GET['id'] ?? 0));
if ($runId <= 0) {
    json_response(['message' => 'run_id is required'], 422);
}

$runStmt = db()->prepare('SELECT tr.*, p.name AS project_name, r.version AS release_version FROM test_runs tr INNER JOIN projects p ON p.id = tr.project_id INNER JOIN releases r ON r.id = tr.release_id WHERE tr.id = ?');
$runStmt->execute([$runId]);
$run = $runStmt->fetch();
if (!$run) {
    json_response(['message' => 'Run not found'], 404);
}
require_project_membership((int) $run['project_id'], (int) $user['id']);

$axesStmt = db()->prepare('SELECT a.id, a.level_number, a.label, v.id AS value_id, v.value_label, v.sort_order
FROM test_book_axes a
LEFT JOIN test_book_axis_values v ON v.axis_id = a.id
WHERE a.project_id = ?
ORDER BY a.level_number ASC, v.sort_order ASC, v.id ASC');
$axesStmt->execute([(int) $run['project_id']]);
$axesRows = $axesStmt->fetchAll();
$axes = [];
foreach ($axesRows as $row) {
    $level = (int) $row['level_number'];
    if (!isset($axes[$level])) {
        $axes[$level] = [
            'id' => (int) $row['id'],
            'level_number' => $level,
            'label' => $row['label'],
            'values' => [],
        ];
    }
    if ($row['value_id'] !== null) {
        $axes[$level]['values'][] = [
            'id' => (int) $row['value_id'],
            'value_label' => $row['value_label'],
            'sort_order' => (int) $row['sort_order'],
        ];
    }
}
$axes = array_values($axes);

$statusFilter = strtoupper(trim((string) ($_GET['status'] ?? 'ALL')));
$allowedStatuses = ['ALL', 'NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED'];
if (!in_array($statusFilter, $allowedStatuses, true)) {
    $statusFilter = 'ALL';
}

$page = max(0, (int) ($_GET['page'] ?? 0));
$perPage = max(1, min(250, (int) ($_GET['per_page'] ?? 0)));
$isPaginatedRequest = isset($_GET['page']) || isset($_GET['per_page']) || isset($_GET['status']);

$summaryStmt = db()->prepare('SELECT trr.status, COUNT(*) AS c
FROM test_run_cases trc
INNER JOIN test_run_results trr ON trr.test_run_case_id = trc.id
WHERE trc.test_run_id = ?
GROUP BY trr.status');
$summaryStmt->execute([$runId]);
$summaryRows = $summaryStmt->fetchAll();
$summary = ['total' => 0, 'pass' => 0, 'fail' => 0, 'blocked' => 0, 'skipped' => 0, 'not_run' => 0];
foreach ($summaryRows as $summaryRow) {
    $status = strtolower((string) $summaryRow['status']);
    $count = (int) $summaryRow['c'];
    $summary['total'] += $count;
    if (array_key_exists($status, $summary)) {
        $summary[$status] = $count;
    }
}

$whereStatusSql = '';
$params = [$runId];
if ($statusFilter !== 'ALL') {
    $whereStatusSql = ' AND trr.status = ?';
    $params[] = $statusFilter;
}

$countStmt = db()->prepare('SELECT COUNT(*) FROM test_run_cases trc
INNER JOIN test_run_results trr ON trr.test_run_case_id = trc.id
WHERE trc.test_run_id = ?' . $whereStatusSql);
$countStmt->execute($params);
$filteredTotal = (int) $countStmt->fetchColumn();

$resultsSql = 'SELECT trc.id AS test_run_case_id, trc.test_case_id, trc.case_number, trc.steps, trc.expected_result, trc.analytical_values_json, trc.attachments_json, trr.status, trr.comment, trr.tested_at, u.name AS tester_name, u.email AS tester_email
FROM test_run_cases trc
INNER JOIN test_run_results trr ON trr.test_run_case_id = trc.id
LEFT JOIN users u ON u.id = trr.tester_id
WHERE trc.test_run_id = ?' . $whereStatusSql . '
ORDER BY trc.case_number ASC, trc.id ASC';
if ($isPaginatedRequest) {
    $resultsSql .= '
LIMIT ? OFFSET ?';
}
$resultsStmt = db()->prepare($resultsSql);
$resultsParams = $params;
if ($isPaginatedRequest) {
    $resultsParams[] = $perPage;
    $resultsParams[] = $page * $perPage;
}
$resultsStmt->execute($resultsParams);
$results = $resultsStmt->fetchAll();

foreach ($results as &$row) {
    $row['analytical_values'] = $row['analytical_values_json'] ? json_decode((string) $row['analytical_values_json'], true) : new stdClass();
    $row['attachments'] = $row['attachments_json'] ? json_decode((string) $row['attachments_json'], true) : [];
    unset($row['analytical_values_json'], $row['attachments_json']);
}
unset($row);

$response = ['run' => $run, 'axes' => $axes, 'summary' => $summary, 'results' => $results];
if ($isPaginatedRequest) {
    $response['pagination'] = [
        'page' => $page,
        'per_page' => $perPage,
        'total' => $filteredTotal,
        'status' => $statusFilter,
    ];
}

json_response($response);
