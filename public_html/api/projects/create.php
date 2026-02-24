<?php
$user = require_login();
$body = read_json_body();
$name = trim($body['name'] ?? '');
$description = trim($body['description'] ?? '');
$assignedEmails = $body['assigned_emails'] ?? [];

if ($name === '') {
    json_response(['message' => 'Le nom du projet est obligatoire'], 422);
}

if (!is_array($assignedEmails)) {
    json_response(['message' => 'assigned_emails doit être une liste'], 422);
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
    $insertMember = $pdo->prepare('INSERT INTO project_members(project_id, user_id, role) VALUES (?, ?, ?)');
    $missingEmails = [];

    foreach ($emails as $email) {
        $findUser->execute([$email]);
        $existing = $findUser->fetch();
        if ($existing) {
            $userId = (int) $existing['id'];
        } else {
            $missingEmails[] = $email;
            continue;
        }

        $role = $userId === (int) $user['id'] ? 'admin' : 'member';
        $insertMember->execute([$projectId, $userId, $role]);
    }

    if ($missingEmails !== []) {
        $pdo->rollBack();
        json_response(['message' => 'Utilisateurs introuvables: ' . implode(', ', $missingEmails)], 422);
    }

    $pdo->commit();
    json_response(['project_id' => $projectId], 201);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(['message' => 'Erreur création projet', 'details' => $e->getMessage()], 500);
}
