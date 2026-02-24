<?php
function table_exists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1');
    $stmt->execute([$tableName]);
    return (bool) $stmt->fetchColumn();
}

function column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $stmt->execute([$tableName, $columnName]);
    return (bool) $stmt->fetchColumn();
}

function ensure_schema_compatibility(PDO $pdo): void
{
    if (!table_exists($pdo, 'project_members')) {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS project_members (
              project_id INT NOT NULL,
              user_id INT NOT NULL,
              role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (project_id, user_id),
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }

    if (table_exists($pdo, 'users')) {
        if (!column_exists($pdo, 'users', 'password_hash')) {
            $pdo->exec('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL');
        }
        if (!column_exists($pdo, 'users', 'name')) {
            $pdo->exec('ALTER TABLE users ADD COLUMN name VARCHAR(190) NULL');
        }
        if (!column_exists($pdo, 'users', 'auth_provider')) {
            $pdo->exec("ALTER TABLE users ADD COLUMN auth_provider ENUM('local', 'google') NOT NULL DEFAULT 'local'");
        }
        if (!column_exists($pdo, 'users', 'google_id')) {
            $pdo->exec('ALTER TABLE users ADD COLUMN google_id VARCHAR(190) NULL UNIQUE');
        }
    }

    if (table_exists($pdo, 'projects') && !column_exists($pdo, 'projects', 'created_by')) {
        $pdo->exec('ALTER TABLE projects ADD COLUMN created_by INT NULL');
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $config;
    $db = $config['db'];
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $db['host'], $db['port'], $db['name'], $db['charset']);
    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    ensure_schema_compatibility($pdo);

    return $pdo;
}
