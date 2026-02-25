<?php
$user = require_login();
$body = read_json_body();
$projectOrders = $body['project_orders'] ?? [];

if (!is_array($projectOrders) || !$projectOrders) {
    json_response(['message' => 'project_orders must be a non-empty list'], 422);
}

$pdo = db();
$checkMembership = $pdo->prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1');
$updateOrder = $pdo->prepare('UPDATE project_members SET project_order = ? WHERE project_id = ? AND user_id = ?');

$pdo->beginTransaction();

try {
    foreach ($projectOrders as $index => $item) {
        if (!is_array($item)) {
            json_response(['message' => 'Each project_orders entry must be an object'], 422);
        }

        $projectId = (int) ($item['project_id'] ?? 0);
        $order = (int) ($item['project_order'] ?? ($index + 1));

        if ($projectId <= 0 || $order <= 0) {
            json_response(['message' => 'project_id and project_order must be positive integers'], 422);
        }

        $checkMembership->execute([$projectId, $user['id']]);
        if (!$checkMembership->fetch()) {
            json_response(['message' => 'Access denied for at least one project'], 403);
        }

        $updateOrder->execute([$order, $projectId, $user['id']]);
    }

    $pdo->commit();
    json_response(['success' => true]);
} catch (Throwable $e) {
    $pdo->rollBack();
    json_response(['message' => 'Error while saving project order', 'details' => $e->getMessage()], 500);
}
