const API_BASE = '/api';

interface ApiOptions extends RequestInit {
  bodyJson?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.bodyJson !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: options.bodyJson !== undefined ? JSON.stringify(options.bodyJson) : options.body,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || 'Erreur API');
  }

  return payload as T;
}
