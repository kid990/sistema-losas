import { API_BASE_URL } from "~/lib/constants";

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * fetch para llamadas directas desde el navegador al API.
 * Si el access token expiró (401), renueva la sesión y reintenta una vez.
 */
export async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
  const options: RequestInit = { ...init, credentials: "include" };
  let response = await fetch(input, options);
  if (response.status !== 401) return response;
  if (!(await refreshSession())) return response;
  return fetch(input, options);
}
