<?php
$user = require_login();
$projectId = (int) ($_GET['project_id'] ?? 0);
if ($projectId <= 0) {
    json_response(['message' => 'project_id obligatoire'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$stmt = db()->prepare('SELECT * FROM test_cases WHERE project_id = ? ORDER BY id DESC');
$stmt->execute([$projectId]);
json_response(['test_cases' => $stmt->fetchAll()]);
