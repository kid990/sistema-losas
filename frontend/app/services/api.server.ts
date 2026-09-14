import { redirect } from "react-router";
import { API_BASE_URL } from "~/lib/constants";
import {
  tryRefreshTokens,
  getSetCookies,
  destroySession,
} from "./auth.server";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Propaga las Set-Cookie del backend al navegador añadiéndolas
 * a los headers de la respuesta del loader/action actual.
 * Uso: en el loader/action, `headers.append("Set-Cookie", c)` por cada cookie,
 * o usar `applySetCookies(headers, setCookies)`.
 */
export function applySetCookies(headers: Headers, setCookies: string[]) {
  for (const c of setCookies) {
    headers.append("Set-Cookie", c);
  }
}

async function doFetch(
  path: string,
  request: Request,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // No forzar Content-Type si el body es FormData
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Los tokens viajan en cookies httpOnly del backend: reenviar la
  // cookie del navegador al backend en cada llamada.
  headers["Cookie"] = request.headers.get("Cookie") || "";

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

async function apiFetch(
  path: string,
  request: Request,
  options: RequestInit = {}
): Promise<unknown> {
  let res: Response;
  try {
    res = await doFetch(path, request, options);
  } catch {
    throw new ApiError(
      "No se pudo conectar con el servidor backend (http://localhost:3000). Verifica que el servidor del backend esté corriendo.",
      503
    );
  }

  // Auto-refresh reactivo: si el access token expiró, intentar renovarlo
  // reenviando la cookie (el refresh token viaja ahí) y reintentar una vez.
  if (res.status === 401) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };

    if (err.code === "TOKEN_EXPIRED" || err.code === "AUTH_TOKEN_REQUIRED") {
      const refreshed = await refreshTokensOnce(request);
      if (refreshed) {
        // Propagar las nuevas cookies (access + refresh) al navegador
        // adjuntándolas al request para que el loader/action las incluya.
        pendingSetCookies.set(request, refreshed.setCookies);

        // Reintentar la llamada original con las cookies renovadas
        const retryRequest = new Request(request.url, {
          headers: mergeSetCookiesIntoCookieHeader(
            request.headers,
            refreshed.setCookies
          ),
        });
        try {
          res = await doFetch(path, retryRequest, options);
        } catch {
          throw new ApiError("No se pudo conectar con el servidor backend.", 503);
        }
      } else {
        // Refresh falló: sesión terminada. Destruir sesión Remix y redirigir.
        const cookie = await destroySession(request);
        throw redirect("/login", {
          headers: { "Set-Cookie": cookie },
        });
      }
    } else {
      throw new ApiError(err.message || res.statusText, res.status, err);
    }
  }

  // Guardar las Set-Cookie de la respuesta para que el loader las propague
  const setCookies = getSetCookies(res);
  if (setCookies.length > 0) {
    pendingSetCookies.set(request, [
      ...(pendingSetCookies.get(request) || []),
      ...setCookies,
    ]);
  }

  if (!res.ok) {
    const error = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
    };
    throw new ApiError(error.message || res.statusText, res.status, error);
  }

  return res.json();
}

// Set-Cookie pendientes por request: las api calls las acumulan y el
// loader/action las toma con takePendingSetCookies(request) para propagarlas.
const pendingSetCookies = new WeakMap<Request, string[]>();
const pendingRefreshes = new WeakMap<Request, ReturnType<typeof tryRefreshTokens>>();

function refreshTokensOnce(request: Request) {
  const current = pendingRefreshes.get(request);
  if (current) return current;

  const refresh = tryRefreshTokens(request);
  pendingRefreshes.set(request, refresh);
  return refresh;
}

export function takePendingSetCookies(request: Request): string[] {
  return pendingSetCookies.get(request) || [];
}

/**
 * Construye headers para la respuesta del loader/action incluyendo
 * las Set-Cookie pendientes de las llamadas al backend.
 */
export function responseHeadersWithCookies(request: Request): Headers {
  const headers = new Headers();
  applySetCookies(headers, takePendingSetCookies(request));
  return headers;
}

/**
 * Reconstruye el header Cookie incorporando los valores nuevos
 * de las Set-Cookie (nombre=valor) para el reintento del fetch.
 */
function mergeSetCookiesIntoCookieHeader(
  originalHeaders: Headers,
  setCookies: string[]
): Headers {
  const headers = new Headers(originalHeaders);
  const cookieHeader = originalHeaders.get("Cookie") || "";
  const jar = new Map<string, string>();

  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  for (const sc of setCookies) {
    const first = sc.split(";")[0];
    const idx = first.indexOf("=");
    if (idx > 0) {
      jar.set(first.slice(0, idx).trim(), first.slice(idx + 1).trim());
    }
  }

  headers.set(
    "Cookie",
    Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")
  );
  return headers;
}

export const api = {
  get: (path: string, request: Request) =>
    apiFetch(path, request, { method: "GET" }),

  post: (path: string, request: Request, body?: unknown) =>
    apiFetch(path, request, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  postForm: (path: string, request: Request, body: FormData) =>
    apiFetch(path, request, { method: "POST", body }),

  put: (path: string, request: Request, body?: unknown) =>
    apiFetch(path, request, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: (path: string, request: Request, body?: unknown) =>
    apiFetch(path, request, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: (path: string, request: Request) =>
    apiFetch(path, request, { method: "DELETE" }),
};
