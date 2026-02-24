<?php
$user = require_login();
$pdo = db();

$stmt = $pdo->prepare('SELECT p.* FROM projects p INNER JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.name ASC');
$stmt->execute([$user['id']]);
$projects = $stmt->fetchAll();

$memberStmt = $pdo->prepare('SELECT u.email FROM project_members pm INNER JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.email ASC');
foreach ($projects as &$project) {
    $memberStmt->execute([$project['id']]);
    $project['assigned_emails'] = array_map(fn($row) => $row['email'], $memberStmt->fetchAll());
}
unset($project);

json_response(['projects' => $projects]);
