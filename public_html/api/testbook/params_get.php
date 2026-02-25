<?php
$user = require_login();
$projectId = (int) ($_GET['project_id'] ?? 0);
if ($projectId <= 0) {
    json_response(['message' => 'project_id is required'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$axesStmt = db()->prepare('SELECT id, level_number, label FROM test_book_axes WHERE project_id = ? ORDER BY level_number ASC');
$axesStmt->execute([$projectId]);
$axes = $axesStmt->fetchAll();

$valuesStmt = db()->prepare('SELECT id, value_label, sort_order FROM test_book_axis_values WHERE axis_id = ? ORDER BY sort_order ASC, id ASC');
foreach ($axes as &$axis) {
    $valuesStmt->execute([$axis['id']]);
    $axis['values'] = $valuesStmt->fetchAll();
}
unset($axis);

json_response(['axes' => $axes]);
