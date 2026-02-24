ALTER TABLE test_run_cases
  MODIFY COLUMN test_case_id INT NULL,
  ADD COLUMN IF NOT EXISTS case_number INT NOT NULL DEFAULT 1 AFTER test_case_id,
  ADD COLUMN IF NOT EXISTS steps TEXT NOT NULL AFTER case_number,
  ADD COLUMN IF NOT EXISTS expected_result TEXT NULL AFTER steps,
  ADD COLUMN IF NOT EXISTS analytical_values_json JSON NULL AFTER expected_result,
  ADD COLUMN IF NOT EXISTS attachments_json JSON NULL AFTER analytical_values_json,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER attachments_json;

CREATE INDEX IF NOT EXISTS idx_test_run_cases_run_order ON test_run_cases(test_run_id, case_number);
