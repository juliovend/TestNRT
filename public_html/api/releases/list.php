<?php
$user = require_login();
$projectId = (int) ($_GET['project_id'] ?? 0);
if ($projectId <= 0) {
    json_response(['message' => 'project_id obligatoire'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$stmt = db()->prepare('SELECT * FROM releases WHERE project_id = ? ORDER BY created_at DESC');
$stmt->execute([$projectId]);
json_response(['releases' => $stmt->fetchAll()]);
