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

$resultsStmt = db()->prepare('SELECT trc.id AS test_run_case_id, tc.title, tc.steps, trr.status, trr.comment
FROM test_run_cases trc
INNER JOIN test_cases tc ON tc.id = trc.test_case_id
INNER JOIN test_run_results trr ON trr.test_run_case_id = trc.id
WHERE trc.test_run_id = ?
ORDER BY trc.id');
$resultsStmt->execute([$runId]);
$results = $resultsStmt->fetchAll();

$summary = ['total' => 0, 'pass' => 0, 'fail' => 0, 'blocked' => 0, 'not_run' => 0];
foreach ($results as $row) {
    $summary['total']++;
    $status = strtolower($row['status']);
    if (isset($summary[$status])) {
        $summary[$status]++;
    }
}

json_response(['run' => $run, 'summary' => $summary, 'results' => $results]);
