export const API_BASE_URL = '/api/index.php';

export function apiRoute(route: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams({ route });
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      query.set(key, String(value));
    });
  }
  return `${API_BASE_URL}?${query.toString()}`;
}

export const API_ROUTES = {
  dashboard: { home: apiRoute('dashboard.home') },
  projects: {
    list: apiRoute('projects.list'),
    create: apiRoute('projects.create'),
    update: apiRoute('projects.update'),
    delete: apiRoute('projects.delete'),
    reorder: apiRoute('projects.reorder'),
  },
  releases: {
    list: (projectId: string | number) => apiRoute('releases.list', { project_id: projectId }),
    create: apiRoute('releases.create'),
    update: apiRoute('releases.update'),
    delete: apiRoute('releases.delete'),
  },
  testcases: {
    list: (projectId: string | number) => apiRoute('testcases.list', { project_id: projectId }),
    create: apiRoute('testcases.create'),
    update: apiRoute('testcases.update'),
  },
  testbook: {
    paramsGet: (projectId: string | number) => apiRoute('testbook.params_get', { project_id: projectId }),
    paramsSave: apiRoute('testbook.params_save'),
    casesList: (projectId: string | number) => apiRoute('testbook.cases_list', { project_id: projectId }),
    casesCreate: apiRoute('testbook.cases_create'),
    casesUpdate: apiRoute('testbook.cases_update'),
    casesDelete: apiRoute('testbook.cases_delete'),
    attachmentsUpload: apiRoute('testbook.attachments_upload'),
    attachmentsOpen: (projectId: string | number, caseId: string | number, file: string) => apiRoute('testbook.attachments_open', { project_id: projectId, case_id: caseId, file }),
  },
  runs: {
    create: apiRoute('runs.create'),
    update: apiRoute('runs.update'),
    delete: apiRoute('runs.delete'),
    list: (releaseId: string | number) => apiRoute('runs.list', { release_id: releaseId }),
    get: (runId: string | number) => apiRoute('runs.get', { run_id: runId }),
    exportCsv: (runId: string | number) => apiRoute('runs.export_csv', { run_id: runId }),
    setResult: apiRoute('runs.set_result'),
    casesCreate: apiRoute('runs.cases_create'),
    casesUpdate: apiRoute('runs.cases_update'),
    casesDelete: apiRoute('runs.cases_delete'),
  },
  auth: {
    register: apiRoute('auth.register'),
    login: apiRoute('auth.login'),
    me: apiRoute('auth.me'),
    logout: apiRoute('auth.logout'),
  },
} as const;

interface ApiOptions extends RequestInit { bodyJson?: unknown }

export async function apiFetch<T>(url: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = options.method?.toUpperCase();
  if (method === 'POST' || options.bodyJson !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
    body: options.bodyJson !== undefined ? JSON.stringify(options.bodyJson) : options.body,
  });
  let payload: any = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(payload?.message || response.statusText || `Erreur API (${response.status})`);
  return (payload ?? {}) as T;
}
