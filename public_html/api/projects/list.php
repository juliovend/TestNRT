<?php
$user = require_login();
$pdo = db();

$stmt = $pdo->prepare('SELECT p.* FROM projects p INNER JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY (pm.project_order IS NULL) ASC, pm.project_order ASC, p.created_at DESC, p.id DESC');
$stmt->execute([$user['id']]);
$projects = $stmt->fetchAll();

$memberStmt = $pdo->prepare('SELECT u.email FROM project_members pm INNER JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.email ASC');
foreach ($projects as &$project) {
    $memberStmt->execute([$project['id']]);
    $project['assigned_emails'] = array_map(fn($row) => $row['email'], $memberStmt->fetchAll());
}
unset($project);

json_response(['projects' => $projects]);
