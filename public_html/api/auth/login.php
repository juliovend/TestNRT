<?php
$body = read_json_body();
$email = trim($body['email'] ?? '');
$password = $body['password'] ?? '';

$stmt = db()->prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
    json_response(['message' => 'Invalid credentials'], 401);
}

$_SESSION['user_id'] = (int) $user['id'];
unset($user['password_hash']);
json_response(['user' => $user]);
