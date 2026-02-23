import { apiFetch } from './client';
import type { User } from '../types';

export function login(email: string, password: string) {
  return apiFetch<{ user: User }>('/auth/login', {
    method: 'POST',
    bodyJson: { email, password },
  });
}

export function register(email: string, password: string, name: string) {
  return apiFetch<{ user: User }>('/auth/register', {
    method: 'POST',
    bodyJson: { email, password, name },
  });
}

export function me() {
  return apiFetch<{ user: User | null }>('/auth/me');
}

export function logout() {
  return apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST' });
}
