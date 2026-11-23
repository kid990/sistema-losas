import type { ActionFunctionArgs } from "react-router";

import { api } from "~/services/api.server";
import { requireAuth } from "~/services/auth.server";

/**
 * Recurso same-origin para consultar detalles y documento de un permiso.
 * Evita llamadas directas al API desde el navegador (CORS y expiración de token).
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = formData.get("id_p");

  if (!id) {
    return Response.json({ ok: false, error: "Permiso requerido" }, { status: 400 });
  }

  try {
    if (intent === "detalles") {
      const res = (await api.get(`/permisos/detalles/${id}`, request)) as { data?: unknown };
      return Response.json({ ok: true, data: res.data ?? res });
    }
    if (intent === "documento") {
      const res = await api.get(`/permisos/${id}/documento`, request);
      return Response.json({ ok: true, data: res });
    }
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          intent === "documento"
            ? "No se pudo obtener el documento"
            : "No se pudieron obtener los detalles",
      },
      { status: 500 },
    );
  }

  return Response.json({ ok: false, error: "Acción inválida" }, { status: 400 });
}
