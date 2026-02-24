<?php
$user = require_login();
$body = read_json_body();
$projectId = (int) ($body['project_id'] ?? 0);
$name = trim($body['name'] ?? '');
$description = trim($body['description'] ?? '');
$assignedEmails = $body['assigned_emails'] ?? [];

if ($projectId <= 0 || $name === '' || !is_array($assignedEmails)) {
    json_response(['message' => 'project_id, name et assigned_emails valides sont obligatoires'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$normalizedEmails = [];
foreach ($assignedEmails as $email) {
    $candidate = strtolower(trim((string) $email));
    if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
        $normalizedEmails[$candidate] = true;
    }
}
$normalizedEmails[strtolower($user['email'])] = true;
$emails = array_keys($normalizedEmails);

$pdo = db();
$pdo->beginTransaction();

try {
    $updateProject = $pdo->prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?');
    $updateProject->execute([$name, $description ?: null, $projectId]);

    $pdo->prepare('DELETE FROM project_members WHERE project_id = ?')->execute([$projectId]);

    $findUser = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $createUser = $pdo->prepare('INSERT INTO users(email, password_hash, name, auth_provider) VALUES (?, ?, NULL, "local")');
    $insertMember = $pdo->prepare('INSERT INTO project_members(project_id, user_id, role) VALUES (?, ?, ?)');

    foreach ($emails as $email) {
        $findUser->execute([$email]);
        $existing = $findUser->fetch();
        if ($existing) {
            $userId = (int) $existing['id'];
        } else {
            $createUser->execute([$email, password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]);
            $userId = (int) $pdo->lastInsertId();
        }
        $role = $userId === (int) $user['id'] ? 'admin' : 'member';
        $insertMember->execute([$projectId, $userId, $role]);
    }

    $pdo->commit();
    json_response(['success' => true]);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Erreur mise à jour projet', 'details' => $e->getMessage()], 500);
}
