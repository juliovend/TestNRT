<?php
$user = require_login();
$projectId = (int) ($_GET['project_id'] ?? 0);
if ($projectId <= 0) {
    json_response(['message' => 'project_id is required'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$stmt = db()->prepare('SELECT id, project_id, case_number, steps, expected_result, analytical_values_json, attachments_json, is_active FROM test_cases WHERE project_id = ? ORDER BY case_number ASC, id ASC');
$stmt->execute([$projectId]);
$cases = $stmt->fetchAll();

foreach ($cases as &$case) {
    $case['analytical_values'] = $case['analytical_values_json'] ? json_decode((string) $case['analytical_values_json'], true) : new stdClass();
    $case['attachments'] = $case['attachments_json'] ? json_decode((string) $case['attachments_json'], true) : [];
    unset($case['analytical_values_json'], $case['attachments_json']);
}
unset($case);

json_response(['test_cases' => $cases]);
