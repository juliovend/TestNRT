<?php
$user = require_login();
$body = read_json_body();
$projectId = (int) ($body['project_id'] ?? 0);
$axes = $body['axes'] ?? null;

if ($projectId <= 0 || !is_array($axes) || count($axes) < 1) {
    json_response(['message' => 'project_id et axes (min 1) obligatoires'], 422);
}
require_project_membership($projectId, (int) $user['id']);

$pdo = db();
$pdo->beginTransaction();
try {
    $delStmt = $pdo->prepare('DELETE FROM test_book_axes WHERE project_id = ?');
    $delStmt->execute([$projectId]);

    $insertAxis = $pdo->prepare('INSERT INTO test_book_axes(project_id, level_number, label) VALUES (?, ?, ?)');
    $insertValue = $pdo->prepare('INSERT INTO test_book_axis_values(axis_id, value_label, sort_order) VALUES (?, ?, ?)');

    $level = 1;
    foreach ($axes as $axis) {
        $label = trim((string) ($axis['label'] ?? ''));
        $values = $axis['values'] ?? null;
        if ($label === '' || !is_array($values) || count($values) < 1) {
            throw new RuntimeException('Chaque axe doit contenir un libellé et au moins une valeur');
        }

        $insertAxis->execute([$projectId, $level, $label]);
        $axisId = (int) $pdo->lastInsertId();

        $sortOrder = 1;
        foreach ($values as $value) {
            $valueLabel = trim((string) (is_array($value) ? ($value['value_label'] ?? '') : $value));
            if ($valueLabel === '') {
                continue;
            }
            $insertValue->execute([$axisId, $valueLabel, $sortOrder]);
            $sortOrder++;
        }

        if ($sortOrder === 1) {
            throw new RuntimeException('Chaque axe doit avoir au moins une valeur non vide');
        }

        $level++;
    }

    $pdo->commit();
    json_response(['success' => true]);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => $e->getMessage()], 422);
}
