<?php
$user = require_login();
$runId = (int) ($_GET['run_id'] ?? ($_GET['id'] ?? 0));
if ($runId <= 0) {
    json_response(['message' => 'run_id obligatoire'], 422);
}

$stmt = db()->prepare('SELECT * FROM test_runs WHERE id = ?');
$stmt->execute([$runId]);
$run = $stmt->fetch();
if (!$run) {
    json_response(['message' => 'Run introuvable'], 404);
}
require_project_membership((int) $run['project_id'], (int) $user['id']);

$resultsStmt = db()->prepare('SELECT trc.test_case_id, tc.title, trr.status, trr.comment, trr.updated_at AS executed_at
FROM test_run_cases trc
INNER JOIN test_cases tc ON tc.id = trc.test_case_id
INNER JOIN test_run_results trr ON trr.test_run_case_id = trc.id
WHERE trc.test_run_id = ?
ORDER BY trc.id');
$resultsStmt->execute([$runId]);
$results = $resultsStmt->fetchAll();

$filename = sprintf('run_%d_export.csv', $runId);
http_response_code(200);
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$output = fopen('php://output', 'w');
if ($output === false) {
    json_response(['message' => 'Impossible de générer le CSV'], 500);
}

fputcsv($output, ['test_case_id', 'title', 'status', 'comment', 'executed_at']);
foreach ($results as $row) {
    fputcsv($output, [
        (string) $row['test_case_id'],
        (string) $row['title'],
        (string) $row['status'],
        (string) ($row['comment'] ?? ''),
        (string) $row['executed_at'],
    ]);
}

fclose($output);
exit;
