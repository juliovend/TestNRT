<?php
$user = require_login();
$pdo = db();

$projectsStmt = $pdo->prepare('SELECT p.* FROM projects p INNER JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ? ORDER BY p.name ASC');
$projectsStmt->execute([$user['id']]);
$projects = $projectsStmt->fetchAll();

$memberStmt = $pdo->prepare('SELECT u.email FROM project_members pm INNER JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.email ASC');
$releaseStmt = $pdo->prepare('SELECT id, version, notes, created_at FROM releases WHERE project_id = ? ORDER BY version ASC');
$runStmt = $pdo->prepare('SELECT tr.id, tr.run_number, tr.created_at,
  COUNT(trc.id) AS total,
  SUM(CASE WHEN trr.status = \'PASS\' THEN 1 ELSE 0 END) AS pass,
  SUM(CASE WHEN trr.status = \'FAIL\' THEN 1 ELSE 0 END) AS fail,
  SUM(CASE WHEN trr.status = \'BLOCKED\' THEN 1 ELSE 0 END) AS blocked,
  SUM(CASE WHEN trr.status = \'SKIPPED\' THEN 1 ELSE 0 END) AS skipped,
  SUM(CASE WHEN trr.status = \'NOT_RUN\' THEN 1 ELSE 0 END) AS not_run
  FROM test_runs tr
  LEFT JOIN test_run_cases trc ON trc.test_run_id = tr.id
  LEFT JOIN test_run_results trr ON trr.test_run_case_id = trc.id
  WHERE tr.release_id = ?
  GROUP BY tr.id, tr.run_number, tr.created_at
  ORDER BY tr.run_number ASC');

foreach ($projects as &$project) {
    $memberStmt->execute([$project['id']]);
    $project['assigned_emails'] = array_map(fn($row) => $row['email'], $memberStmt->fetchAll());

    $releaseStmt->execute([$project['id']]);
    $releases = $releaseStmt->fetchAll();
    foreach ($releases as &$release) {
        $runStmt->execute([$release['id']]);
        $runs = $runStmt->fetchAll();
        $release['runs'] = array_map(function ($row) {
            return [
                'id' => (int) $row['id'],
                'run_number' => (int) $row['run_number'],
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
    }
    unset($release);
    $project['releases'] = $releases;
}
unset($project);

json_response(['projects' => $projects]);
