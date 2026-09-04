import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { ROLES } from "~/shared/types/roles";

/**
 * Resource route: POST /user/notifs
 * Intents: marcar-leida | marcar-todas-leidas
 */
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== ROLES.USUARIO.tipo) {
    return data({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  try {
    if (intent === "marcar-leida") {
      const id_n = fd.get("id_n") as string;
      if (!id_n) return data({ ok: false, error: "ID requerido" }, { status: 400 });
      await api.patch(`/notificaciones/${id_n}/leido`, request);
      return data({ ok: true }, { headers: responseHeadersWithCookies(request) });
    }

    if (intent === "marcar-todas-leidas") {
      await api.patch(`/notificaciones/usuario/${user.id}/leidas`, request);
      return data({ ok: true }, { headers: responseHeadersWithCookies(request) });
    }
  } catch {
    return data(
      { ok: false, error: "No se pudo actualizar la notificación" },
      { status: 500, headers: responseHeadersWithCookies(request) },
    );
  }

  return data({ ok: false, error: "Acción no válida" }, { status: 400 });
}
