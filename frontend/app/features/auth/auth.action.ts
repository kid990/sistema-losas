import type { Route } from "./+types/login";
import { redirect } from "react-router";
import { commitSession } from "~/services/auth.server";
import { loginUser, loginAdmin } from "./auth.api";
import { ROLES } from "~/shared/types/roles";
import type { User } from "~/lib/types";

function getLoginErrorMessage(data: { message?: string; code?: string } | undefined, status: number): string {
  const code = data?.code;
  const msg = data?.message;

  if (code === "ACCOUNT_LOCKED" || status === 403) {
    return msg || "Tu cuenta está bloqueada o desactivada. Contacta al administrador.";
  }
  if (code === "RATE_LIMITED" || code === "LOGIN_RATE_LIMITED" || status === 429) {
    return msg || "Demasiados intentos. Por favor, espera unos minutos.";
  }
  if (code === "VALIDATION_ERROR" || status === 400) {
    return msg || "Datos de entrada inválidos.";
  }
  if (status === 401) {
    return msg || "Credenciales incorrectas.";
  }
  return msg || "Error de inicio de sesión";
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const identifier = formData.get("identifier") as string;
  const password = formData.get("password") as string;

  // Detectar si es email (admin) o código (usuario)
  const isEmail = identifier.includes("@");

  const result = isEmail
    ? await loginAdmin(identifier, password)
    : await loginUser(identifier, password);

  if (!result.ok) {
    const msg = getLoginErrorMessage(result.data, result.status);
    return redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  const { user } = result.data;

  if (!user) {
    const msg = "El servidor no proporcionó los datos del usuario";
    return redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  // Guardar solo el user en la cookie de sesión Remix (sin tokens).
  // Los tokens JWT llegaron como Set-Cookie httpOnly del backend y se
  // propagan directamente al navegador.
  const sessionCookie = await commitSession({ user: user as User });
  const headers = new Headers();
  headers.append("Set-Cookie", sessionCookie);
  for (const c of result.setCookies) {
    headers.append("Set-Cookie", c);
  }

  // Roles del backend: tipo="trabajador" + rol="Administrador" | "Seguridad"
  if (user.tipo === ROLES.ADMIN.tipo && user.rol === ROLES.ADMIN.rol) {
    return redirect("/dashboard/inicio", { headers });
  }
  if (user.tipo === ROLES.SEGURIDAD.tipo && user.rol === ROLES.SEGURIDAD.rol) {
    return redirect("/seguridad/modulo", { headers });
  }
  // Usuarios normales redirigidos al inicio de su panel
  return redirect("/losas", { headers });
}
