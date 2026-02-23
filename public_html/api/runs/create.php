<?php
$user = require_login();
$body = read_json_body();
$projectId = (int) ($body['project_id'] ?? 0);
$releaseId = (int) ($body['release_id'] ?? 0);

if ($projectId <= 0 || $releaseId <= 0) {
    json_response(['message' => 'project_id et release_id obligatoires'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$pdo = db();
$pdo->beginTransaction();
try {
    $insertRun = $pdo->prepare('INSERT INTO test_runs(project_id, release_id, created_by, status) VALUES (?, ?, ?, "IN_PROGRESS")');
    $insertRun->execute([$projectId, $releaseId, $user['id']]);
    $runId = (int) $pdo->lastInsertId();

    $stmtCases = $pdo->prepare('SELECT id FROM test_cases WHERE project_id = ? AND is_active = 1');
    $stmtCases->execute([$projectId]);
    $cases = $stmtCases->fetchAll();

    $insertRunCase = $pdo->prepare('INSERT INTO test_run_cases(test_run_id, test_case_id) VALUES (?, ?)');
    $insertResult = $pdo->prepare('INSERT INTO test_run_results(test_run_case_id, status, comment) VALUES (?, "NOT_RUN", NULL)');

    foreach ($cases as $case) {
        $insertRunCase->execute([$runId, $case['id']]);
        $testRunCaseId = (int) $pdo->lastInsertId();
        $insertResult->execute([$testRunCaseId]);
    }

    $pdo->commit();
    json_response(['run_id' => $runId, 'test_case_count' => count($cases)], 201);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Erreur création run', 'details' => $e->getMessage()], 500);
}
