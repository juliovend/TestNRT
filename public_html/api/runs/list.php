<?php
$user = require_login();
$releaseId = (int) ($_GET['release_id'] ?? 0);

if ($releaseId <= 0) {
    json_response(['message' => 'release_id is required'], 422);
}

$pdo = db();
$stmtRelease = $pdo->prepare('SELECT project_id FROM releases WHERE id = ?');
$stmtRelease->execute([$releaseId]);
$release = $stmtRelease->fetch();

if (!$release) {
    json_response(['message' => 'Release not found'], 404);
}

$projectId = (int) $release['project_id'];
require_project_membership($projectId, (int) $user['id']);

$stmt = $pdo->prepare(
    'SELECT tr.id, tr.project_id, tr.release_id, tr.run_number, tr.created_by, tr.status, tr.created_at,
        COUNT(trc.id) AS total,
        SUM(CASE WHEN trr.status = "PASS" THEN 1 ELSE 0 END) AS pass,
        SUM(CASE WHEN trr.status = "FAIL" THEN 1 ELSE 0 END) AS fail,
        SUM(CASE WHEN trr.status = "BLOCKED" THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN trr.status = "SKIPPED" THEN 1 ELSE 0 END) AS skipped,
        SUM(CASE WHEN trr.status = "NOT_RUN" THEN 1 ELSE 0 END) AS not_run
     FROM test_runs tr
     LEFT JOIN test_run_cases trc ON trc.test_run_id = tr.id
     LEFT JOIN test_run_results trr ON trr.test_run_case_id = trc.id
     WHERE tr.release_id = ?
     GROUP BY tr.id, tr.project_id, tr.release_id, tr.run_number, tr.created_by, tr.status, tr.created_at
     ORDER BY tr.run_number ASC'
);
$stmt->execute([$releaseId]);
$runs = $stmt->fetchAll();

$runs = array_map(function ($row) {
    return [
        'id' => (int) $row['id'],
        'project_id' => (int) $row['project_id'],
        'release_id' => (int) $row['release_id'],
        'run_number' => (int) $row['run_number'],
        'created_by' => (int) $row['created_by'],
        'status' => $row['status'],
        'created_at' => $row['created_at'],
        'summary' => [
            'total' => (int) $row['total'],
            'pass' => (int) $row['pass'],
            'fail' => (int) $row['fail'],
            'blocked' => (int) $row['blocked'],
            'skipped' => (int) $row['skipped'],
            'not_run' => (int) $row['not_run'],
        ],
    ];
}, $runs);

json_response(['runs' => $runs]);
