import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import { destroySession, notifyLogout } from "~/services/auth.server";

async function performLogout(request: Request) {
  // El backend revoca el refresh token y responde con Set-Cookie que
  // limpian accessToken y refreshToken. Hay que propagarlas al navegador.
  const backendSetCookies = await notifyLogout(request);
  const sessionCookie = await destroySession(request);

  const headers = new Headers();
  headers.append("Set-Cookie", sessionCookie);
  for (const c of backendSetCookies) {
    headers.append("Set-Cookie", c);
  }

  return redirect("/login", { headers });
}

export async function action({ request }: Route.ActionArgs) {
  return performLogout(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  return performLogout(request);
}
