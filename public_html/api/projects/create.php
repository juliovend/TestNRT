<?php
$user = require_login();
$body = read_json_body();
$name = trim($body['name'] ?? '');
$description = trim($body['description'] ?? '');
$assignedEmails = $body['assigned_emails'] ?? [];

if ($name === '') {
    json_response(['message' => 'Project name is required'], 422);
}

if (!is_array($assignedEmails)) {
    json_response(['message' => 'assigned_emails must be a list'], 422);
}

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
    $insert = $pdo->prepare('INSERT INTO projects(name, description, created_by) VALUES (?, ?, ?)');
    $insert->execute([$name, $description ?: null, $user['id']]);
    $projectId = (int) $pdo->lastInsertId();

    $findUser = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $createUser = $pdo->prepare('INSERT INTO users(email, password_hash, name, auth_provider) VALUES (?, ?, NULL, "local")');
    $insertMember = $pdo->prepare('INSERT INTO project_members(project_id, user_id, role, project_order) VALUES (?, ?, ?, ?)');

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
        $insertMember->execute([$projectId, $userId, $role, null]);
    }

    $pdo->commit();
    json_response(['project_id' => $projectId], 201);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Error creating project', 'details' => $e->getMessage()], 500);
}
