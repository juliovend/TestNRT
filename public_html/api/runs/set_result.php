<?php
$user = require_login();
$body = read_json_body();
$testRunCaseId = (int) ($body['test_run_case_id'] ?? 0);
$status = strtoupper(trim($body['status'] ?? 'NOT_RUN'));
$comment = trim($body['comment'] ?? '');
$touchExecution = array_key_exists('touch_execution', $body) ? ((int) $body['touch_execution'] === 1) : true;
$allowed = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'];
if ($testRunCaseId <= 0 || !in_array($status, $allowed, true)) {
    json_response(['message' => 'test_run_case_id ou status invalide'], 422);
}

$stmt = db()->prepare('SELECT tr.id AS run_id, tr.project_id
FROM test_run_cases trc
INNER JOIN test_runs tr ON tr.id = trc.test_run_id
WHERE trc.id = ?');
$stmt->execute([$testRunCaseId]);
$row = $stmt->fetch();
if (!$row) {
    json_response(['message' => 'Test run case introuvable'], 404);
}
require_project_membership((int) $row['project_id'], (int) $user['id']);

if ($touchExecution) {
    $update = db()->prepare('UPDATE test_run_results SET status = ?, comment = ?, tester_id = ?, tested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE test_run_case_id = ?');
    $update->execute([$status, $comment ?: null, $user['id'], $testRunCaseId]);
} else {
    $update = db()->prepare('UPDATE test_run_results SET status = ?, comment = ?, updated_at = CURRENT_TIMESTAMP WHERE test_run_case_id = ?');
    $update->execute([$status, $comment ?: null, $testRunCaseId]);
}
json_response(['success' => true]);
