<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '';
$base = '/api';
if (str_starts_with($path, $base)) {
    $path = substr($path, strlen($base));
}
$path = '/' . ltrim($path, '/');

$routes = [
    'POST /auth/register' => 'auth/register.php',
    'POST /auth/login' => 'auth/login.php',
    'POST /auth/logout' => 'auth/logout.php',
    'GET /auth/me' => 'auth/me.php',
    'GET /auth/google/start' => 'auth/google_start.php',
    'GET /auth/google/callback' => 'auth/google_callback.php',
    'GET /projects' => 'projects/list.php',
    'POST /projects' => 'projects/create.php',
    'GET /releases' => 'releases/list.php',
    'POST /releases' => 'releases/create.php',
    'GET /test_cases' => 'test_cases/list.php',
    'POST /test_cases' => 'test_cases/create.php',
    'PUT /test_cases' => 'test_cases/update.php',
    'POST /runs/create' => 'runs/create.php',
    'GET /runs/get' => 'runs/get.php',
    'POST /runs/set_result' => 'runs/set_result.php',
];

$key = $method . ' ' . $path;
if (!isset($routes[$key])) {
    json_response(['message' => 'Endpoint non trouvé', 'method' => $method, 'path' => $path], 404);
}

require __DIR__ . '/' . $routes[$key];
