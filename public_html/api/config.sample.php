<?php
return [
    'app_url' => 'https://example.com',
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'tnr_db',
        'user' => 'tnr_user',
        'pass' => 'change_me',
        'charset' => 'utf8mb4',
    ],
    'google' => [
        'client_id' => 'GOOGLE_CLIENT_ID',
        'client_secret' => 'GOOGLE_CLIENT_SECRET',
        'redirect_uri' => 'https://example.com/api/auth/google/callback',
    ],
    'session' => [
        'cookie_secure' => true,
    ],
];
