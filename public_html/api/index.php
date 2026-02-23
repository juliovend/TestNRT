<?php
require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$route = $_GET['route'] ?? null;

$routes = [
    'auth.register' => ['method' => 'POST', 'file' => 'auth/register.php'],
    'auth.login' => ['method' => 'POST', 'file' => 'auth/login.php'],
    'auth.logout' => ['method' => 'POST', 'file' => 'auth/logout.php'],
    'auth.me' => ['method' => 'GET', 'file' => 'auth/me.php'],
    'projects.list' => ['method' => 'GET', 'file' => 'projects/list.php'],
    'projects.create' => ['method' => 'POST', 'file' => 'projects/create.php'],
    'releases.list' => ['method' => 'GET', 'file' => 'releases/list.php'],
    'releases.create' => ['method' => 'POST', 'file' => 'releases/create.php'],
    'testcases.list' => ['method' => 'GET', 'file' => 'test_cases/list.php'],
    'testcases.create' => ['method' => 'POST', 'file' => 'test_cases/create.php'],
    'testcases.update' => ['method' => 'POST', 'file' => 'test_cases/update.php'],
    'runs.create' => ['method' => 'POST', 'file' => 'runs/create.php'],
    'runs.list' => ['method' => 'GET', 'file' => 'runs/list.php'],
    'runs.get' => ['method' => 'GET', 'file' => 'runs/get.php'],
    'runs.export_csv' => ['method' => 'GET', 'file' => 'runs/export_csv.php'],
    'runs.set_result' => ['method' => 'POST', 'file' => 'runs/set_result.php'],
];

if ($route !== null) {
    $route = trim((string) $route);
    if ($route === '') {
        json_response(['message' => 'Paramètre "route" vide'], 400);
    }

    $path = '/' . trim(str_replace('.', '/', $route), '/');
} else {
    $path = trim((string) ($_SERVER['PATH_INFO'] ?? ''));

    if ($path === '') {
        $requestPath = (string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?? '');
        $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
        $scriptDir = rtrim((string) dirname($scriptName), '/');

        if ($scriptName !== '' && str_starts_with($requestPath, $scriptName)) {
            $requestPath = (string) substr($requestPath, strlen($scriptName));
        } elseif ($scriptDir !== '' && $scriptDir !== '.' && str_starts_with($requestPath, $scriptDir . '/')) {
            $requestPath = (string) substr($requestPath, strlen($scriptDir));
        }

        $path = $requestPath;
    }

    $path = '/' . trim($path, '/');
    $route = str_replace('/', '.', trim($path, '/'));
}

if ($route === '' || !isset($routes[$route])) {
    json_response(['message' => 'Endpoint non trouvé', 'method' => $method, 'route' => $route, 'path' => $path], 404);
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
