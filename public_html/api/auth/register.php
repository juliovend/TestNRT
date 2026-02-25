<?php
$body = read_json_body();
$email = trim($body['email'] ?? '');
$password = $body['password'] ?? '';
$name = trim($body['name'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
    json_response(['message' => 'Invalid email or password (min 6 characters)'], 422);
}

$stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    json_response(['message' => 'Email already in use'], 409);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$insert = db()->prepare('INSERT INTO users(email, password_hash, name, auth_provider) VALUES (?, ?, ?, "local")');
$insert->execute([$email, $hash, $name ?: null]);
$userId = (int) db()->lastInsertId();
$_SESSION['user_id'] = $userId;

$stmt = db()->prepare('SELECT id, email, name FROM users WHERE id = ?');
$stmt->execute([$userId]);
json_response(['user' => $stmt->fetch()], 201);
