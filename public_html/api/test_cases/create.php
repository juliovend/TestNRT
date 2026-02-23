<?php
$user = require_login();
$body = read_json_body();
$projectId = (int) ($body['project_id'] ?? 0);
$title = trim($body['title'] ?? '');
$steps = trim($body['steps'] ?? '');
$expectedResult = trim($body['expected_result'] ?? '');

if ($projectId <= 0 || $title === '' || $steps === '') {
    json_response(['message' => 'project_id, title et steps obligatoires'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$stmt = db()->prepare('INSERT INTO test_cases(project_id, title, steps, expected_result, created_by) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$projectId, $title, $steps, $expectedResult ?: null, $user['id']]);
json_response(['test_case_id' => (int) db()->lastInsertId()], 201);
