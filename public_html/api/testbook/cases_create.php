<?php
$user = require_login();
$body = read_json_body();
$projectId = (int) ($body['project_id'] ?? 0);
$insertIndex = (int) ($body['insert_index'] ?? 0);
$description = trim((string) ($body['description'] ?? ''));
$expectedResult = trim((string) ($body['expected_result'] ?? ''));
$analyticalValues = $body['analytical_values'] ?? new stdClass();
$attachments = $body['attachments'] ?? [];

if ($projectId <= 0) {
    json_response(['message' => 'project_id is required'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$pdo = db();
$countStmt = $pdo->prepare('SELECT COUNT(*) FROM test_cases WHERE project_id = ?');
$countStmt->execute([$projectId]);
$count = (int) $countStmt->fetchColumn();

if ($insertIndex < 1 || $insertIndex > $count + 1) {
    $insertIndex = $count + 1;
}

$pdo->beginTransaction();
try {
    $shift = $pdo->prepare('UPDATE test_cases SET case_number = case_number + 1 WHERE project_id = ? AND case_number >= ?');
    $shift->execute([$projectId, $insertIndex]);

    $insert = $pdo->prepare('INSERT INTO test_cases(project_id, case_number, title, steps, expected_result, analytical_values_json, attachments_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $insert->execute([
        $projectId,
        $insertIndex,
        'Test case',
        $description,
        $expectedResult === '' ? null : $expectedResult,
        json_encode($analyticalValues, JSON_UNESCAPED_UNICODE),
        json_encode($attachments, JSON_UNESCAPED_UNICODE),
        $user['id'],
    ]);

    $pdo->commit();
    json_response(['test_case_id' => (int) $pdo->lastInsertId()], 201);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Error creating test case', 'details' => $e->getMessage()], 500);
}
