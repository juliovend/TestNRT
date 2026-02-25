<?php
$user = require_login();
$body = read_json_body();
$id = (int) ($body['id'] ?? 0);

$pdo = db();
$stmt = $pdo->prepare('SELECT project_id, case_number FROM test_cases WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if (!$row) {
    json_response(['message' => 'Test case not found'], 404);
}
$projectId = (int) $row['project_id'];
$caseNumber = (int) $row['case_number'];
require_project_membership($projectId, (int) $user['id']);

$pdo->beginTransaction();
try {
    $delete = $pdo->prepare('DELETE FROM test_cases WHERE id = ?');
    $delete->execute([$id]);

    $shift = $pdo->prepare('UPDATE test_cases SET case_number = case_number - 1 WHERE project_id = ? AND case_number > ?');
    $shift->execute([$projectId, $caseNumber]);

    $pdo->commit();
    json_response(['success' => true]);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Deletion error', 'details' => $e->getMessage()], 500);
}
