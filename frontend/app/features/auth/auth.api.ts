import { API_BASE_URL } from "~/lib/constants";
import { getSetCookies } from "~/services/auth.server";

/**
 * Login unificado: el frontend detecta si es email o código
 * y llama al endpoint correcto del backend.
 * El backend devuelve los tokens en cookies httpOnly firmadas (Set-Cookie),
 * NO en el body. El body solo trae { message, user, expiresIn }.
 */
const REQUEST_TIMEOUT = 10000; // 10 segundos

/**
 * Envuelve una solicitud con timeout
 */
function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

export interface LoginResult {
  ok: boolean;
  status: number;
  data: {
    message?: string;
    code?: string;
    expiresIn?: number;
    user?: {
      id: number;
      nombre: string;
      tipo: "trabajador" | "usuario";
      rol: string;
      codigo?: string;
      email?: string;
    };
  };
  /** Set-Cookie del backend (accessToken + refreshToken httpOnly) */
  setCookies: string[];
}

export async function loginUser(
  codigo: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/auth/login/usuario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ codigo, password }),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, setCookies: getSetCookies(res) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";

    const errorMsg = message.includes("AbortError")
      ? "La solicitud tardó demasiado. Asegúrate de que el backend está ejecutándose en http://localhost:3000."
      : "No se pudo conectar con FastAPI. Verifica que backend_fastapi esté ejecutándose en el puerto 3000.";

    return {
      ok: false,
      status: 503,
      data: { message: errorMsg },
      setCookies: [],
    };
  }
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/auth/login/trabajador`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      },
    );

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, setCookies: getSetCookies(res) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";

    const errorMsg = message.includes("AbortError")
      ? "La solicitud tardó demasiado. Asegúrate de que el backend está ejecutándose en http://localhost:3000."
      : "No se pudo conectar con FastAPI. Verifica que backend_fastapi esté ejecutándose en el puerto 3000.";

    return {
      ok: false,
      status: 503,
      data: { message: errorMsg },
      setCookies: [],
    };
  }
}
