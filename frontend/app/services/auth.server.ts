import { createCookieSessionStorage, redirect } from "react-router";
import type { User } from "~/lib/types";
import { API_BASE_URL } from "~/lib/constants";
import { ROLES } from "~/shared/types/roles";

// SESSION_SECRET: firma la cookie de sesión (puedes cambiarlo en .env)
const SESSION_SECRET = process.env.SESSION_SECRET || "sistema-losa-secret-key-change-in-production";

const SESSION_EXPIRY = 5 * 60 * 60; // 5 horas (coincide con el refresh token del backend)

// La cookie de sesión de Remix ahora solo guarda el user (sin tokens).
// Los tokens JWT viven exclusivamente en cookies httpOnly firmadas del backend.
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    httpOnly: true,
    maxAge: SESSION_EXPIRY,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

// Cache de sesión por request: todas las llamadas a getSession(request) dentro
// de la MISMA request devuelven el MISMO objeto.
type SessionType = Awaited<ReturnType<typeof sessionStorage.getSession>>;
const sessionCache = new WeakMap<Request, SessionType>();

export async function getSession(request: Request) {
  if (sessionCache.has(request)) {
    return sessionCache.get(request)!;
  }
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  sessionCache.set(request, session);
  return session;
}

/**
 * Guarda el user en la cookie de sesión (sin tokens).
 */
export async function commitSession({ user }: { user: User }) {
  const session = await sessionStorage.getSession();
  session.set("user", user);
  return sessionStorage.commitSession(session);
}

export async function destroySession(request: Request) {
  const session = await getSession(request);
  return sessionStorage.destroySession(session);
}

/**
 * Refresca los tokens llamando al backend /auth/refresh.
 * Reenvía la cookie del navegador (donde viaja el refreshToken httpOnly).
 * Retorna las Set-Cookie del backend (nuevos tokens) para propagarlas,
 * o null si el refresh falló.
 */
export async function tryRefreshTokens(
  request: Request
): Promise<{ setCookies: string[] } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    if (!res.ok) return null;
    return { setCookies: getSetCookies(res) };
  } catch {
    return null;
  }
}

/**
 * Extrae los Set-Cookie de una respuesta fetch (Node 18+/undici).
 */
export function getSetCookies(res: Response): string[] {
  const headers = res.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/**
 * Notifica al backend que se cierra la sesión.
 * Reenvía la cookie del navegador para que el backend revoque el refresh token.
 * Retorna las Set-Cookie del backend (que limpian access/refresh) para propagarlas.
 */
export async function notifyLogout(request: Request): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    });
    return getSetCookies(res);
  } catch {
    // Ignorar errores de logout
    return [];
  }
}

export async function getUser(request: Request): Promise<User | null> {
  const session = await getSession(request);
  return (session.get("user") as User | undefined) || null;
}

export async function requireAuth(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/login");
  }
  return user;
}

export async function requireRole(
  request: Request,
  tipo?: string,
  rol?: string
): Promise<User> {
  const user = await requireAuth(request);

  if (tipo && user.tipo !== tipo) {
    throw redirect("/");
  }

  if (rol && user.rol !== rol) {
    throw redirect("/");
  }

  return user;
}

/**
 * Redirige a la ruta principal del usuario si ya está autenticado.
 * Útil para evitar que usuarios logueados vean /login.
 */
export async function requireNoAuth(request: Request): Promise<void> {
  const user = await getUser(request);
  if (!user) return;

  if (user.tipo === ROLES.ADMIN.tipo && user.rol === ROLES.ADMIN.rol) {
    throw redirect("/dashboard/inicio");
  }
  if (user.tipo === ROLES.SEGURIDAD.tipo && user.rol === ROLES.SEGURIDAD.rol) {
    throw redirect("/seguridad/modulo");
  }
  throw redirect("/horario");
}
