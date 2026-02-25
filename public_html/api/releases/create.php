<?php
$user = require_login();
$body = read_json_body();
$projectId = (int) ($body['project_id'] ?? 0);
$version = trim($body['version'] ?? '');
$notes = trim($body['notes'] ?? '');
if ($projectId <= 0 || $version === '') {
    json_response(['message' => 'project_id and version are required'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$stmt = db()->prepare('INSERT INTO releases(project_id, version, notes, created_by) VALUES (?, ?, ?, ?)');
$stmt->execute([$projectId, $version, $notes ?: null, $user['id']]);
json_response(['release_id' => (int) db()->lastInsertId()], 201);
