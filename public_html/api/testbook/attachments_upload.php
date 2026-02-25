<?php
$user = require_login();
$projectId = (int) ($_POST['project_id'] ?? 0);
$caseId = (int) ($_POST['case_id'] ?? 0);

if ($projectId <= 0 || $caseId <= 0) {
    json_response(['message' => 'project_id et case_id sont requis'], 422);
}

require_project_membership($projectId, (int) $user['id']);

$stmt = db()->prepare('SELECT id, project_id, attachments_json FROM test_cases WHERE id = ?');
$stmt->execute([$caseId]);
$testCase = $stmt->fetch();
if (!$testCase || (int) $testCase['project_id'] !== $projectId) {
    json_response(['message' => 'Test case not found for this project'], 404);
}

if (!isset($_FILES['files'])) {
    json_response(['message' => 'No file received'], 422);
}

$files = $_FILES['files'];
$names = is_array($files['name']) ? $files['name'] : [$files['name']];
$tmpNames = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
$errors = is_array($files['error']) ? $files['error'] : [$files['error']];

$attachments = $testCase['attachments_json'] ? json_decode((string) $testCase['attachments_json'], true) : [];
if (!is_array($attachments)) {
    $attachments = [];
}

$storageDir = dirname(__DIR__, 2) . '/uploads/testbook/' . $projectId . '/' . $caseId;
if (!is_dir($storageDir) && !mkdir($storageDir, 0775, true) && !is_dir($storageDir)) {
    json_response(['message' => 'Unable to create storage directory'], 500);
}

for ($i = 0; $i < count($names); $i++) {
    if ((int) $errors[$i] !== UPLOAD_ERR_OK) {
        continue;
    }

    $originalName = basename((string) $names[$i]);
    $originalName = preg_replace('/[^\pL\pN\._\-\s]/u', '_', $originalName);
    $originalName = trim((string) $originalName);
    if ($originalName === '') {
        $originalName = 'file';
    }

    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    $storedName = uniqid('att_', true) . ($extension ? '.' . $extension : '');
    $targetPath = $storageDir . '/' . $storedName;

    if (!is_uploaded_file((string) $tmpNames[$i])) {
        continue;
    }

    if (!move_uploaded_file((string) $tmpNames[$i], $targetPath)) {
        continue;
    }

    $attachments[] = $originalName . '::' . $storedName;
}

$update = db()->prepare('UPDATE test_cases SET attachments_json = ? WHERE id = ?');
$update->execute([
    json_encode(array_values($attachments), JSON_UNESCAPED_UNICODE),
    $caseId,
]);

json_response([
    'success' => true,
    'attachments' => array_values($attachments),
]);
