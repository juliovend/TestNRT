<?php
$user = require_login();
$body = read_json_body();
$id = (int) ($body['id'] ?? 0);
$description = trim((string) ($body['description'] ?? ''));
$expectedResult = trim((string) ($body['expected_result'] ?? ''));
$analyticalValues = $body['analytical_values'] ?? new stdClass();
$attachments = $body['attachments'] ?? [];
$isActive = isset($body['is_active']) ? ((int) $body['is_active'] ? 1 : 0) : 1;

$stmt = db()->prepare('SELECT project_id FROM test_cases WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if (!$row) {
    json_response(['message' => 'Test case introuvable'], 404);
}
require_project_membership((int) $row['project_id'], (int) $user['id']);

$update = db()->prepare('UPDATE test_cases SET steps = ?, expected_result = ?, analytical_values_json = ?, attachments_json = ?, is_active = ? WHERE id = ?');
$update->execute([
    $description,
    $expectedResult === '' ? null : $expectedResult,
    json_encode($analyticalValues, JSON_UNESCAPED_UNICODE),
    json_encode($attachments, JSON_UNESCAPED_UNICODE),
    $isActive,
    $id,
]);

json_response(['success' => true]);
