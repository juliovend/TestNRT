<?php
$user = require_login();
$projectId = (int) ($_GET['project_id'] ?? 0);
$caseId = (int) ($_GET['case_id'] ?? 0);
$file = trim((string) ($_GET['file'] ?? ''));

if ($projectId <= 0 || $caseId <= 0 || $file === '') {
    json_response(['message' => 'Invalid parameters'], 422);
}

if (!preg_match('/^[A-Za-z0-9._-]+$/', $file)) {
    json_response(['message' => 'Invalid file name'], 422);
}

require_project_membership($projectId, (int) $user['id']);

$stmt = db()->prepare('SELECT project_id, attachments_json FROM test_cases WHERE id = ?');
$stmt->execute([$caseId]);
$testCase = $stmt->fetch();
if (!$testCase || (int) $testCase['project_id'] !== $projectId) {
    json_response(['message' => 'Test case not found for this project'], 404);
}

$attachments = $testCase['attachments_json'] ? json_decode((string) $testCase['attachments_json'], true) : [];
if (!is_array($attachments)) {
    $attachments = [];
}

$downloadName = null;
foreach ($attachments as $entry) {
    $entryValue = (string) $entry;
    $parts = explode('::', $entryValue, 2);
    if (count($parts) === 2 && $parts[1] === $file) {
        $downloadName = $parts[0];
        break;
    }
}

if ($downloadName === null) {
    json_response(['message' => 'Attachment not found'], 404);
}

$path = dirname(__DIR__, 2) . '/uploads/testbook/' . $projectId . '/' . $caseId . '/' . $file;
if (!is_file($path)) {
    json_response(['message' => 'File not found on server'], 404);
}

$contentType = function_exists('mime_content_type') ? (string) mime_content_type($path) : 'application/octet-stream';
header('Content-Type: ' . ($contentType ?: 'application/octet-stream'));
header('Content-Length: ' . (string) filesize($path));
header('Content-Disposition: inline; filename="' . rawurlencode($downloadName) . '"');
readfile($path);
exit;
