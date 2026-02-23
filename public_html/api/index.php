<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$route = trim((string) ($_GET['route'] ?? ''));

$routes = [
    'auth.register' => ['method' => 'POST', 'file' => 'auth/register.php'],
    'auth.login' => ['method' => 'POST', 'file' => 'auth/login.php'],
    'auth.logout' => ['method' => 'POST', 'file' => 'auth/logout.php'],
    'auth.me' => ['method' => 'GET', 'file' => 'auth/me.php'],
    'auth.google_start' => ['method' => 'GET', 'file' => 'auth/google_start.php'],
    'auth.google_callback' => ['method' => 'GET', 'file' => 'auth/google_callback.php'],
    'projects.list' => ['method' => 'GET', 'file' => 'projects/list.php'],
    'projects.create' => ['method' => 'POST', 'file' => 'projects/create.php'],
    'releases.list' => ['method' => 'GET', 'file' => 'releases/list.php'],
    'releases.create' => ['method' => 'POST', 'file' => 'releases/create.php'],
    'testcases.list' => ['method' => 'GET', 'file' => 'test_cases/list.php'],
    'testcases.create' => ['method' => 'POST', 'file' => 'test_cases/create.php'],
    'testcases.update' => ['method' => 'POST', 'file' => 'test_cases/update.php'],
    'runs.create' => ['method' => 'POST', 'file' => 'runs/create.php'],
    'runs.get' => ['method' => 'GET', 'file' => 'runs/get.php'],
    'runs.set_result' => ['method' => 'POST', 'file' => 'runs/set_result.php'],
];

if ($route === '' || !isset($routes[$route])) {
    json_response(['message' => 'Endpoint non trouvé', 'method' => $method, 'route' => $route], 404);
}

$endpoint = $routes[$route];
if ($method !== $endpoint['method']) {
    header('Allow: ' . $endpoint['method']);
    json_response([
        'message' => 'Méthode HTTP non autorisée',
        'route' => $route,
        'expected_method' => $endpoint['method'],
        'received_method' => $method,
    ], 405);
}

require __DIR__ . '/' . $endpoint['file'];
