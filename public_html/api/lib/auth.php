<?php
function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $stmt = db()->prepare('SELECT id, email, name FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    return $user ?: null;
}

function require_login(): array
{
    $user = current_user();
    if (!$user) {
        json_response(['message' => 'Authentification requise'], 401);
    }

    return $user;
}

function require_project_membership(int $projectId, int $userId): void
{
    $stmt = db()->prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?');
    $stmt->execute([$projectId, $userId]);
    if (!$stmt->fetch()) {
        json_response(['message' => 'Access denied for this project'], 403);
    }
}
