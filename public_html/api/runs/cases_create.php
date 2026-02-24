<?php
$user = require_login();
$body = read_json_body();
$runId = (int) ($body['run_id'] ?? 0);
$insertIndex = (int) ($body['insert_index'] ?? 0);

if ($runId <= 0) {
    json_response(['message' => 'run_id obligatoire'], 422);
}

$pdo = db();
$runStmt = $pdo->prepare('SELECT project_id FROM test_runs WHERE id = ?');
$runStmt->execute([$runId]);
$run = $runStmt->fetch();
if (!$run) {
    json_response(['message' => 'Run introuvable'], 404);
}
require_project_membership((int) $run['project_id'], (int) $user['id']);

$countStmt = $pdo->prepare('SELECT COUNT(*) FROM test_run_cases WHERE test_run_id = ?');
$countStmt->execute([$runId]);
$count = (int) $countStmt->fetchColumn();
if ($insertIndex < 1 || $insertIndex > $count + 1) {
    $insertIndex = $count + 1;
}

$pdo->beginTransaction();
try {
    $shift = $pdo->prepare('UPDATE test_run_cases SET case_number = case_number + 1 WHERE test_run_id = ? AND case_number >= ?');
    $shift->execute([$runId, $insertIndex]);

    $insertCase = $pdo->prepare('INSERT INTO test_run_cases(test_run_id, test_case_id, case_number, steps, expected_result, analytical_values_json, attachments_json, is_active) VALUES (?, NULL, ?, ?, NULL, ?, ?, 1)');
    $insertCase->execute([$runId, $insertIndex, '', json_encode(new stdClass()), json_encode([])]);
    $runCaseId = (int) $pdo->lastInsertId();

    $insertResult = $pdo->prepare('INSERT INTO test_run_results(test_run_case_id, status, comment) VALUES (?, "NOT_RUN", NULL)');
    $insertResult->execute([$runCaseId]);

    $pdo->commit();
    json_response(['test_run_case_id' => $runCaseId], 201);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Erreur création test case run', 'details' => $e->getMessage()], 500);
}
