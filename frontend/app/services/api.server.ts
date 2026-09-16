import axios, { type AxiosRequestConfig, type AxiosResponse, isAxiosError } from "axios";
import { redirect } from "react-router";
import { API_BASE_URL } from "~/lib/constants";
import {
  tryRefreshTokens,
  getSetCookies,
  destroySession,
} from "./auth.server";

/* ── Error tipado ─────────────────────────────────────────────── */
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

/* ── Set-Cookie pendientes por request ────────────────────────── */
export function applySetCookies(headers: Headers, setCookies: string[]) {
  for (const c of setCookies) {
    headers.append("Set-Cookie", c);
  }
}

const pendingSetCookies = new WeakMap<Request, string[]>();
const pendingRefreshes  = new WeakMap<Request, ReturnType<typeof tryRefreshTokens>>();

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

export function responseHeadersWithCookies(request: Request): Headers {
  const headers = new Headers();
  applySetCookies(headers, takePendingSetCookies(request));
  return headers;
}

function mergeSetCookiesIntoCookieHeader(
  originalHeaders: Headers,
  setCookies: string[]
): string {
  const jar = new Map<string, string>();
  for (const pair of (originalHeaders.get("Cookie") || "").split(";")) {
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  for (const sc of setCookies) {
    const first = sc.split(";")[0];
    const idx = first.indexOf("=");
    if (idx > 0) jar.set(first.slice(0, idx).trim(), first.slice(idx + 1).trim());
  }
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

/* ── Instancia Axios (servidor) ───────────────────────────────── */
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  // No lanzar error en 4xx/5xx — los manejamos nosotros
  validateStatus: () => true,
});

/* ── Función principal ────────────────────────────────────────── */
async function apiFetch(
  path: string,
  request: Request,
  config: AxiosRequestConfig = {}
): Promise<unknown> {
  const cookieHeader = request.headers.get("Cookie") || "";

  const headers: Record<string, string> = {
    Cookie: cookieHeader,
    ...(config.headers as Record<string, string> || {}),
  };

  // Solo agregar Content-Type JSON si el body NO es FormData
  if (!(config.data instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let res: AxiosResponse;

  try {
    res = await axiosInstance({ ...config, url: path, headers });
  } catch (err) {
    if (isAxiosError(err) && err.code === "ECONNREFUSED") {
      throw new ApiError(
        "No se pudo conectar con el servidor backend. Verifica que esté corriendo.",
        503
      );
    }
    throw new ApiError("Error de red inesperado.", 503);
  }

  /* ── Auto-refresh en 401 ──────────────────────────────────── */
  if (res.status === 401) {
    const body = (res.data as { message?: string; code?: string }) || {};

    if (body.code === "TOKEN_EXPIRED" || body.code === "AUTH_TOKEN_REQUIRED") {
      const refreshed = await refreshTokensOnce(request);

      if (refreshed) {
        pendingSetCookies.set(request, [
          ...(pendingSetCookies.get(request) || []),
          ...refreshed.setCookies,
        ]);

        const newCookie = mergeSetCookiesIntoCookieHeader(
          request.headers,
          refreshed.setCookies
        );

        try {
          res = await axiosInstance({
            ...config,
            url: path,
            headers: { ...headers, Cookie: newCookie },
          });
        } catch {
          throw new ApiError("No se pudo conectar con el servidor backend.", 503);
        }
      } else {
        const cookie = await destroySession(request);
        throw redirect("/login", { headers: { "Set-Cookie": cookie } });
      }
    } else {
      throw new ApiError(body.message || res.statusText, res.status, body);
    }
  }

  /* ── Propagar Set-Cookie del backend ──────────────────────── */
  // Axios expone headers como objeto plano; reconstruimos una Response simulada
  // para reutilizar getSetCookies que espera Response.
  const fakeResponse = new Response(null, {
    headers: Object.entries(res.headers as Record<string, string>).reduce(
      (h, [k, v]) => { h.append(k, v); return h; },
      new Headers()
    ),
  });
  const setCookies = getSetCookies(fakeResponse);
  if (setCookies.length > 0) {
    pendingSetCookies.set(request, [
      ...(pendingSetCookies.get(request) || []),
      ...setCookies,
    ]);
  }

  /* ── Errores HTTP ─────────────────────────────────────────── */
  if (res.status >= 400) {
    const error = (res.data as { message?: string }) || {};
    throw new ApiError(error.message || res.statusText || "Error del servidor", res.status, res.data);
  }

  return res.data;
}

/* ── API pública ──────────────────────────────────────────────── */
export const api = {
  get: (path: string, request: Request) =>
    apiFetch(path, request, { method: "GET" }),

  post: (path: string, request: Request, body?: unknown) =>
    apiFetch(path, request, {
      method: "POST",
      data: body ? JSON.stringify(body) : undefined,
    }),

  postForm: (path: string, request: Request, body: FormData) =>
    apiFetch(path, request, { method: "POST", data: body }),

  put: (path: string, request: Request, body?: unknown) =>
    apiFetch(path, request, {
      method: "PUT",
      data: body ? JSON.stringify(body) : undefined,
    }),

  patch: (path: string, request: Request, body?: unknown) =>
    apiFetch(path, request, {
      method: "PATCH",
      data: body ? JSON.stringify(body) : undefined,
    }),

  delete: (path: string, request: Request) =>
    apiFetch(path, request, { method: "DELETE" }),
};
