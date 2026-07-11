// Typed fetch client against the Django v1 API. Base URL from env; token auth
// persisted in localStorage. All requests go through `api()`.

// Empty by default → requests are same-origin ("/api/v1/…") and go through the
// Vite dev proxy (see vite.config.ts). Set VITE_DERVAISH_API_BASE_URL for prod.
const API_BASE_URL = (import.meta.env.VITE_DERVAISH_API_BASE_URL ?? "").replace(/\/$/, "");

const TOKEN_KEY = "dervaish.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors (private mode) */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.error ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Login returns a token under one of several common DRF keys. */
export async function login(username: string, password: string): Promise<string> {
  const res = await api<Record<string, string>>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const token = res.token ?? res.key ?? res.access ?? res.auth_token;
  if (!token) throw new ApiError(500, "No token in login response");
  setToken(token);
  return token;
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout/", { method: "POST" });
  } finally {
    setToken(null);
  }
}
