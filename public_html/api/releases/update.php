<?php
$user = require_login();
$body = read_json_body();
$releaseId = (int) ($body['release_id'] ?? 0);
$version = trim($body['version'] ?? '');
$notes = trim($body['notes'] ?? '');
if ($releaseId <= 0 || $version === '') {
    json_response(['message' => 'release_id et version obligatoires'], 422);
}

$stmt = db()->prepare('SELECT project_id FROM releases WHERE id = ?');
$stmt->execute([$releaseId]);
$release = $stmt->fetch();
if (!$release) {
    json_response(['message' => 'Version introuvable'], 404);
}
require_project_membership((int) $release['project_id'], (int) $user['id']);

db()->prepare('UPDATE releases SET version = ?, notes = ? WHERE id = ?')->execute([$version, $notes ?: null, $releaseId]);
json_response(['success' => true]);
