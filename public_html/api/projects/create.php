<?php
$user = require_login();
$body = read_json_body();
$name = trim($body['name'] ?? '');
$description = trim($body['description'] ?? '');

if ($name === '') {
    json_response(['message' => 'Le nom du projet est obligatoire'], 422);
}

$pdo = db();
$insert = $pdo->prepare('INSERT INTO projects(name, description, created_by) VALUES (?, ?, ?)');
$insert->execute([$name, $description ?: null, $user['id']]);
$projectId = (int) $pdo->lastInsertId();

$member = $pdo->prepare('INSERT INTO project_members(project_id, user_id, role) VALUES (?, ?, "admin")');
$member->execute([$projectId, $user['id']]);

json_response(['project_id' => $projectId], 201);
