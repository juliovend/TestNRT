<?php
$user = require_login();
$body = read_json_body();
$id = (int) ($body['test_run_case_id'] ?? 0);
$steps = trim((string) ($body['steps'] ?? ''));
$expectedResult = trim((string) ($body['expected_result'] ?? ''));
$analyticalValues = $body['analytical_values'] ?? new stdClass();
$attachments = $body['attachments'] ?? [];

$stmt = db()->prepare('SELECT tr.project_id FROM test_run_cases trc INNER JOIN test_runs tr ON tr.id = trc.test_run_id WHERE trc.id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if (!$row) {
    json_response(['message' => 'Run test case not found'], 404);
}
require_project_membership((int) $row['project_id'], (int) $user['id']);

$update = db()->prepare('UPDATE test_run_cases SET steps = ?, expected_result = ?, analytical_values_json = ?, attachments_json = ? WHERE id = ?');
$update->execute([
    $steps,
    $expectedResult === '' ? null : $expectedResult,
    json_encode($analyticalValues, JSON_UNESCAPED_UNICODE),
    json_encode($attachments, JSON_UNESCAPED_UNICODE),
    $id,
]);
json_response(['success' => true]);
