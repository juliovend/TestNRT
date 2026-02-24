<?php
$user = require_login();
$body = read_json_body();
$id = (int) ($body['test_run_case_id'] ?? 0);

$pdo = db();
$stmt = $pdo->prepare('SELECT tr.project_id, trc.test_run_id, trc.case_number FROM test_run_cases trc INNER JOIN test_runs tr ON tr.id = trc.test_run_id WHERE trc.id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if (!$row) {
    json_response(['message' => 'Test case run introuvable'], 404);
}
require_project_membership((int) $row['project_id'], (int) $user['id']);

$pdo->beginTransaction();
try {
    $delete = $pdo->prepare('DELETE FROM test_run_cases WHERE id = ?');
    $delete->execute([$id]);

    $shift = $pdo->prepare('UPDATE test_run_cases SET case_number = case_number - 1 WHERE test_run_id = ? AND case_number > ?');
    $shift->execute([(int) $row['test_run_id'], (int) $row['case_number']]);

    $pdo->commit();
    json_response(['success' => true]);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Erreur suppression test case run', 'details' => $e->getMessage()], 500);
}
