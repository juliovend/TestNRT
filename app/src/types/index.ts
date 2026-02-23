export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Release {
  id: number;
  project_id: number;
  version: string;
  notes: string | null;
  created_at: string;
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
  created_by: number;
  status: string;
  summary: {
    total: number;
    pass: number;
    fail: number;
    blocked: number;
    skipped: number;
    not_run: number;
  };
}
