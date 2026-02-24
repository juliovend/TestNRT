export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface RunSummary {
  total: number;
  pass: number;
  fail: number;
  blocked: number;
  skipped: number;
  not_run: number;
}

export interface RunItem {
  id: number;
  run_number: number;
  created_at: string;
  summary: RunSummary;
}

export interface Release {
  id: number;
  project_id: number;
  version: string;
  notes: string | null;
  created_at: string;
  runs?: RunItem[];
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  assigned_emails: string[];
  releases?: Release[];
}

export interface TestCase {
  id: number;
  project_id: number;
  title: string;
  steps: string;
  expected_result: string | null;
  is_active: number;
}

export interface TestRun {
  id: number;
  project_id: number;
  release_id: number;
  run_number: number;
  created_by: number;
  status: string;
  created_at: string;
  summary: RunSummary;
}
