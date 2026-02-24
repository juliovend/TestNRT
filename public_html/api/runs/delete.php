<?php
$user = require_login();
$body = read_json_body();
$runId = (int) ($body['run_id'] ?? 0);
if ($runId <= 0) {
    json_response(['message' => 'run_id obligatoire'], 422);
}

$stmt = db()->prepare('SELECT project_id FROM test_runs WHERE id = ?');
$stmt->execute([$runId]);
$run = $stmt->fetch();
if (!$run) {
    json_response(['message' => 'Run introuvable'], 404);
}
require_project_membership((int) $run['project_id'], (int) $user['id']);

db()->prepare('DELETE FROM test_runs WHERE id = ?')->execute([$runId]);
json_response(['success' => true]);
