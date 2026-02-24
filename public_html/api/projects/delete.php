<?php
$user = require_login();
$body = read_json_body();
$projectId = (int) ($body['project_id'] ?? 0);
if ($projectId <= 0) {
    json_response(['message' => 'project_id obligatoire'], 422);
}
require_project_membership($projectId, (int) $user['id']);

db()->prepare('DELETE FROM projects WHERE id = ?')->execute([$projectId]);
json_response(['success' => true]);
