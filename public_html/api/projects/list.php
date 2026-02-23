<?php
$user = require_login();
$stmt = db()->prepare('SELECT p.* FROM projects p INNER JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.created_at DESC');
$stmt->execute([$user['id']]);
json_response(['projects' => $stmt->fetchAll()]);
