<?php
global $config;

$state = $_GET['state'] ?? '';
$code = $_GET['code'] ?? '';
if (!$state || !$code || !hash_equals($_SESSION['google_oauth_state'] ?? '', $state)) {
    json_response(['message' => 'OAuth state invalide'], 400);
}
unset($_SESSION['google_oauth_state']);

$postData = http_build_query([
    'code' => $code,
    'client_id' => $config['google']['client_id'],
    'client_secret' => $config['google']['client_secret'],
    'redirect_uri' => $config['google']['redirect_uri'],
    'grant_type' => 'authorization_code',
]);

$opts = [
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => $postData,
        'ignore_errors' => true,
    ],
];
$tokenResp = file_get_contents('https://oauth2.googleapis.com/token', false, stream_context_create($opts));
$tokenData = json_decode($tokenResp ?: '', true);
$accessToken = $tokenData['access_token'] ?? null;
if (!$accessToken) {
    json_response(['message' => 'Impossible de récupérer le token Google'], 400);
}

$userInfoResp = file_get_contents('https://www.googleapis.com/oauth2/v2/userinfo?access_token=' . urlencode($accessToken));
$userInfo = json_decode($userInfoResp ?: '', true);
$email = $userInfo['email'] ?? null;
$name = $userInfo['name'] ?? null;
$googleId = $userInfo['id'] ?? null;

if (!$email || !$googleId) {
    json_response(['message' => 'Profil Google invalide'], 400);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT id, email, name FROM users WHERE google_id = ? OR email = ? LIMIT 1');
$stmt->execute([$googleId, $email]);
$user = $stmt->fetch();

if ($user) {
    $update = $pdo->prepare('UPDATE users SET google_id = ?, auth_provider = "google", name = COALESCE(name, ?) WHERE id = ?');
    $update->execute([$googleId, $name, $user['id']]);
    $userId = (int) $user['id'];
} else {
    $insert = $pdo->prepare('INSERT INTO users(email, name, auth_provider, google_id) VALUES (?, ?, "google", ?)');
    $insert->execute([$email, $name, $googleId]);
    $userId = (int) $pdo->lastInsertId();
}

$_SESSION['user_id'] = $userId;
header('Location: ' . rtrim($config['app_url'], '/') . '/');
exit;
