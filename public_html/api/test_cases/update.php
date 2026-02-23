<?php
$user = require_login();
$body = read_json_body();
$id = (int) ($body['id'] ?? 0);
$title = trim($body['title'] ?? '');
$steps = trim($body['steps'] ?? '');
$expectedResult = trim($body['expected_result'] ?? '');
$isActive = isset($body['is_active']) ? (int) $body['is_active'] : 1;

$stmt = db()->prepare('SELECT project_id FROM test_cases WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
if (!$row) {
    json_response(['message' => 'Test case introuvable'], 404);
}
require_project_membership((int) $row['project_id'], (int) $user['id']);

$update = db()->prepare('UPDATE test_cases SET title = ?, steps = ?, expected_result = ?, is_active = ? WHERE id = ?');
$update->execute([$title, $steps, $expectedResult ?: null, $isActive ? 1 : 0, $id]);
json_response(['success' => true]);
