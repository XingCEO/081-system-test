// API client — thin wrapper around fetch for server communication
// In dev mode, Vite proxy routes /api/* to the server.
// In production, the server serves the static files so same origin.

const BASE = '/api';
const REQUEST_TIMEOUT_MS = 10000;

// Lazily import the auth store to avoid circular dependency issues at module load time.
// We read the token at call time, not at import time.
function getAuthToken(): string | null {
  try {
    // Access the persisted Zustand state directly from localStorage to avoid
    // circular imports (authService imports client, client should not import authService).
    const raw = localStorage.getItem('pos-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function handleUnauthorized(): void {
  // Clear auth state and redirect to login.
  // We write directly to localStorage to avoid a circular import with useAuthStore.
  try {
    const raw = localStorage.getItem('pos-auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: object; version?: number };
      if (parsed?.state) {
        (parsed.state as Record<string, unknown>).token = null;
        (parsed.state as Record<string, unknown>).currentEmployee = null;
        (parsed.state as Record<string, unknown>).isAuthenticated = false;
        (parsed.state as Record<string, unknown>).shiftId = null;
        localStorage.setItem('pos-auth', JSON.stringify(parsed));
      }
    }
  } catch {
    localStorage.removeItem('pos-auth');
  }
  // Navigate to login page without a full reload when possible
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  // Build Authorization header from stored JWT token (if present)
  const token = getAuthToken();
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...options?.headers,
      },
    });

    // 401 means the token is invalid or expired — clear auth and redirect to login
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('未授權，請重新登入');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `API error: ${res.status}`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined });
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export const api = { get, post, put, del };
