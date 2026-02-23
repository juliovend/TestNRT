export const API_BASE_URL = '/api/index.php';

export function apiRoute(route: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams({ route });

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      query.set(key, String(value));
    });
  }

  return `${API_BASE_URL}?${query.toString()}`;
}

export const API_ROUTES = {
  projects: {
    list: apiRoute('projects.list'),
    create: apiRoute('projects.create'),
  },
  releases: {
    list: (projectId: string | number) => apiRoute('releases.list', { project_id: projectId }),
    create: apiRoute('releases.create'),
  },
  testcases: {
    list: (projectId: string | number) => apiRoute('testcases.list', { project_id: projectId }),
    create: apiRoute('testcases.create'),
    update: apiRoute('testcases.update'),
  },
  runs: {
    create: apiRoute('runs.create'),
    get: (runId: string | number) => apiRoute('runs.get', { run_id: runId }),
    exportCsv: (runId: string | number) => apiRoute('runs.export_csv', { run_id: runId }),
    setResult: apiRoute('runs.set_result'),
  },
  auth: {
    register: apiRoute('auth.register'),
    login: apiRoute('auth.login'),
    me: apiRoute('auth.me'),
    logout: apiRoute('auth.logout'),
  },
} as const;

interface ApiOptions extends RequestInit {
  bodyJson?: unknown;
}

export async function apiFetch<T>(url: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = options.method?.toUpperCase();

  if (method === 'POST' || options.bodyJson !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
    body: options.bodyJson !== undefined ? JSON.stringify(options.bodyJson) : options.body,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText || `Erreur API (${response.status})`;
    throw new Error(message);
  }

  return (payload ?? {}) as T;
}
