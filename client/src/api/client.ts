const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.error || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body;
}

export const api = {
  get: (path: string) => request(path, { method: 'GET' }),
  post: (path: string, data?: any) => request(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: (path: string, data?: any) => request(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  del: (path: string) => request(path, { method: 'DELETE' }),
};
