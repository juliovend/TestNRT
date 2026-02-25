ALTER TABLE project_members
  ADD COLUMN project_order INT NULL AFTER role,
  ADD KEY idx_project_members_user_order (user_id, project_order);

SET @current_user_id := 0;
SET @position := 0;

UPDATE project_members pm
INNER JOIN (
  SELECT pm2.project_id,
         pm2.user_id,
         (@position := IF(@current_user_id = pm2.user_id, @position + 1, 1)) AS project_order,
         (@current_user_id := pm2.user_id) AS _current_user_marker
  FROM project_members pm2
  INNER JOIN projects p ON p.id = pm2.project_id
  ORDER BY pm2.user_id ASC, p.created_at DESC, p.id DESC
) ordered ON ordered.project_id = pm.project_id AND ordered.user_id = pm.user_id
SET pm.project_order = ordered.project_order;
