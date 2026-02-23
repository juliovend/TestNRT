export const API_BASE_URL = '/api';

export const API_ROUTES = {
  projects: `${API_BASE_URL}/projects/`,
  releases: `${API_BASE_URL}/releases/`,
  testcases: `${API_BASE_URL}/testcases/`,
  runs: `${API_BASE_URL}/runs/`,
  auth: {
    register: `${API_BASE_URL}/auth/register/`,
    login: `${API_BASE_URL}/auth/login/`,
    me: `${API_BASE_URL}/auth/me/`,
    logout: `${API_BASE_URL}/auth/logout/`,
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
    const message = payload?.message || payload?.error || `Erreur API (${response.status})`;
    throw new Error(message);
  }

  return (payload ?? {}) as T;
}
