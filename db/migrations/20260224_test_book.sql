ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS case_number INT NOT NULL DEFAULT 1 AFTER project_id,
  ADD COLUMN IF NOT EXISTS analytical_values_json JSON NULL AFTER expected_result,
  ADD COLUMN IF NOT EXISTS attachments_json JSON NULL AFTER analytical_values_json;

CREATE INDEX IF NOT EXISTS idx_test_cases_project_order ON test_cases(project_id, case_number);

CREATE TABLE IF NOT EXISTS test_book_axes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  level_number INT NOT NULL,
  label VARCHAR(190) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_project_axis_level (project_id, level_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS test_book_axis_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  axis_id INT NOT NULL,
  value_label VARCHAR(190) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (axis_id) REFERENCES test_book_axes(id) ON DELETE CASCADE,
  KEY idx_axis_values_order (axis_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @rownum := 0;
UPDATE test_cases tc
JOIN (
  SELECT id, (@rownum := IF(@project = project_id, @rownum + 1, 1)) AS new_case_number,
         (@project := project_id) AS _project
  FROM test_cases, (SELECT @project := 0, @rownum := 0) vars
  ORDER BY project_id, id
) ranked ON ranked.id = tc.id
SET tc.case_number = ranked.new_case_number;
