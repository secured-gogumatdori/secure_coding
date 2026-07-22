const API = import.meta.env.VITE_API_URL ?? '';
let csrfToken = '';

export type ApiError = Error & { code?: string; status?: number };

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API}/api/auth/csrf`, { credentials: 'include' });
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('x-csrf-token', await ensureCsrf());
  if (options.body && !(options.body instanceof FormData))
    headers.set('content-type', 'application/json');
  const response = await fetch(`${API}/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message ?? '요청을 처리하지 못했습니다.') as ApiError;
    error.code = data.error?.code;
    error.status = response.status;
    throw error;
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}

export const resetCsrf = () => {
  csrfToken = '';
};
